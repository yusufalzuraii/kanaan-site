/* ============================================================
   WHAT SHOPPERS DO ON THE SITE — for the shop's own program
   (Kanaan POS → Website → Visitors, on the computer and the phone)
   ------------------------------------------------------------
   The storefront sends what each visit does, in small batches: the pages and the time spent on each (and how far
   down they scrolled), the pieces opened, colours and sizes picked, photos opened, likes and unlikes, what went
   into the bag and what came out, searches (and how many pieces they found), filters, the checkout, the order,
   WhatsApp and share taps.

   Anonymous: a visitor is a random number kept on their device. No name, phone, address or IP address is kept
   (the city comes from Cloudflare; the IP itself is never written). The shop's own phones are not counted.
   Details are kept 90 days; the daily totals (analytics_daily) and each piece's daily figures (ins_pday) stay.

   The free plan (100,000 rows written a day): a batch is ONE row (its events together), the visit ONE row
   updated in place, a few daily counters — about 8 rows a batch. Past 5,000 batches in a day only the counts
   are kept (no more step-by-step detail that day), so the site never runs out.
   ============================================================ */
import { ensureSchema, beirutDay } from "./site.js";

const DAY = 86400000;
export const KEEP_DAYS = 90;
export const DAILY_DETAIL_CAP = 5000;
/** The actions the storefront may send (anything else is dropped). */
export const KINDS = new Set([
  "view", "time", "product", "color", "size_open", "size", "guide", "photo", "like", "unlike",
  "add", "remove", "qty", "cart_open", "search", "filter", "wa", "share", "checkout", "order", "promo",
]);
const BOT = /bot|crawl|spider|slurp|facebookexternalhit|preview|headless|lighthouse|pingdom|uptime|python|curl|wget/i;
const ID = /^[a-z0-9]{8,32}$/;

let ready = false;
export async function ensureInsight(env) {
  if (ready || !env.DB) return;
  await ensureSchema(env);
  const stmts = [
    // a visit: who (a number), from where, on what, and what it came to (kept up to date as it goes)
    `CREATE TABLE IF NOT EXISTS ins_sessions (
       sid TEXT PRIMARY KEY, vid TEXT NOT NULL, start_at INTEGER NOT NULL, last_at INTEGER NOT NULL, last_b INTEGER NOT NULL DEFAULT 0,
       landing TEXT NOT NULL DEFAULT '', src TEXT NOT NULL DEFAULT '', ref TEXT NOT NULL DEFAULT '', utm TEXT NOT NULL DEFAULT '',
       dev TEXT NOT NULL DEFAULT '', os TEXT NOT NULL DEFAULT '', br TEXT NOT NULL DEFAULT '', city TEXT NOT NULL DEFAULT '',
       country TEXT NOT NULL DEFAULT '', lang TEXT NOT NULL DEFAULT '', w INTEGER NOT NULL DEFAULT 0, fresh INTEGER NOT NULL DEFAULT 0,
       pages INTEGER NOT NULL DEFAULT 0, evs INTEGER NOT NULL DEFAULT 0, active_ms INTEGER NOT NULL DEFAULT 0,
       products INTEGER NOT NULL DEFAULT 0, sized INTEGER NOT NULL DEFAULT 0, likes INTEGER NOT NULL DEFAULT 0,
       adds INTEGER NOT NULL DEFAULT 0, removes INTEGER NOT NULL DEFAULT 0, checkout INTEGER NOT NULL DEFAULT 0,
       ord TEXT NOT NULL DEFAULT '', cur TEXT NOT NULL DEFAULT '', cur_pid TEXT NOT NULL DEFAULT '')`,
    "CREATE INDEX IF NOT EXISTS idx_ins_sessions_start ON ins_sessions (start_at)",
    "CREATE INDEX IF NOT EXISTS idx_ins_sessions_vid ON ins_sessions (vid)",
    // what a visit did, a batch at a time: e = [[at, kind, path, piece, colour, size, q, v, x], …]
    `CREATE TABLE IF NOT EXISTS ins_batches (id INTEGER PRIMARY KEY AUTOINCREMENT, at INTEGER NOT NULL, sid TEXT NOT NULL, vid TEXT NOT NULL,
       n INTEGER NOT NULL DEFAULT 0, e TEXT NOT NULL DEFAULT '[]')`,
    "CREATE INDEX IF NOT EXISTS idx_ins_batches_sid ON ins_batches (sid)",
    // what is in each visitor's bag right now (gone when it is emptied or ordered): items = [[piece, colour, size, qty, price], …]
    `CREATE TABLE IF NOT EXISTS ins_carts (vid TEXT PRIMARY KEY, sid TEXT NOT NULL, items TEXT NOT NULL DEFAULT '[]', pieces INTEGER NOT NULL DEFAULT 0,
       value INTEGER NOT NULL DEFAULT 0, created_at INTEGER NOT NULL, updated_at INTEGER NOT NULL)`,
    // each visitor's liked pieces now (an unlike takes it out)
    "CREATE TABLE IF NOT EXISTS ins_likes (vid TEXT NOT NULL, pid TEXT NOT NULL, at INTEGER NOT NULL, PRIMARY KEY (vid, pid))",
    "CREATE INDEX IF NOT EXISTS idx_ins_likes_pid ON ins_likes (pid)",
    // each piece's day: kept for good (a row per piece touched that day)
    `CREATE TABLE IF NOT EXISTS ins_pday (day TEXT NOT NULL, pid TEXT NOT NULL, views INTEGER NOT NULL DEFAULT 0, view_ms INTEGER NOT NULL DEFAULT 0,
       likes INTEGER NOT NULL DEFAULT 0, unlikes INTEGER NOT NULL DEFAULT 0, adds INTEGER NOT NULL DEFAULT 0, removes INTEGER NOT NULL DEFAULT 0,
       sizes INTEGER NOT NULL DEFAULT 0, photos INTEGER NOT NULL DEFAULT 0, PRIMARY KEY (day, pid))`,
  ];
  for (const s of stmts) await env.DB.prepare(s).run();
  ready = true;
}

