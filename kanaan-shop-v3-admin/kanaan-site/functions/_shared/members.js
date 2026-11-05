/* ============================================================
   THE SHOP'S CUSTOMERS ON THE SITE — a number proven by WhatsApp
   ------------------------------------------------------------
   A shopper proves a phone number is theirs with one tap: the site
   gives a code, WhatsApp opens with "KANAAN 123456" written to the
   shop's number, they press send. The shop computer's WhatsApp
   (Kanaan POS) reads it and tells the site (POST /api/pos/verify);
   the page that was waiting goes on by itself. Nothing to type, no
   SMS to pay for, and nobody can use a number that isn't theirs.

   Used for:
   - the shopper's own account ("My Kanaan": their orders on the
     site, what they bought in the shop — sent by Kanaan POS from
     the customer's file — and their size requests), kept by a
     cookie (180 days);
   - "Tell me when my size is back" (restock_asks), answered on
     WhatsApp by the shop computer when the size is in stock again;
   - the order's own page (/order/<number>?t=…) linked from the
     WhatsApp messages about the order.
   ============================================================ */
import { parsePhone } from "./phone.js";

let ready = false;
export async function ensureMembers(env) {
  if (ready || !env.DB) return;
  const stmts = [
    `CREATE TABLE IF NOT EXISTS verify_codes (
       code TEXT PRIMARY KEY, token TEXT NOT NULL UNIQUE, purpose TEXT NOT NULL, payload TEXT NOT NULL DEFAULT '{}',
       created_at INTEGER NOT NULL, expires_at INTEGER NOT NULL, phone TEXT NOT NULL DEFAULT '', verified_at INTEGER NOT NULL DEFAULT 0)`,
    `CREATE TABLE IF NOT EXISTS site_accounts (
       phone TEXT PRIMARY KEY, name TEXT NOT NULL DEFAULT '', created_at INTEGER NOT NULL, last_seen INTEGER NOT NULL DEFAULT 0,
       card TEXT NOT NULL DEFAULT '', card_at INTEGER NOT NULL DEFAULT 0,
       likes TEXT NOT NULL DEFAULT '[]', bag TEXT NOT NULL DEFAULT '[]', updated_at INTEGER NOT NULL DEFAULT 0)`,
    `CREATE INDEX IF NOT EXISTS idx_accounts_updated ON site_accounts (updated_at)`,
    `CREATE TABLE IF NOT EXISTS site_sessions (token TEXT PRIMARY KEY, phone TEXT NOT NULL, created_at INTEGER NOT NULL, expires_at INTEGER NOT NULL)`,
    `CREATE INDEX IF NOT EXISTS idx_sessions_phone ON site_sessions (phone)`,
    `CREATE TABLE IF NOT EXISTS restock_asks (
       id TEXT PRIMARY KEY, product_id TEXT NOT NULL, color TEXT NOT NULL DEFAULT '', size TEXT NOT NULL DEFAULT '', phone TEXT NOT NULL,
       created_at INTEGER NOT NULL, notified_at INTEGER NOT NULL DEFAULT 0, cancelled_at INTEGER NOT NULL DEFAULT 0,
       UNIQUE (product_id, color, size, phone))`,
    `CREATE INDEX IF NOT EXISTS idx_asks_open ON restock_asks (notified_at, cancelled_at)`,
    `CREATE INDEX IF NOT EXISTS idx_asks_phone ON restock_asks (phone)`,
  ];
  for (const s of stmts) await env.DB.prepare(s).run();
  // the order's own page: a private key in its link; when it left with the driver, when it was delivered
  let ocols = [];
  try { ocols = ((await env.DB.prepare("PRAGMA table_info(orders)").all()).results || []).map((c) => c.name); } catch { /* ignore */ }
  // (no orders table yet — a site that never had an order: its own code makes it, with these, later)
  for (const [c, def] of ocols.length ? [["track", "TEXT NOT NULL DEFAULT ''"], ["confirmed_at", "INTEGER NOT NULL DEFAULT 0"], ["shipped_at", "INTEGER NOT NULL DEFAULT 0"], ["delivered_at", "INTEGER NOT NULL DEFAULT 0"]] : []) {
    if (!ocols.includes(c)) { try { await env.DB.prepare(`ALTER TABLE orders ADD COLUMN ${c} ${def}`).run(); } catch { /* parallel */ } }
  }
  ready = ocols.length > 0; // looked again next time until the orders table exists
}

const b64url = (bytes) => btoa(String.fromCharCode(...bytes)).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
export const randomToken = (n = 24) => b64url(crypto.getRandomValues(new Uint8Array(n)));
const sixDigits = () => String(100000 + (crypto.getRandomValues(new Uint32Array(1))[0] % 900000));

export const VERIFY_MINUTES = 15;
export const SESSION_DAYS = 180;
export const PURPOSES = ["login", "notify"];

