/*
 * Kanaan Cloud hub — the shared copy of the shop's database (Cloudflare D1 "kanaan-pos", binding POS_DB).
 * ------------------------------------------------------------
 * Every device (shop computer, phone…) keeps the whole database locally and sends its changes here; the
 * other devices take them from here. This file is used as-is by the website's Pages Functions
 * (functions/_shared/hub.js there) and by the POS tests (with a D1-like wrapper around SQLite).
 *
 * Free plan: ≤ 50 queries per request, 10 ms CPU, 100k rows written a day. So:
 *  - a push is ONE insert of all its rows (json_each over the request text — the Worker doesn't even parse it);
 *  - every row has a version number from one counter, given inside the same transaction, so a device that read
 *    up to version V can never miss a row with a smaller version later;
 *  - the old history is not written here row by row: it is a database file ("base") in R2.
 *
 * Tables: hub_meta (k, v) · hub_rows (t, pk, d JSON | NULL = deleted, v, dev, at, pt) · hub_devices · hub_pair · hub_bases
 *
 * Rows come whole ({d}: a new row), as changed columns only ({p}: merged into the row here, so two devices changing
 * different columns of the same row both keep their change), or deleted ({d: null}: a deletion always wins).
 * pt = 1: only some columns are known here (a row from the database file that was changed later).
 * ca = when each changed column was changed ({col: ms}); the same column changed on two devices: the later change wins
 * (columns not in ca date from `at`, the last time the whole row was written).
 * dev = -1: the row now mixes changes of several devices (everyone gets it back).
 */

export const HUB_SCHEMA = [
  `CREATE TABLE IF NOT EXISTS hub_meta (k TEXT PRIMARY KEY, v INTEGER NOT NULL)`,
  `INSERT OR IGNORE INTO hub_meta (k, v) VALUES ('v', 0)`,
  `CREATE TABLE IF NOT EXISTS hub_rows (t TEXT NOT NULL, pk TEXT NOT NULL, d TEXT, v INTEGER NOT NULL, dev INTEGER NOT NULL, at INTEGER NOT NULL,
     pt INTEGER NOT NULL DEFAULT 0, ca TEXT, PRIMARY KEY (t, pk)) WITHOUT ROWID`,
  `CREATE INDEX IF NOT EXISTS hub_rows_v ON hub_rows (v)`,
  `CREATE TABLE IF NOT EXISTS hub_devices (no INTEGER PRIMARY KEY, name TEXT NOT NULL DEFAULT '', kind TEXT NOT NULL DEFAULT '',
     token_hash TEXT NOT NULL UNIQUE, created_at INTEGER NOT NULL, last_seen INTEGER NOT NULL DEFAULT 0, last_v INTEGER NOT NULL DEFAULT 0,
     pushed INTEGER NOT NULL DEFAULT 0, app TEXT NOT NULL DEFAULT '', revoked INTEGER NOT NULL DEFAULT 0, whatsapp INTEGER NOT NULL DEFAULT 0)`,
  `CREATE TABLE IF NOT EXISTS hub_pair (code_hash TEXT PRIMARY KEY, expires INTEGER NOT NULL, by_dev INTEGER NOT NULL)`,
  `CREATE TABLE IF NOT EXISTS hub_bases (id INTEGER PRIMARY KEY, r2_key TEXT NOT NULL, v INTEGER NOT NULL, dev INTEGER NOT NULL,
     size INTEGER NOT NULL, at INTEGER NOT NULL, kind TEXT NOT NULL DEFAULT 'base')`,
];

export const LIMITS = { pushBytes: 512 * 1024, pullRows: 400, pairMinutes: 10, keepBases: 30 };

export class HubError extends Error { constructor(message, status = 400) { super(message); this.status = status; } }

