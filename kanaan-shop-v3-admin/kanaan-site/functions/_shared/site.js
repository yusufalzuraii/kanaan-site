/* ============================================================
   KANAAN POS BRIDGE + SITE SETTINGS
   ------------------------------------------------------------
   The shop computer (Kanaan POS) is the owner of the stock: it publishes
   products with their photos, keeps every colour/size quantity up to date
   within seconds, and takes the website's orders. This file holds what the
   bridge and the storefront share:
     - ensureSchema(): new tables/columns, created by themselves the first
       time (no console steps needed)
     - categories: editable from the POS, with the built-in list as fallback
     - visit statistics: a tiny, cookie-free counter (no personal data kept)
   ============================================================ */
import { CATEGORY_IDS, CATEGORY_LABELS, SUBCATEGORIES } from "./util.js";

let schemaReady = false;
export async function ensureSchema(env) {
  if (schemaReady || !env.DB) return;
  const stmts = [
    `CREATE TABLE IF NOT EXISTS site_categories (
       id TEXT PRIMARY KEY, label TEXT NOT NULL, sort INTEGER NOT NULL DEFAULT 0,
       active INTEGER NOT NULL DEFAULT 1, grid INTEGER NOT NULL DEFAULT 1,
       subs TEXT NOT NULL DEFAULT '[]', icon TEXT NOT NULL DEFAULT '', updated_at INTEGER NOT NULL DEFAULT 0)`,
    `CREATE TABLE IF NOT EXISTS analytics_daily (
       day TEXT NOT NULL, kind TEXT NOT NULL, key TEXT NOT NULL DEFAULT '', n INTEGER NOT NULL DEFAULT 0,
       PRIMARY KEY (day, kind, key))`,
    `CREATE TABLE IF NOT EXISTS analytics_uniques (day TEXT NOT NULL, h TEXT NOT NULL, PRIMARY KEY (day, h))`,
    `CREATE TABLE IF NOT EXISTS pos_state (key TEXT PRIMARY KEY, value TEXT NOT NULL DEFAULT '')`,
    // the shop's phones that get a notification for each website order (Web Push)
    `CREATE TABLE IF NOT EXISTS pos_push (endpoint TEXT PRIMARY KEY, keys TEXT NOT NULL, device_no INTEGER, user_name TEXT NOT NULL DEFAULT '', created_at INTEGER NOT NULL DEFAULT 0, last_ok INTEGER NOT NULL DEFAULT 0, fails INTEGER NOT NULL DEFAULT 0)`,
  ];
  for (const s of stmts) await env.DB.prepare(s).run();
  // products published by the POS are marked, so the storefront and the old admin treat their stock right
  let cols = [];
  try { cols = ((await env.DB.prepare("PRAGMA table_info(products)").all()).results || []).map((c) => c.name); } catch { /* ignore */ }
  // source='pos' · pos_model = the model in the program · replaced_by = the new product an old one sends visitors to ·
  // pos_v = the Kanaan Cloud version the stock numbers reflect (an older view never overwrites a newer one)
  for (const [c, def] of [["source", "TEXT NOT NULL DEFAULT ''"], ["pos_model", "TEXT NOT NULL DEFAULT ''"], ["replaced_at", "INTEGER NOT NULL DEFAULT 0"],
    ["replaced_by", "TEXT NOT NULL DEFAULT ''"], ["pos_v", "INTEGER NOT NULL DEFAULT 0"]]) {
    if (!cols.includes(c)) { try { await env.DB.prepare(`ALTER TABLE products ADD COLUMN ${c} ${def}`).run(); } catch { /* added by a parallel request */ } }
  }
  // website orders handled in the program: which device took it, the invoice it became
  let ocols = [];
  try { ocols = ((await env.DB.prepare("PRAGMA table_info(orders)").all()).results || []).map((c) => c.name); } catch { /* ignore */ }
  for (const [c, def] of [["claimed_by", "INTEGER"], ["claimed_at", "INTEGER NOT NULL DEFAULT 0"], ["pos_sale", "TEXT NOT NULL DEFAULT ''"], ["pos_note", "TEXT NOT NULL DEFAULT ''"]]) {
    if (!ocols.includes(c)) { try { await env.DB.prepare(`ALTER TABLE orders ADD COLUMN ${c} ${def}`).run(); } catch { /* parallel */ } }
  }
  schemaReady = true;
}

/* ---------- categories ---------- */
const BUILT_IN = () => CATEGORY_IDS.map((id, i) => ({
  id, label: CATEGORY_LABELS[id] || id, sort: (i + 1) * 10, active: 1, grid: id === "oldmoney" ? 0 : 1, subs: SUBCATEGORIES[id] || [], icon: "",
}));
let catCache = null; let catAt = 0;
export function forgetCategories() { catCache = null; }