/** The shop's WhatsApp number the codes go to: the one linked in Kanaan POS (sent with its status), else the site's. */
export async function shopNumber(env) {
  try {
    const r = await env.DB.prepare("SELECT value FROM pos_state WHERE key = 'wa_number'").first();
    const d = r && String(r.value || "").replace(/\D/g, "");
    if (d && d.length >= 8) return d;
  } catch { /* not yet */ }
  return "96181445681";
}

/** A new code for this purpose; the page keeps the token to ask how it went. */
export async function startVerify(env, purpose, payload = {}) {
  await ensureMembers(env);
  const now = Date.now();
  await env.DB.prepare("DELETE FROM verify_codes WHERE expires_at < ?").bind(now - 86400000).run();
  for (let i = 0; i < 6; i++) {
    const code = sixDigits(); const token = randomToken(18);
    try {
      await env.DB.prepare("INSERT INTO verify_codes (code, token, purpose, payload, created_at, expires_at) VALUES (?, ?, ?, ?, ?, ?)")
        .bind(code, token, purpose, JSON.stringify(payload || {}).slice(0, 2000), now, now + VERIFY_MINUTES * 60000).run();
      return { code, token, expiresAt: now + VERIFY_MINUTES * 60000 };
    } catch { /* that code is taken: another */ }
  }
  throw new Error("Try again in a moment");
}

/** The shop computer read "KANAAN <code>" from this number: the code is proven (once). */
export async function confirmVerify(env, code, phoneDigits) {
  await ensureMembers(env);
  const c = String(code || "").replace(/\D/g, "");
  const ph = parsePhone(`+${String(phoneDigits || "").replace(/\D/g, "")}`);
  if (!c || !ph) return { ok: false, reason: "bad" };
  const row = await env.DB.prepare("SELECT * FROM verify_codes WHERE code = ?").bind(c).first();
  if (!row) return { ok: false, reason: "unknown" };
  if (row.verified_at) return { ok: row.phone === ph.e164, reason: row.phone === ph.e164 ? "again" : "taken", purpose: row.purpose, payload: safeJson(row.payload), phone: row.phone };
  if (row.expires_at < Date.now()) return { ok: false, reason: "expired" };
  await env.DB.prepare("UPDATE verify_codes SET phone = ?, verified_at = ? WHERE code = ? AND verified_at = 0").bind(ph.e164, Date.now(), c).run();
  const payload = safeJson(row.payload);
  let extra = {};
  if (row.purpose === "notify") extra = await addAsk(env, ph.e164, payload);
  if (row.purpose === "login" || row.purpose === "notify") await touchAccount(env, ph.e164, payload.name);
  return { ok: true, purpose: row.purpose, payload, phone: ph.e164, pretty: ph.pretty, ...extra };
}

const safeJson = (s) => { try { const v = JSON.parse(s || "{}"); return v && typeof v === "object" ? v : {}; } catch { return {}; } };

/** Where a code stands, for the page waiting on it; a proven login code opens a session (once). */
export async function verifyStatus(env, token) {
  await ensureMembers(env);
  const row = await env.DB.prepare("SELECT * FROM verify_codes WHERE token = ?").bind(String(token || "")).first();
  if (!row) return { state: "unknown" };
  if (row.verified_at) return { state: "verified", purpose: row.purpose, phone: row.phone, masked: maskPhone(row.phone), verifiedAt: row.verified_at };
  if (row.expires_at < Date.now()) return { state: "expired" };
  return { state: "waiting", purpose: row.purpose, expiresAt: row.expires_at };
}

export function maskPhone(e164) {
  const d = String(e164 || "");
  if (d.startsWith("961") && d.length >= 10) { const n = d.slice(3); return `+961 ${n.slice(0, n.length - 6 > 0 ? n.length - 6 : 1)} ••• ${n.slice(-3)}`; }
  return d ? `+${d.slice(0, 3)} ••• ${d.slice(-3)}` : "";
}

export async function touchAccount(env, phone, name = "") {
  const now = Date.now();
  await env.DB.prepare(`INSERT INTO site_accounts (phone, name, created_at, last_seen, updated_at) VALUES (?, ?, ?, ?, ?)
    ON CONFLICT(phone) DO UPDATE SET last_seen = excluded.last_seen,
      updated_at = CASE WHEN site_accounts.name = '' AND excluded.name <> '' THEN excluded.updated_at ELSE site_accounts.updated_at END,
      name = CASE WHEN site_accounts.name = '' THEN excluded.name ELSE site_accounts.name END`)
    .bind(phone, String(name || "").trim().slice(0, 60), now, now, now).run();
}