/** What a browser says about itself → phone / tablet / desktop / app, its system and browser (Instagram's own…). */
export function deviceOf(ua, app) {
  const u = String(ua || "");
  const os = /iPhone|iPad|iPod/i.test(u) ? "iOS" : /Android/i.test(u) ? "Android" : /Windows/i.test(u) ? "Windows" : /Mac OS X|Macintosh/i.test(u) ? "Mac" : /Linux|CrOS/i.test(u) ? "Linux" : "Other";
  const tablet = /iPad|Tablet/i.test(u) || (/Android/i.test(u) && !/Mobile/i.test(u));
  const dev = app ? "app" : tablet ? "tablet" : /Mobi|iPhone|Android/i.test(u) ? "phone" : "desktop";
  const br = /Instagram/i.test(u) ? "Instagram" : /FBAN|FBAV|FB_IAB|FBIOS/i.test(u) ? "Facebook" : /TikTok|musical_ly|Bytedance/i.test(u) ? "TikTok"
    : /WhatsApp/i.test(u) ? "WhatsApp" : /EdgA?\/|EdgiOS/i.test(u) ? "Edge" : /SamsungBrowser/i.test(u) ? "Samsung" : /OPR\/|Opera/i.test(u) ? "Opera"
      : /CriOS|Chrome\//i.test(u) ? "Chrome" : /FxiOS|Firefox/i.test(u) ? "Firefox" : /Safari/i.test(u) ? "Safari" : app ? "Kanaan app" : "Other";
  return { dev, os, br };
}
/** Where a visit came from: the link's ?utm_source / ?ref first, then the page that sent it. */
export function sourceOf(ref, utm) {
  const s = `${utm || ""} ${ref || ""}`.toLowerCase();
  if (!s.trim()) return "direct";
  if (s.includes("instagram") || /(^|\W)ig(\W|$)/.test(s)) return "instagram";
  if (s.includes("facebook") || s.includes("fb.") || /(^|\W)fb(\W|$)/.test(s)) return "facebook";
  if (s.includes("tiktok")) return "tiktok";
  if (s.includes("whatsapp") || s.includes("wa.me")) return "whatsapp";
  if (s.includes("google")) return "google";
  if (s.includes("bing") || s.includes("yahoo") || s.includes("duckduckgo")) return "search";
  if (s.includes("kanaanshop")) return "direct";
  return "other";
}
const str = (v, n) => String(v == null ? "" : v).replace(/[\u0000-\u001f]/g, " ").trim().slice(0, n);
const int = (v, lo, hi) => { const n = Math.round(Number(v)); return Number.isFinite(n) ? Math.min(hi, Math.max(lo, n)) : 0; };
const host = (ref) => { try { return new URL(ref).hostname.replace(/^www\./, "").slice(0, 60); } catch { return ""; } };
const pathOnly = (p) => str(p, 160).split("#")[0];