function shape(list) {
  const sorted = [...list].sort((a, b) => a.sort - b.sort || a.label.localeCompare(b.label));
  return {
    list: sorted,
    ids: sorted.map((c) => c.id),
    labels: Object.fromEntries(sorted.map((c) => [c.id, c.label])),
    subs: Object.fromEntries(sorted.map((c) => [c.id, c.subs || []])),
  };
}
/** Categories (cached for a minute in each server instance). Never fails: falls back to the built-in list. */
export async function loadCategories(env) {
  if (catCache && Date.now() - catAt < 60000) return catCache;
  let rows = [];
  try {
    await ensureSchema(env);
    rows = (await env.DB.prepare("SELECT * FROM site_categories").all()).results || [];
  } catch { rows = []; }
  let list;
  if (!rows.length) list = BUILT_IN();
  else list = rows.map((r) => {
    let subs = []; try { subs = JSON.parse(r.subs || "[]"); } catch { subs = []; }
    return { id: r.id, label: r.label, sort: Number(r.sort) || 0, active: Number(r.active) ? 1 : 0, grid: Number(r.grid) ? 1 : 0, subs: Array.isArray(subs) ? subs : [], icon: r.icon || "" };
  });
  catCache = shape(list); catAt = Date.now();
  return catCache;
}
const slug = (s) => String(s || "").toLowerCase().trim().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "").slice(0, 40);
/** Replace the whole list (from the POS). A category that still has products can't be removed (hide it instead). */
export async function saveCategories(env, input) {
  await ensureSchema(env);
  const seen = new Set(); const list = [];
  for (const [i, c] of (Array.isArray(input) ? input : []).entries()) {
    const id = slug(c.id || c.label);
    const label = String(c.label || "").trim().slice(0, 60);
    if (!id || !label || seen.has(id)) continue;
    seen.add(id);
    const subs = (Array.isArray(c.subs) ? c.subs : []).map((s) => ({ id: slug(s.id || s.label), label: String(s.label || "").trim().slice(0, 40) })).filter((s) => s.id && s.label);
    list.push({ id, label, sort: Number.isFinite(Number(c.sort)) ? Number(c.sort) : (i + 1) * 10, active: c.active === false || c.active === 0 ? 0 : 1, grid: c.grid === false || c.grid === 0 ? 0 : 1, subs, icon: String(c.icon || "").slice(0, 20) });
  }
  if (!list.length) throw new Error("At least one category is needed.");
  const current = (await env.DB.prepare("SELECT id FROM site_categories").all()).results || [];
  const before = current.length ? current.map((r) => r.id) : CATEGORY_IDS;
  for (const id of before) {
    if (seen.has(id)) continue;
    const used = await env.DB.prepare("SELECT COUNT(*) n FROM products WHERE category = ? AND active = 1").bind(id).first();
    if (used && used.n > 0) throw new Error(`"${id}" still has ${used.n} products on the site: hide it instead of removing it.`);
  }
  const now = Date.now();
  const stmts = [env.DB.prepare("DELETE FROM site_categories")];
  for (const c of list) stmts.push(env.DB.prepare("INSERT INTO site_categories (id,label,sort,active,grid,subs,icon,updated_at) VALUES (?,?,?,?,?,?,?,?)")
    .bind(c.id, c.label, c.sort, c.active, c.grid, JSON.stringify(c.subs), c.icon, now));
  await env.DB.batch(stmts);
  forgetCategories();
  return loadCategories(env);
}