const enc = new TextEncoder();
export async function sha256Hex(text) {
  const d = await crypto.subtle.digest('SHA-256', enc.encode(String(text)));
  return [...new Uint8Array(d)].map((b) => b.toString(16).padStart(2, '0')).join('');
}
function randomToken(bytes = 32) {
  const a = new Uint8Array(bytes); crypto.getRandomValues(a);
  return [...a].map((b) => b.toString(16).padStart(2, '0')).join('');
}
const PAIR_CHARS = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789'; // no 0/O, 1/I/L
function pairCode() {
  const a = new Uint8Array(8); crypto.getRandomValues(a);
  return [...a].map((b) => PAIR_CHARS[b % PAIR_CHARS.length]).join('');
}
function safeEqual(a, b) {
  a = String(a); b = String(b);
  if (a.length !== b.length) return false;
  let r = 0; for (let i = 0; i < a.length; i++) r |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return r === 0;
}

const tokenCache = new Map(); // token hash → { dev, at } for a minute (saves a read per request)
let ready = false;
/** Creates the tables the first time in each server instance (no console steps). */
export async function ensureHub(db) {
  if (ready) return;
  await db.batch(HUB_SCHEMA.map((s) => db.prepare(s)));
  ready = true;
}
/** Tests: a new hub database. */
export function resetHubCache() { ready = false; tokenCache.clear(); }

/* ---------- devices ---------- */
export async function deviceFor(db, request) {
  const h = request.headers.get('Authorization') || '';
  const m = h.match(/^Bearer\s+([a-f0-9]{64})$/i);
  if (!m) throw new HubError('Not connected (no device key)', 401);
  const hash = await sha256Hex(m[1].toLowerCase());
  const c = tokenCache.get(hash);
  if (c && Date.now() - c.at < 60000) return c.dev;
  const dev = await db.prepare('SELECT no, name, kind, revoked FROM hub_devices WHERE token_hash = ?').bind(hash).first();
  if (!dev || dev.revoked) throw new HubError('This device was disconnected from the shop', 401);
  tokenCache.set(hash, { dev, at: Date.now() });
  return dev;
}
async function newDevice(db, { name, kind, app }) {
  const token = randomToken();
  const hash = await sha256Hex(token);
  const now = Date.now();
  // device 0 is the shop computer that has the old data; then 1, 2, …
  const row = await db.prepare(`INSERT INTO hub_devices (no, name, kind, token_hash, created_at, app)
      VALUES ((SELECT COALESCE(MAX(no) + 1, 0) FROM hub_devices), ?, ?, ?, ?, ?) RETURNING no`)
    .bind(String(name || '').slice(0, 60), String(kind || '').slice(0, 20), hash, now, String(app || '').slice(0, 40)).first();
  return { no: row.no, token };
}
/**
 * The first device of the shop (or a recovery when no device is left): needs the setup key that the owner put
 * in Cloudflare as POS_SYNC_KEY. Returns { no, token, first, v }.
 */
export async function setup(db, env, body) {
  const key = env.POS_SYNC_KEY;
  if (!key || String(key).length < 32) throw new HubError('The setup key is not in Cloudflare yet (POS_SYNC_KEY).', 503);
  if (!safeEqual(String(body.key || ''), String(key))) throw new HubError('Wrong setup key', 403);
  await ensureHub(db);
  const count = (await db.prepare('SELECT COUNT(*) n FROM hub_devices').first()).n;
  // a phone joins a shop that is already in the cloud: the shop computer always comes first (it has the data)
  if (count === 0 && body.kind === 'phone') throw new HubError('The shop computer has to connect to Kanaan Cloud first.', 409);
  const dev = await newDevice(db, body);
  const v = (await db.prepare("SELECT v FROM hub_meta WHERE k = 'v'").first()).v;
  return { ...dev, first: count === 0, v };
}
/** A connected device asks for a code to connect another one (valid 10 minutes, one use). */
export async function pairStart(db, dev) {
  const code = pairCode();
  const expires = Date.now() + LIMITS.pairMinutes * 60000;
  await db.batch([
    db.prepare('DELETE FROM hub_pair WHERE expires < ?').bind(Date.now()),
    db.prepare('INSERT INTO hub_pair (code_hash, expires, by_dev) VALUES (?, ?, ?)').bind(await sha256Hex(code), expires, dev.no),
  ]);
  return { code, expires };
}
export async function pairFinish(db, body) {
  const code = String(body.code || '').toUpperCase().replace(/[^A-Z0-9]/g, '');
  if (code.length !== 8) throw new HubError('The code has 8 letters and numbers');
  const hash = await sha256Hex(code);
  const row = await db.prepare('DELETE FROM hub_pair WHERE code_hash = ? AND expires >= ? RETURNING by_dev').bind(hash, Date.now()).first();
  if (!row) throw new HubError('This code is wrong or expired. Make a new one on the other device.', 403);
  const dev = await newDevice(db, body);
  const v = (await db.prepare("SELECT v FROM hub_meta WHERE k = 'v'").first()).v;
  return { ...dev, v, by: row.by_dev };
}
export async function listDevices(db) {
  const { results } = await db.prepare('SELECT no, name, kind, created_at, last_seen, last_v, pushed, app, revoked, whatsapp FROM hub_devices ORDER BY no').all();
  return results || [];
}
export async function revokeDevice(db, dev, no) {
  if (Number(no) === dev.no) throw new HubError("A device can't disconnect itself here");
  await db.prepare('UPDATE hub_devices SET revoked = 1, token_hash = ? WHERE no = ?').bind(`revoked-${no}-${randomToken(8)}`, Number(no)).run();
  tokenCache.clear();
  return { ok: true };
}