export async function newSession(env, phone) {
  const token = randomToken(32); const now = Date.now();
  await env.DB.prepare("INSERT INTO site_sessions (token, phone, created_at, expires_at) VALUES (?, ?, ?, ?)").bind(token, phone, now, now + SESSION_DAYS * 86400000).run();
  return token;
}
export const SESSION_COOKIE = "kanaan_s";
export function sessionCookie(token, request) {
  const secure = new URL(request.url).protocol === "https:" ? "; Secure" : "";
  return `${SESSION_COOKIE}=${token}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${SESSION_DAYS * 86400}${secure}`;
}
export function clearSessionCookie() { return `${SESSION_COOKIE}=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0`; }
function cookieOf(request, name) {
  const raw = request.headers.get("Cookie") || "";
  for (const part of raw.split(/;\s*/)) { const i = part.indexOf("="); if (i > 0 && part.slice(0, i) === name) return part.slice(i + 1); }
  return "";
}
/** The signed-in shopper's number (from the cookie), else null. */
export async function sessionPhone(env, request) {
  await ensureMembers(env);
  const t = cookieOf(request, SESSION_COOKIE);
  if (!t) return null;
  const row = await env.DB.prepare("SELECT phone, expires_at FROM site_sessions WHERE token = ?").bind(t).first();
  if (!row || row.expires_at < Date.now()) return null;
  return row.phone;
}
export async function endSession(env, request) {
  const t = cookieOf(request, SESSION_COOKIE);
  if (t) await env.DB.prepare("DELETE FROM site_sessions WHERE token = ?").bind(t).run();
}

/** "Tell me when it's back": one ask per piece, colour, size and number (asking again keeps the first). */
export async function addAsk(env, phone, { productId, color, size } = {}) {
  const pid = String(productId || "").slice(0, 120); const c = String(color || "").slice(0, 40); const s = String(size || "").slice(0, 12);
  if (!pid || !s) return {};
  const p = await env.DB.prepare("SELECT id, name FROM products WHERE id = ? AND active = 1").bind(pid).first();
  if (!p) return {};
  await env.DB.prepare(`INSERT INTO restock_asks (id, product_id, color, size, phone, created_at) VALUES (?, ?, ?, ?, ?, ?)
    ON CONFLICT(product_id, color, size, phone) DO UPDATE SET cancelled_at = 0, notified_at = 0, created_at = CASE WHEN restock_asks.notified_at > 0 OR restock_asks.cancelled_at > 0 THEN excluded.created_at ELSE restock_asks.created_at END`)
    .bind(crypto.randomUUID(), pid, c, s, phone, Date.now()).run();
  return { ask: { productId: pid, name: p.name, color: c, size: s } };
}

/** The order's own page: its private key (made once; old orders get one the first time the shop needs it). */
export async function ensureTrack(env, orderId) {
  await ensureMembers(env);
  const row = await env.DB.prepare("SELECT track FROM orders WHERE id = ?").bind(String(orderId)).first();
  if (!row) return "";
  if (row.track) return row.track;
  const t = randomToken(12);
  await env.DB.prepare("UPDATE orders SET track = ? WHERE id = ? AND track = ''").bind(t, String(orderId)).run();
  const again = await env.DB.prepare("SELECT track FROM orders WHERE id = ?").bind(String(orderId)).first();
  return (again && again.track) || t;
}

/** Same length, every byte compared (a key in a link is not guessed one letter at a time). */
export function sameKey(a, b) {
  const x = String(a || ""); const y = String(b || "");
  if (!x || x.length !== y.length) return false;
  let d = 0; for (let i = 0; i < x.length; i++) d |= x.charCodeAt(i) ^ y.charCodeAt(i);
  return d === 0;
}

/** Where an order stands, in the shopper's words: received → confirmed → on its way → delivered (or cancelled). */
export function stageOf(o) {
  if (o.status === "cancelled" || o.status === "expired") return "cancelled";
  if (Number(o.delivered_at)) return "delivered";
  if (Number(o.shipped_at)) return "shipped";
  if (o.status === "confirmed") return "confirmed";
  return "received";
}

/** Every way the shop may have written this number on an order (digits only): 96170123456, 70123456, 070123456. */
export function phoneForms(e164) {
  const d = String(e164 || "");
  if (!d.startsWith("961")) return [d, `00${d}`];
  const n = d.slice(3);
  return [d, n, `0${n}`, `00${d}`];
}
/** The SQL that finds this number's orders whichever way it was written. */
export function ordersOfPhone(e164) {
  const forms = phoneForms(e164);
  return { where: `REPLACE(REPLACE(REPLACE(REPLACE(phone, ' ', ''), '-', ''), '+', ''), '.', '') IN (${forms.map(() => "?").join(",")})`, binds: forms };
}

/** The photo of a piece in this colour (the site keeps them as [{url, color}]). */
export function photoOf(images, colorKey) {
  let im = [];
  try { im = images && String(images).startsWith("[") ? JSON.parse(images) : String(images || "").split(",").filter(Boolean).map((url) => ({ url })); } catch { im = []; }
  const f = im.find((x) => x && x.color === colorKey) || im.find((x) => x && x.url);
  return f ? f.url : "";
}