/** One event as the storefront sent it → the event kept: { at, k, p, pid, c, s, q, v, x } (or null). */
export function cleanEvent(e, shift, now) {
  if (!e || typeof e !== "object") return null;
  const k = str(e.k, 16);
  if (!KINDS.has(k)) return null;
  let at = Math.round(Number(e.t) || 0) + shift;
  if (!(at > now - 6 * 3600000) || at > now + 60000) at = now; // a clock far off: when it arrived
  return {
    at, k, p: pathOnly(e.p), pid: str(e.id, 60), c: str(e.c, 30), s: str(e.s, 16),
    q: int(e.q, -999, 999), v: int(e.v, 0, k === "time" ? 3600000 : 100000000), x: str(e.x, 80),
  };
}
const pack = (e) => [e.at, e.k, e.p, e.pid, e.c, e.s, e.q, e.v, e.x];
export const unpack = (a) => ({ at: a[0], k: a[1], p: a[2], pid: a[3], c: a[4], s: a[5], q: a[6], v: a[7], x: a[8] });

/**
 * A batch from one visit — { v: visitor, s: visit, b: the batch's number in the visit (1, 2, …), nv: 1 for a new
 * visitor, now: the browser's clock, info (with the first batch): { landing, ref, utm, w, lang, app },
 * e: [events], cart: [[piece, colour, size, qty, price], …] (the bag now, when it changed) }.
 */