/* ---------- visit statistics ---------- */
const BOT = /bot|crawl|spider|slurp|facebookexternalhit|whatsapp|preview|headless|lighthouse|pingdom|uptime/i;
export function beirutDay(ts = Date.now()) {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Beirut", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date(ts));
}
/** Beirut's offset from UTC at that moment, in minutes: +180 in summer, +120 in winter (Lebanon changes the clock). */
function beirutOffset(ts) {
  const p = new Intl.DateTimeFormat("en-US", { timeZone: "Asia/Beirut", hourCycle: "h23", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", second: "2-digit" }).formatToParts(new Date(ts));
  const g = (t) => Number((p.find((x) => x.type === t) || {}).value || 0);
  return Math.round((Date.UTC(g("year"), g("month") - 1, g("day"), g("hour") % 24, g("minute"), g("second")) - Math.floor(ts / 1000) * 1000) / 60000);
}
/** The moment a Beirut clock time happens ("2026-10-29", "23:59:59") — with that day's own offset, summer or winter. */
export function beirutMoment(day, hms) {
  const asIfUtc = Date.parse(`${day}T${hms}Z`);
  const first = asIfUtc - beirutOffset(asIfUtc) * 60000;
  return asIfUtc - beirutOffset(first) * 60000;
}
function sourceOf(ref, utm) {
  const s = `${utm || ""} ${ref || ""}`.toLowerCase();
  if (!s.trim()) return "direct";
  if (s.includes("instagram") || s.includes("ig")) return "instagram";
  if (s.includes("facebook") || s.includes("fb.")) return "facebook";
  if (s.includes("tiktok")) return "tiktok";
  if (s.includes("whatsapp") || s.includes("wa.me")) return "whatsapp";
  if (s.includes("google")) return "google";
  if (s.includes("bing") || s.includes("yahoo") || s.includes("duckduckgo")) return "search";
  if (s.includes("kanaanshop.com")) return "direct";
  return "other";
}
async function sha(text) {
  const d = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(text));
  return [...new Uint8Array(d)].slice(0, 12).map((b) => b.toString(16).padStart(2, "0")).join("");
}
const KINDS = new Set(["pv", "product", "cart", "checkout", "order", "search"]);
/**
 * One event from the storefront. Visitors are counted once a day by a one-way fingerprint that changes every
 * day (nothing personal is stored). Bots are ignored.
 */
export async function recordHit(env, request, ev) {
  const ua = request.headers.get("User-Agent") || "";
  if (!ua || BOT.test(ua)) return false;
  const kind = String(ev.kind || "");
  if (!KINDS.has(kind)) return false;
  await ensureSchema(env);
  const day = beirutDay();
  const ip = request.headers.get("CF-Connecting-IP") || "";
  const h = await sha(`${day}|${ip}|${ua}|${env.POS_SYNC_KEY || "kanaan"}`);
  const bump = (k, key) => env.DB.prepare("INSERT INTO analytics_daily (day,kind,key,n) VALUES (?,?,?,1) ON CONFLICT(day,kind,key) DO UPDATE SET n = n + 1").bind(day, k, String(key || "").slice(0, 80));
  const stmts = [];
  if (kind === "pv") {
    const path = String(ev.path || "/").split("?")[0];
    const page = path.startsWith("/product/") ? "/product" : path.startsWith("/shop/") ? path.split("/").slice(0, 3).join("/") : path.slice(0, 40);
    stmts.push(bump("pv", page));
    const fresh = await env.DB.prepare("INSERT OR IGNORE INTO analytics_uniques (day,h) VALUES (?,?)").bind(day, h).run();
    if (fresh.meta && fresh.meta.changes) {
      stmts.push(bump("visitors", ""));
      stmts.push(bump("src", sourceOf(ev.ref, ev.utm)));
      stmts.push(bump("dev", ev.app ? "app" : /mobile|android|iphone/i.test(ua) ? "mobile" : "desktop"));
    }
  } else {
    stmts.push(bump(kind, kind === "search" ? String(ev.key || "").toLowerCase().trim() : ev.key || ""));
  }
  if (stmts.length) await env.DB.batch(stmts);
  return true;
}
/** Everything the POS shows on its "Website" page for these days. */
export async function statsBetween(env, from, to) {
  await ensureSchema(env);
  const rows = (await env.DB.prepare("SELECT day, kind, key, n FROM analytics_daily WHERE day BETWEEN ? AND ?").bind(from, to).all()).results || [];
  const days = {}; const sum = (k) => rows.filter((r) => r.kind === k).reduce((a, r) => a + r.n, 0);
  for (const r of rows) {
    if (!days[r.day]) days[r.day] = { day: r.day, pv: 0, visitors: 0, product: 0, cart: 0, checkout: 0, order: 0 };
    if (r.kind in days[r.day]) days[r.day][r.kind] += r.n;
  }
  const top = (k, n = 10) => Object.entries(rows.filter((r) => r.kind === k).reduce((a, r) => ({ ...a, [r.key]: (a[r.key] || 0) + r.n }), {})).sort((a, b) => b[1] - a[1]).slice(0, n).map(([key, n2]) => ({ key, n: n2 }));
  const topProducts = top("product", 12);
  if (topProducts.length) {
    const ids = topProducts.map((t) => t.key);
    const names = (await env.DB.prepare(`SELECT id, name, images, pos_model FROM products WHERE id IN (${ids.map(() => "?").join(",")})`).bind(...ids).all()).results || [];
    for (const t of topProducts) { const p = names.find((x) => x.id === t.key); t.name = p ? p.name : t.key; t.posModel = p ? p.pos_model : ""; t.carts = rows.filter((r) => r.kind === "cart" && r.key === t.key).reduce((a, r) => a + r.n, 0); }
  }
  // the shop's days, Beirut time: +03:00 in summer, +02:00 in winter (a fixed +03:00 lost the last hour of every winter day)
  const start = beirutMoment(from, "00:00:00"); const end = beirutMoment(to, "23:59:59") + 999;
  const orders = (await env.DB.prepare("SELECT status, COUNT(*) n, COALESCE(SUM(total),0) t FROM orders WHERE created_at BETWEEN ? AND ? GROUP BY status").bind(start, end).all()).results || [];
  return {
    from, to,
    totals: { pv: sum("pv"), visitors: sum("visitors"), product: sum("product"), cart: sum("cart"), checkout: sum("checkout"), order: sum("order") },
    days: Object.values(days).sort((a, b) => a.day.localeCompare(b.day)),
    pages: top("pv", 12), sources: top("src", 10), devices: top("dev", 5), searches: top("search", 10), topProducts, orders,
  };
}