/* ---------- push / pull ---------- */
/**
 * rowsText = the request body: a JSON array of { t, k, at, d | p } (d = the whole row, null = deleted; p = changed columns).
 * One transaction: reserve n version numbers, write/merge the rows, note the device.
 */
export async function push(db, dev, rowsText, { app = '', whatsapp } = {}) {
  if (typeof rowsText !== 'string' || !rowsText.startsWith('[')) throw new HubError('Bad rows');
  if (rowsText.length > LIMITS.pushBytes) throw new HubError('Too many changes in one go', 413);
  const now = Date.now();
  const res = await db.batch([
    db.prepare("UPDATE hub_meta SET v = v + (SELECT COUNT(*) FROM json_each(?1)) WHERE k = 'v'").bind(rowsText),
    db.prepare(`INSERT INTO hub_rows (t, pk, d, v, dev, at, pt, ca)
        SELECT json_extract(j.value, '$.t'), json_extract(j.value, '$.k'),
               CASE WHEN json_type(j.value, '$.p') = 'object' THEN json_extract(j.value, '$.p')
                    WHEN json_type(j.value, '$.d') = 'object' THEN json_extract(j.value, '$.d') ELSE NULL END,
               (SELECT v FROM hub_meta WHERE k = 'v') - (SELECT COUNT(*) FROM json_each(?1)) + j.key + 1, ?2,
               CAST(json_extract(j.value, '$.at') AS INTEGER),
               CASE WHEN json_type(j.value, '$.p') = 'object' THEN 1 ELSE 0 END,
               CASE WHEN json_type(j.value, '$.p') = 'object' THEN (SELECT json_group_object(q.key, CAST(json_extract(j.value, '$.at') AS INTEGER)) FROM json_each(j.value, '$.p') q) ELSE NULL END
        FROM json_each(?1) j
        WHERE json_type(j.value, '$.t') = 'text' AND json_type(j.value, '$.k') = 'text' AND json_type(j.value, '$.at') = 'integer'
        ON CONFLICT (t, pk) DO UPDATE SET
          d = CASE WHEN excluded.pt = 1 THEN json_patch(hub_rows.d, (SELECT json_group_object(p.key, CASE WHEN p.type = 'object' THEN json(p.value) ELSE p.value END)
                FROM json_each(excluded.d) p WHERE excluded.at >= COALESCE(json_extract(hub_rows.ca, '$."' || p.key || '"'), hub_rows.at * (1 - hub_rows.pt))))
              ELSE excluded.d END,
          ca = CASE WHEN excluded.pt = 1 THEN json_patch(COALESCE(hub_rows.ca, '{}'), (SELECT json_group_object(p.key, excluded.at)
                FROM json_each(excluded.d) p WHERE excluded.at >= COALESCE(json_extract(hub_rows.ca, '$."' || p.key || '"'), hub_rows.at * (1 - hub_rows.pt))))
              ELSE NULL END,
          pt = CASE WHEN excluded.pt = 1 THEN hub_rows.pt ELSE 0 END,
          dev = CASE WHEN excluded.pt = 1 AND hub_rows.dev <> excluded.dev THEN -1 ELSE excluded.dev END,
          v = excluded.v,
          at = CASE WHEN excluded.pt = 1 THEN hub_rows.at ELSE excluded.at END
        WHERE (excluded.pt = 1 AND hub_rows.d IS NOT NULL) OR (excluded.pt = 0 AND (excluded.d IS NULL OR excluded.at >= hub_rows.at))`).bind(rowsText, dev.no),
    db.prepare(`UPDATE hub_devices SET last_seen = ?, pushed = pushed + (SELECT COUNT(*) FROM json_each(?)), app = CASE WHEN ? = '' THEN app ELSE ? END,
        whatsapp = COALESCE(?, whatsapp) WHERE no = ?`).bind(now, rowsText, app, app, whatsapp === undefined ? null : whatsapp ? 1 : 0, dev.no),
    db.prepare("SELECT v FROM hub_meta WHERE k = 'v'"),
  ]);
  const written = (res[1].meta && res[1].meta.changes) || 0;
  const v = res[3].results[0].v;
  return { ok: true, v, written };
}
/**
 * Everything after `since` that other devices wrote, oldest first. `next` is where to continue: when fewer rows
 * than the limit came back, everything up to the current version was seen (rows of this device are skipped).
 */