export async function recordBatch(env, request, body) {
  const ua = request.headers.get("User-Agent") || "";
  if (!ua || BOT.test(ua)) return { ok: false, why: "bot" };
  const vid = String(body.v || ""); const sid = String(body.s || "");
  if (!ID.test(vid) || !ID.test(sid)) return { ok: false, why: "id" };
  const b = int(body.b, 1, 100000) || 1;
  await ensureInsight(env);
  const db = env.DB;
  const now = Date.now();
  const day = beirutDay(now);
  const shift = Number.isFinite(Number(body.now)) && Math.abs(now - Number(body.now)) > 120000 ? now - Number(body.now) : 0;
  const evs = (Array.isArray(body.e) ? body.e : []).slice(0, 60).map((e) => cleanEvent(e, shift, now)).filter(Boolean).sort((a, z) => a.at - z.at);
  const info = body.info && typeof body.info === "object" ? body.info : null;

  // the same batch twice (a retry, a page closing): counted once
  const [had, capRow] = await Promise.all([
    db.prepare("SELECT vid, last_b FROM ins_sessions WHERE sid = ?").bind(sid).first(),
    db.prepare("SELECT n FROM analytics_daily WHERE day = ? AND kind = 'ins_b' AND key = ''").bind(day).first(),
  ]);
  if (had && (had.vid !== vid || b <= Number(had.last_b))) return { ok: true, dup: true };
  const detail = !capRow || Number(capRow.n) < DAILY_DETAIL_CAP;
  const stmts = [];

  // ---- the visit ----
  const isNew = !had;
  const ref = info ? str(info.ref, 300) : "";
  const utm = info ? str(info.utm, 60) : "";
  const d = deviceOf(ua, info && info.app);
  if (isNew) {
    const cf = request.cf || {};
    const firstView = evs.find((e) => e.k === "view");
    stmts.push(db.prepare(`INSERT OR IGNORE INTO ins_sessions (sid, vid, start_at, last_at, landing, src, ref, utm, dev, os, br, city, country, lang, w, fresh)
      VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`).bind(sid, vid, evs.length ? evs[0].at : now, now,
      info && info.landing ? pathOnly(info.landing) : firstView ? firstView.p : "", sourceOf(ref, utm), host(ref), utm, d.dev, d.os, d.br,
      str(cf.city, 40), str(cf.country, 4), info ? str(info.lang, 12) : "", info ? int(info.w, 0, 9999) : 0, body.nv ? 1 : 0));
  }
  const n = (k) => evs.filter((e) => e.k === k).length;
  const views = evs.filter((e) => e.k === "view");
  const ms = evs.filter((e) => e.k === "time").reduce((a, e) => a + e.v, 0);
  // where they are now: the last page (its piece, once the page knows it)
  const lastView = [...evs].reverse().find((e) => e.k === "view" || e.k === "product");
  const order = evs.find((e) => e.k === "order");
  stmts.push(db.prepare(`UPDATE ins_sessions SET last_at = ?, last_b = MAX(last_b, ?), pages = pages + ?, evs = evs + ?, active_ms = active_ms + ?,
      products = products + ?, sized = sized + ?, likes = likes + ?, adds = adds + ?, removes = removes + ?, checkout = MAX(checkout, ?),
      ord = CASE WHEN ? <> '' THEN ? ELSE ord END, cur = CASE WHEN ? = 1 THEN ? ELSE cur END, cur_pid = CASE WHEN ? = 1 THEN ? ELSE cur_pid END
      WHERE sid = ?`)
    .bind(now, b, views.length, evs.length, ms, n("product"), n("size"), n("like"), n("add"), n("remove"), n("checkout") || order ? 1 : 0,
      order ? order.x || "yes" : "", order ? order.x || "yes" : "", lastView ? 1 : 0, lastView ? lastView.p : "", lastView ? 1 : 0, lastView ? lastView.pid : "", sid));

  // ---- the step-by-step (one row for the batch) ----
  if (detail && evs.length) stmts.push(db.prepare("INSERT INTO ins_batches (at, sid, vid, n, e) VALUES (?,?,?,?,?)").bind(now, sid, vid, evs.length, JSON.stringify(evs.map(pack))));

  // ---- each piece's day ----
  const pd = new Map();
  const bumpP = (pid, f, by = 1) => {
    if (!pid) return;
    const r = pd.get(pid) || { views: 0, view_ms: 0, likes: 0, unlikes: 0, adds: 0, removes: 0, sizes: 0, photos: 0 };
    r[f] += by; pd.set(pid, r);
  };
  for (const e of evs) {
    if (e.k === "product") bumpP(e.pid, "views");
    else if (e.k === "time" && e.pid) bumpP(e.pid, "view_ms", e.v);
    else if (e.k === "like") bumpP(e.pid, "likes");
    else if (e.k === "unlike") bumpP(e.pid, "unlikes");
    else if (e.k === "add") bumpP(e.pid, "adds", Math.max(1, e.q));
    else if (e.k === "remove") bumpP(e.pid, "removes", Math.max(1, e.q));
    else if (e.k === "size") bumpP(e.pid, "sizes");
    else if (e.k === "photo") bumpP(e.pid, "photos");
  }
  const prow = [...pd.entries()];
  for (let i = 0; i < prow.length; i += 9) {
    const part = prow.slice(i, i + 9);
    stmts.push(db.prepare(`INSERT INTO ins_pday (day, pid, views, view_ms, likes, unlikes, adds, removes, sizes, photos) VALUES ${part.map(() => "(?,?,?,?,?,?,?,?,?,?)").join(",")}
      ON CONFLICT(day, pid) DO UPDATE SET views = views + excluded.views, view_ms = view_ms + excluded.view_ms, likes = likes + excluded.likes,
      unlikes = unlikes + excluded.unlikes, adds = adds + excluded.adds, removes = removes + excluded.removes, sizes = sizes + excluded.sizes, photos = photos + excluded.photos`)
      .bind(...part.flatMap(([pid, r]) => [day, pid, r.views, r.view_ms, r.likes, r.unlikes, r.adds, r.removes, r.sizes, r.photos])));
  }

  // ---- the day's totals (the figures the Website page always had keep counting the same way) ----
  const daily = new Map();
  const bump = (kind, key = "", by = 1) => { const k = `${kind}\u0001${String(key).slice(0, 80)}`; daily.set(k, (daily.get(k) || 0) + by); };
  bump("ins_b");
  if (isNew) { bump("visits"); if (!body.nv) bump("returning"); }
  for (const e of evs) {
    if (e.k === "view") {
      const path = e.p.split("?")[0] || "/";
      bump("pv", path.startsWith("/product/") ? "/product" : path.startsWith("/shop/") ? path.split("/").slice(0, 3).join("/") : path.slice(0, 40));
    } else if (e.k === "product") bump("product", e.pid);
    else if (e.k === "add") bump("cart", e.pid);
    else if (e.k === "remove") bump("cart_rm", e.pid);
    else if (e.k === "like") bump("like", e.pid);
    else if (e.k === "unlike") bump("unlike", e.pid);
    else if (e.k === "checkout") bump("checkout");
    else if (e.k === "order") bump("order", e.x);
    else if (e.k === "search") { bump("search", e.x.toLowerCase()); if (e.v === 0) bump("search0", e.x.toLowerCase()); }
    else if (e.k === "time") bump("active_ms", "", e.v);
    else if (e.k === "wa") bump("wa", e.x);
    else if (e.k === "share") bump("share", e.pid);
  }
  // a visitor counted once a day (as before), with where they came from and on what
  if (isNew) {
    const fresh = await db.prepare("INSERT OR IGNORE INTO analytics_uniques (day, h) VALUES (?, ?)").bind(day, `v:${vid}`).run();
    if (fresh.meta && fresh.meta.changes) { bump("visitors"); bump("src", sourceOf(ref, utm)); bump("dev", d.dev === "phone" || d.dev === "tablet" ? "mobile" : d.dev); }
  }
  const drow = [...daily.entries()];
  for (let i = 0; i < drow.length; i += 25) {
    const part = drow.slice(i, i + 25);
    stmts.push(db.prepare(`INSERT INTO analytics_daily (day, kind, key, n) VALUES ${part.map(() => "(?,?,?,?)").join(",")} ON CONFLICT(day, kind, key) DO UPDATE SET n = n + excluded.n`)
      .bind(...part.flatMap(([k, by]) => { const [kind, key] = k.split("\u0001"); return [day, kind, key, by]; })));
  }

  // ---- likes now ----
  for (const e of evs) {
    if (e.k === "like" && e.pid) stmts.push(db.prepare("INSERT OR REPLACE INTO ins_likes (vid, pid, at) VALUES (?,?,?)").bind(vid, e.pid, e.at));
    else if (e.k === "unlike" && e.pid) stmts.push(db.prepare("DELETE FROM ins_likes WHERE vid = ? AND pid = ?").bind(vid, e.pid));
  }
  // ---- the bag now ----
  if (Array.isArray(body.cart)) {
    const items = body.cart.slice(0, 20).map((r) => (Array.isArray(r) ? [str(r[0], 60), str(r[1], 30), str(r[2], 16), int(r[3], 1, 99), int(r[4], 0, 100000)] : null)).filter((r) => r && r[0]);
    if (!items.length || order) stmts.push(db.prepare("DELETE FROM ins_carts WHERE vid = ?").bind(vid));
    else {
      stmts.push(db.prepare(`INSERT INTO ins_carts (vid, sid, items, pieces, value, created_at, updated_at) VALUES (?,?,?,?,?,?,?)
        ON CONFLICT(vid) DO UPDATE SET sid = excluded.sid, items = excluded.items, pieces = excluded.pieces, value = excluded.value, updated_at = excluded.updated_at`)
        .bind(vid, sid, JSON.stringify(items), items.reduce((a, r) => a + r[3], 0), items.reduce((a, r) => a + r[3] * r[4], 0), now, now));
    }
  } else if (order) stmts.push(db.prepare("DELETE FROM ins_carts WHERE vid = ?").bind(vid));
  await db.batch(stmts);
  await prune(env, now);
  return { ok: true, n: evs.length, detail };
}

/** Once a day: step-by-step older than 90 days goes (a little at a time), bags untouched for 30 days, likes after a year. */
export async function prune(env, now = Date.now(), force = false) {
  const day = beirutDay(now);
  if (!force) {
    const row = await env.DB.prepare("SELECT value FROM pos_state WHERE key = 'ins_pruned'").first().catch(() => null);
    if (row && row.value === day) return;
    await env.DB.prepare("INSERT INTO pos_state (key, value) VALUES ('ins_pruned', ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value").bind(day).run();
  }
  const old = now - KEEP_DAYS * DAY;
  // the oldest rows come first by number: only those are looked at, never the whole table
  await env.DB.batch([
    env.DB.prepare("DELETE FROM ins_batches WHERE id IN (SELECT id FROM ins_batches ORDER BY id LIMIT 3000) AND at < ?").bind(old),
    env.DB.prepare("DELETE FROM ins_sessions WHERE sid IN (SELECT sid FROM ins_sessions WHERE start_at < ? ORDER BY start_at LIMIT 2000)").bind(old),
    env.DB.prepare("DELETE FROM ins_carts WHERE updated_at < ?").bind(now - 30 * DAY),
    env.DB.prepare("DELETE FROM ins_likes WHERE at < ?").bind(now - 365 * DAY),
  ]).catch(() => {});
}