export async function pull(db, dev, since, limit = LIMITS.pullRows) {
  since = Math.max(0, Math.floor(Number(since) || 0));
  limit = Math.max(1, Math.min(LIMITS.pullRows, Math.floor(Number(limit) || LIMITS.pullRows)));
  const res = await db.batch([
    db.prepare('SELECT t, pk k, d, v, dev, at, ca FROM hub_rows WHERE v > ? ORDER BY v LIMIT ?').bind(since, limit),
    db.prepare("SELECT v FROM hub_meta WHERE k = 'v'"),
    db.prepare('UPDATE hub_devices SET last_seen = ?, last_v = ? WHERE no = ?').bind(Date.now(), since, dev.no),
  ]);
  const all = res[0].results || [];
  const top = res[1].results[0].v;
  const more = all.length === limit;
  const next = more ? all[all.length - 1].v : top;
  return { rows: all.filter((r) => r.dev !== dev.no), next, more, top };
}
export async function status(db) {
  const v = (await db.prepare("SELECT v FROM hub_meta WHERE k = 'v'").first()).v;
  const rows = (await db.prepare('SELECT COUNT(*) n FROM hub_rows').first()).n;
  const base = await db.prepare('SELECT id, v, dev, size, at, kind FROM hub_bases ORDER BY id DESC LIMIT 1').first();
  return { v, rows, base: base || null, devices: await listDevices(db), time: Date.now() };
}