/* ---------- what the program reads ---------- */
const pct = (a, b) => (b ? Math.round((a / b) * 1000) / 10 : 0);
const firstImage = (raw) => {
  try { const a = JSON.parse(raw || "[]"); const f = a[0]; return typeof f === "string" ? f : (f && (f.thumb || f.url)) || ""; } catch { return String(raw || "").split(",")[0].trim(); }
};
async function names(env, ids) {
  const list = [...new Set(ids.filter(Boolean))].slice(0, 90);
  if (!list.length) return new Map();
  const rows = (await env.DB.prepare(`SELECT id, name, price, images, pos_model, badge, discount FROM products WHERE id IN (${list.map(() => "?").join(",")})`).bind(...list).all()).results || [];
  return new Map(rows.map((r) => [r.id, { name: r.name, price: Number(r.price) || 0, image: firstImage(r.images), model: r.pos_model || "", sale: r.badge === "sale" ? Number(r.discount) || 0 : 0 }]));
}
const parse = (raw, dflt) => { try { return JSON.parse(raw); } catch { return dflt; } };
/** The newest batches, a bounded few (never the whole table): the last `limit` by number, from `since`. */
async function recentBatches(env, limit, since) {
  return (await env.DB.prepare("SELECT id, at, sid, vid, e FROM ins_batches WHERE id > (SELECT IFNULL(MAX(id), 0) - ? FROM ins_batches) AND at >= ? ORDER BY id DESC")
    .bind(limit, since).all()).results || [];
}

/** The days from → to (Beirut): visits, time, the way to an order, the pieces, where people come from. */
export async function insightsBetween(env, from, to, startMs, endMs) {
  await ensureInsight(env);
  const db = env.DB;
  const S = (await db.prepare(`SELECT COUNT(*) AS visits, COUNT(DISTINCT vid) AS visitors, SUM(fresh) AS fresh,
      SUM(active_ms) AS ms, SUM(pages) AS pages, SUM(CASE WHEN pages <= 1 AND active_ms < 10000 AND adds = 0 THEN 1 ELSE 0 END) AS bounce,
      SUM(CASE WHEN products > 0 THEN 1 ELSE 0 END) AS f_product, SUM(CASE WHEN sized > 0 THEN 1 ELSE 0 END) AS f_size,
      SUM(CASE WHEN adds > 0 THEN 1 ELSE 0 END) AS f_add, SUM(checkout) AS f_checkout, SUM(CASE WHEN ord <> '' THEN 1 ELSE 0 END) AS f_order,
      SUM(likes) AS likes, SUM(adds) AS adds, SUM(removes) AS removes
    FROM ins_sessions WHERE start_at BETWEEN ? AND ?`).bind(startMs, endMs).first()) || {};
  const visits = Number(S.visits) || 0;
  const sess = (await db.prepare("SELECT start_at, src, dev, os, br, city, ord FROM ins_sessions WHERE start_at BETWEEN ? AND ?").bind(startMs, endMs).all()).results || [];
  const group = (col) => {
    const m = new Map();
    for (const s of sess) { const k = s[col] || "—"; const r = m.get(k) || { key: k, n: 0, orders: 0 }; r.n += 1; if (s.ord) r.orders += 1; m.set(k, r); }
    return [...m.values()].sort((a, b) => b.n - a.n).slice(0, 12);
  };
  const hourOf = new Intl.DateTimeFormat("en-GB", { timeZone: "Asia/Beirut", hour: "2-digit", hourCycle: "h23" });
  const hours = Array(24).fill(0);
  for (const s of sess) hours[Number(hourOf.format(new Date(s.start_at))) % 24] += 1;
  const daysRows = (await db.prepare(`SELECT day, kind, key, n FROM analytics_daily WHERE day BETWEEN ? AND ?
      AND kind IN ('visits','visitors','order','like','cart','cart_rm','search','search0','wa','share')`).bind(from, to).all()).results || [];
  const byDay = {};
  for (const r of daysRows) {
    const dd = byDay[r.day] || (byDay[r.day] = { day: r.day, visits: 0, visitors: 0, orders: 0, likes: 0, adds: 0, removes: 0 });
    if (r.kind === "visits") dd.visits += r.n; else if (r.kind === "visitors") dd.visitors += r.n; else if (r.kind === "order") dd.orders += r.n;
    else if (r.kind === "like") dd.likes += r.n; else if (r.kind === "cart") dd.adds += r.n; else if (r.kind === "cart_rm") dd.removes += r.n;
  }
  const top = (kind, n = 12) => Object.entries(daysRows.filter((r) => r.kind === kind).reduce((a, r) => ({ ...a, [r.key]: (a[r.key] || 0) + r.n }), {}))
    .sort((a, b) => b[1] - a[1]).slice(0, n).map(([key, n2]) => ({ key, n: n2 }));
  // the pieces: their days added up, likes held now, in bags now, ordered
  const P = (await db.prepare(`SELECT pid, SUM(views) AS views, SUM(view_ms) AS view_ms, SUM(likes) AS likes, SUM(unlikes) AS unlikes, SUM(adds) AS adds,
      SUM(removes) AS removes, SUM(sizes) AS sizes, SUM(photos) AS photos FROM ins_pday WHERE day BETWEEN ? AND ? GROUP BY pid ORDER BY views DESC LIMIT 60`).bind(from, to).all()).results || [];
  const likedNow = new Map(((await db.prepare("SELECT pid, COUNT(*) AS n FROM ins_likes GROUP BY pid ORDER BY n DESC LIMIT 60").all()).results || []).map((r) => [r.pid, Number(r.n)]));
  const inBags = new Map();
  for (const c of (await db.prepare("SELECT items FROM ins_carts").all()).results || []) for (const it of parse(c.items, [])) inBags.set(it[0], (inBags.get(it[0]) || 0) + Number(it[3] || 1));
  const ordered = new Map();
  for (const o of (await db.prepare("SELECT items FROM orders WHERE created_at BETWEEN ? AND ? AND status NOT IN ('cancelled','rejected','expired')").bind(startMs, endMs).all()).results || []) {
    for (const it of parse(o.items, [])) ordered.set(it.productId, (ordered.get(it.productId) || 0) + Number(it.qty || 1));
  }
  const ids = [...new Set([...P.map((r) => r.pid), ...likedNow.keys(), ...inBags.keys(), ...ordered.keys()])];
  const nm = await names(env, ids);
  const byPid = new Map(P.map((r) => [r.pid, r]));
  const pieces = ids.filter((pid) => nm.has(pid)).map((pid) => {
    const r = byPid.get(pid) || {};
    const views = Number(r.views) || 0;
    return { id: pid, ...nm.get(pid), views, avgMs: views ? Math.round((Number(r.view_ms) || 0) / views) : 0,
      likes: Number(r.likes) || 0, unlikes: Number(r.unlikes) || 0, likedNow: likedNow.get(pid) || 0, adds: Number(r.adds) || 0, removes: Number(r.removes) || 0,
      sizes: Number(r.sizes) || 0, photos: Number(r.photos) || 0, inBags: inBags.get(pid) || 0, ordered: ordered.get(pid) || 0 };
  });
  // what came out of bags (the newest first), from the step-by-step
  const removed = [];
  for (const bt of await recentBatches(env, 1500, startMs)) {
    if (bt.at > endMs + 60000) continue;
    for (const a of parse(bt.e, []).reverse()) { const e = unpack(a); if (e.k === "remove") removed.push({ ...e, sid: bt.sid, vid: bt.vid }); }
    if (removed.length >= 40) break;
  }
  const rmNames = await names(env, removed.map((r) => r.pid));
  // the newest visits of these days, to open one and follow it step by step
  const recent = (await db.prepare(`SELECT sid, vid, start_at, last_at, landing, src, dev, os, br, city, pages, active_ms, products, likes, adds, removes, checkout, ord, cur, fresh
      FROM ins_sessions WHERE start_at BETWEEN ? AND ? ORDER BY start_at DESC LIMIT 60`).bind(startMs, endMs).all()).results || [];
  return {
    from, to,
    totals: {
      visits, visitors: Number(S.visitors) || 0, newVisitors: Number(S.fresh) || 0, returning: Math.max(0, (Number(S.visitors) || 0) - (Number(S.fresh) || 0)),
      avgMs: visits ? Math.round((Number(S.ms) || 0) / visits) : 0, pagesPerVisit: visits ? Math.round(((Number(S.pages) || 0) / visits) * 10) / 10 : 0,
      bounceRate: pct(Number(S.bounce) || 0, visits), likes: Number(S.likes) || 0, adds: Number(S.adds) || 0, removes: Number(S.removes) || 0,
      orders: Number(S.f_order) || 0, conversion: pct(Number(S.f_order) || 0, visits),
    },
    funnel: [
      { key: "visit", n: visits }, { key: "piece", n: Number(S.f_product) || 0 }, { key: "size", n: Number(S.f_size) || 0 },
      { key: "bag", n: Number(S.f_add) || 0 }, { key: "checkout", n: Number(S.f_checkout) || 0 }, { key: "order", n: Number(S.f_order) || 0 },
    ],
    days: Object.values(byDay).sort((a, b) => a.day.localeCompare(b.day)), hours,
    sources: group("src"), devices: group("dev"), systems: group("os"), browsers: group("br"), cities: group("city"),
    searches: top("search", 15), noResults: top("search0", 10), whatsapp: top("wa", 6),
    pieces, removed: removed.slice(0, 40).map((r) => ({ ...r, piece: rmNames.get(r.pid) || null })), recent,
  };
}