/* ---------- bases (the whole database file in R2: first upload, daily backup, new devices start from it) ---------- */
export async function putBase(db, bucket, dev, { v, size, body, kind = 'base' }) {
  if (!bucket) throw new HubError('The backup storage is not set up (POS_BACKUPS)', 503);
  v = Math.max(0, Math.floor(Number(v) || 0));
  const at = Date.now();
  const key = `bases/${new Date(at).toISOString().slice(0, 10)}/${at}-d${dev.no}-v${v}-${randomToken(6)}.db.gz`;
  const put = await bucket.put(key, body, { httpMetadata: { contentType: 'application/gzip' }, customMetadata: { v: String(v), dev: String(dev.no) } });
  const realSize = (put && put.size) || Number(size) || 0;
  const row = await db.prepare('INSERT INTO hub_bases (r2_key, v, dev, size, at, kind) VALUES (?, ?, ?, ?, ?, ?) RETURNING id')
    .bind(key, v, dev.no, realSize, at, kind === 'backup' ? 'backup' : 'base').first();
  // keep the last 30 files (the newest is always kept)
  const { results: old } = await db.prepare('SELECT id, r2_key FROM hub_bases ORDER BY id DESC LIMIT 100 OFFSET ?').bind(LIMITS.keepBases).all();
  for (const o of old || []) { try { await bucket.delete(o.r2_key); } catch { /* ignore */ } }
  if (old && old.length) await db.prepare(`DELETE FROM hub_bases WHERE id IN (${old.map(() => '?').join(',')})`).bind(...old.map((o) => o.id)).run();
  return { ok: true, id: row.id, v, size: realSize };
}
export async function latestBase(db) {
  return (await db.prepare('SELECT id, r2_key, v, dev, size, at, kind FROM hub_bases ORDER BY id DESC LIMIT 1').first()) || null;
}
export async function getBase(db, bucket, id) {
  const b = id ? await db.prepare('SELECT * FROM hub_bases WHERE id = ?').bind(Number(id)).first() : await latestBase(db);
  if (!b) throw new HubError('No copy of the database in the cloud yet', 404);
  const obj = await bucket.get(b.r2_key);
  if (!obj) throw new HubError('The copy is missing from storage', 404);
  return { base: b, body: obj.body };
}

/* ---------- one router for /api/hub/* (Pages Function [[path]].js calls this) ---------- */
const json = (data, status = 200) => new Response(JSON.stringify(data), { status, headers: { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' } });
export async function handle(request, env, path) {
  const db = env.POS_DB;
  try {
    if (!db) throw new HubError('The cloud database is not connected (POS_DB).', 503);
    await ensureHub(db);
    const method = request.method;
    const url = new URL(request.url);
    if (path === 'setup' && method === 'POST') return json(await setup(db, env, await request.json()));
    if (path === 'pair' && method === 'POST') return json(await pairFinish(db, await request.json()));
    if (path === 'hello' && method === 'GET') return json({ ok: true, hub: 1, ready: !!env.POS_SYNC_KEY, backups: !!env.POS_BACKUPS, time: Date.now() });
    const dev = await deviceFor(db, request);
    if (path === 'push' && method === 'POST') {
      const text = await request.text();
      return json(await push(db, dev, text, { app: request.headers.get('X-Kanaan-App') || '', whatsapp: request.headers.has('X-Kanaan-WhatsApp') ? request.headers.get('X-Kanaan-WhatsApp') === '1' : undefined }));
    }
    if (path === 'pull' && method === 'GET') return json(await pull(db, dev, url.searchParams.get('since'), url.searchParams.get('limit')));
    if (path === 'status' && method === 'GET') return json({ ...(await status(db)), me: dev.no });
    if (path === 'pair/start' && method === 'POST') return json(await pairStart(db, dev));
    if (path === 'devices' && method === 'GET') return json({ devices: await listDevices(db), me: dev.no });
    if (path.startsWith('devices/') && path.endsWith('/revoke') && method === 'POST') return json(await revokeDevice(db, dev, path.split('/')[1]));
    if (path === 'base' && method === 'PUT') {
      return json(await putBase(db, env.POS_BACKUPS, dev, { v: url.searchParams.get('v'), kind: url.searchParams.get('kind') || 'base', size: request.headers.get('Content-Length'), body: request.body }));
    }
    if (path === 'base' && method === 'GET') return json({ base: await latestBase(db) });
    if (path === 'base/file' && method === 'GET') {
      const { base, body } = await getBase(db, env.POS_BACKUPS, url.searchParams.get('id'));
      return new Response(body, { headers: { 'Content-Type': 'application/gzip', 'Cache-Control': 'no-store', 'X-Kanaan-Base-V': String(base.v), 'X-Kanaan-Base-Id': String(base.id) } });
    }
    throw new HubError('Not found', 404);
  } catch (e) {
    const status = e instanceof HubError ? e.status : 500;
    return json({ error: e instanceof HubError ? e.message : `Cloud error: ${e && e.message ? e.message : e}` }, status);
  }
}