/** Right now: who is on the site (the last 5 minutes), what they are doing, what sits in bags, the newest steps. */
export async function insightsLive(env) {
  await ensureInsight(env);
  const db = env.DB;
  const now = Date.now();
  const batches = await recentBatches(env, 150, now - 2 * DAY);
  const onSids = [...new Set(batches.filter((bt) => bt.at > now - 5 * 60000).map((bt) => bt.sid))].slice(0, 40);
  const carts = ((await db.prepare("SELECT vid, sid, items, pieces, value, created_at, updated_at FROM ins_carts").all()).results || []).sort((a, z) => z.updated_at - a.updated_at).slice(0, 40);
  const feed = [];
  for (const bt of batches) { for (const a of parse(bt.e, []).reverse()) feed.push({ ...unpack(a), sid: bt.sid, vid: bt.vid }); if (feed.length >= 80) break; }
  feed.sort((a, z) => z.at - a.at);
  const allSids = [...new Set([...onSids, ...carts.map((c) => c.sid), ...feed.map((f) => f.sid)])].slice(0, 90);
  const sess = new Map(allSids.length ? ((await db.prepare(`SELECT sid, vid, start_at, last_at, landing, src, dev, os, br, city, pages, active_ms, products, likes, adds, removes, checkout, ord, cur, cur_pid, fresh
      FROM ins_sessions WHERE sid IN (${allSids.map(() => "?").join(",")})`).bind(...allSids).all()).results || []).map((s) => [s.sid, s]) : []);
  const on = onSids.map((sid) => sess.get(sid)).filter(Boolean).sort((a, z) => z.last_at - a.last_at);
  const items = carts.map((c) => parse(c.items, []));
  const nm = await names(env, [...on.map((s) => s.cur_pid), ...items.flat().map((it) => it[0]), ...feed.map((f) => f.pid)]);
  const about = (sid) => { const s = sess.get(sid) || {}; return { src: s.src || "", dev: s.dev || "", city: s.city || "" }; };
  return {
    at: now,
    now: on.map((s) => ({ ...s, piece: s.cur_pid ? nm.get(s.cur_pid) || null : null })),
    carts: carts.map((c, i) => ({ vid: c.vid, sid: c.sid, pieces: c.pieces, value: c.value, since: c.created_at, at: c.updated_at, ...about(c.sid),
      items: items[i].map((it) => ({ id: it[0], color: it[1], size: it[2], qty: it[3], price: it[4], name: (nm.get(it[0]) || {}).name || it[0], image: (nm.get(it[0]) || {}).image || "" })) })),
    feed: feed.slice(0, 60).map((f) => ({ ...f, piece: nm.get(f.pid) || null, ...about(f.sid) })),
  };
}

/** One visit from its first step to its last; and the same visitor's other visits, likes and bag. */
export async function insightsVisit(env, sid) {
  await ensureInsight(env);
  const db = env.DB;
  const s = await db.prepare("SELECT * FROM ins_sessions WHERE sid = ?").bind(String(sid || "")).first();
  if (!s) return null;
  const evs = [];
  for (const bt of (await db.prepare("SELECT e FROM ins_batches WHERE sid = ? ORDER BY id LIMIT 200").bind(s.sid).all()).results || []) for (const a of parse(bt.e, [])) evs.push(unpack(a));
  evs.sort((a, z) => a.at - z.at);
  const others = (await db.prepare("SELECT sid, start_at, last_at, src, dev, pages, active_ms, adds, ord FROM ins_sessions WHERE vid = ? ORDER BY start_at DESC LIMIT 20").bind(s.vid).all()).results || [];
  const liked = (await db.prepare("SELECT pid, at FROM ins_likes WHERE vid = ? ORDER BY at DESC LIMIT 30").bind(s.vid).all()).results || [];
  const cart = await db.prepare("SELECT items, value, updated_at FROM ins_carts WHERE vid = ?").bind(s.vid).first();
  const cartItems = cart ? parse(cart.items, []) : [];
  const nm = await names(env, [...evs.map((e) => e.pid), ...liked.map((l) => l.pid), ...cartItems.map((it) => it[0])]);
  return {
    visit: s, events: evs.slice(0, 800).map((e) => ({ ...e, piece: nm.get(e.pid) || null })), visits: others,
    liked: liked.map((l) => ({ id: l.pid, at: l.at, ...(nm.get(l.pid) || { name: l.pid }) })),
    cart: cart ? { value: cart.value, at: cart.updated_at, items: cartItems.map((it) => ({ id: it[0], color: it[1], size: it[2], qty: it[3], price: it[4], ...(nm.get(it[0]) || { name: it[0] }) })) } : null,
  };
}
