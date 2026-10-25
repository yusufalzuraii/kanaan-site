/* Shared by the /api/pos/* endpoints: the bridge between Kanaan POS (the shop computer, the phone) and the site. */
import { json, posAuthed, rowToProduct } from "./util.js";
import { ensureSchema } from "./site.js";
import { sendPushToTokens } from "./fcm.js";
import { deviceFor, ensureHub } from "./hub.js";

/**
 * Every bridge call. Who may manage the site: any device connected to the shop's Kanaan Cloud (the computer, the
 * phone — each with its own key, revocable from the program), or the setup key itself. Then the new tables/columns
 * are made the first time. context.device = { no, name } of the device (no = -1 for the setup key).
 */
export async function guard(context) {
  const { request, env } = context;
  if (!env.DB) return json({ error: "Database not configured." }, 500);
  let device = null;
  if (posAuthed(request, env)) device = { no: -1, name: "setup key" };
  else if (env.POS_DB) {
    try { await ensureHub(env.POS_DB); const d = await deviceFor(env.POS_DB, request); if (d && !d.revoked) device = { no: d.no, name: d.name }; } catch { device = null; }
  }
  if (!device) return json({ error: "This device is not connected to the shop's Kanaan Cloud." }, 401);
  context.device = device;
  await ensureSchema(env);
  return null;
}

/**
 * Set the stock of one product from the POS: { "color|size": qty }. Absolute numbers (the POS is the owner of
 * the stock), so sending the same numbers twice changes nothing. Rows are kept at 0 (never deleted) so a sold-out
 * product stays "tracked" and never turns back into "always available". Pending website reservations are kept.
 * Returns { before, after } = pieces available before/after.
 */
export async function setStock(env, productId, quantities) {
  const { results } = await env.DB.prepare("SELECT color, size, quantity, reserved FROM variants WHERE product_id = ?").bind(productId).all();
  const cur = new Map((results || []).map((r) => [`${r.color}|${r.size}`, r]));
  const avail = (rows) => rows.reduce((a, r) => a + Math.max(0, (Number(r.quantity) || 0) - (Number(r.reserved) || 0)), 0);
  const before = avail(results || []);
  const stmts = [];
  const want = new Map();
  for (const [key, q] of Object.entries(quantities || {})) {
    const [color, size] = String(key).split("|");
    if (!color || !size) continue;
    want.set(`${color}|${size}`, Math.max(0, Math.round(Number(q) || 0)));
  }
  for (const [key, q] of want) {
    const [color, size] = key.split("|");
    if (cur.has(key)) { if (Number(cur.get(key).quantity) !== q) stmts.push(env.DB.prepare("UPDATE variants SET quantity = ? WHERE product_id = ? AND color = ? AND size = ?").bind(q, productId, color, size)); }
    else stmts.push(env.DB.prepare("INSERT INTO variants (product_id, color, size, quantity, reserved) VALUES (?,?,?,?,0)").bind(productId, color, size, q));
  }
  // a colour/size the POS no longer has (sold out and removed, or turned off): 0, kept while a reservation holds it
  for (const [key, r] of cur) {
    if (want.has(key)) continue;
    const [color, size] = key.split("|");
    if (Number(r.reserved) > 0) { if (Number(r.quantity) !== 0) stmts.push(env.DB.prepare("UPDATE variants SET quantity = 0 WHERE product_id = ? AND color = ? AND size = ?").bind(productId, color, size)); }
    else stmts.push(env.DB.prepare("DELETE FROM variants WHERE product_id = ? AND color = ? AND size = ?").bind(productId, color, size));
  }
  const total = [...want.values()].reduce((a, q) => a + q, 0);
  stmts.push(env.DB.prepare("UPDATE products SET sold_out = ? WHERE id = ?").bind(total > 0 ? 0 : 1, productId));
  await env.DB.batch(stmts);
  const after = [...want.entries()].reduce((a, [key, q]) => a + Math.max(0, q - (cur.has(key) ? Number(cur.get(key).reserved) || 0 : 0)), 0);
  return { before, after };
}

/** "Notify me when it's back": a product that had nothing available and now has something. Never blocks a sync. */
export async function restockPush(env, productId) {
  try {
    const p = await env.DB.prepare("SELECT name FROM products WHERE id = ? AND active = 1").bind(productId).first();
    if (!p) return;
    const { results } = await env.DB.prepare("SELECT token FROM restock_subscriptions WHERE product_id = ?").bind(productId).all();
    const tokens = (results || []).map((r) => r.token);
    if (!tokens.length || !env.FCM_SERVICE_ACCOUNT_JSON) return;
    await sendPushToTokens(env, tokens, { title: "Back in stock 🎉", body: `${p.name} is back — grab it before it's gone again.`, url: `/product/${productId}` });
    await env.DB.prepare("DELETE FROM restock_subscriptions WHERE product_id = ?").bind(productId).run();
  } catch { /* best effort */ }
}

export async function productWithStock(env, id) {
  const row = await env.DB.prepare("SELECT * FROM products WHERE id = ?").bind(id).first();
  if (!row) return null;
  const p = rowToProduct(row);
  const { results } = await env.DB.prepare("SELECT color, size, quantity, reserved FROM variants WHERE product_id = ?").bind(id).all();
  p.variants = Object.fromEntries((results || []).map((v) => [`${v.color}|${v.size}`, { quantity: v.quantity, reserved: v.reserved }]));
  p.posModel = row.pos_model || ""; p.source = row.source || "";
  return p;
}

/**
 * Website orders as the program needs them: each line with the program's model of its product, whether that
 * product is run from the program, and the photo of the colour ordered — so the program can match and show it.
 */
export async function withPosInfo(env, orders) {
  const ids = [...new Set(orders.flatMap((o) => (o.items || []).map((i) => i.productId)).filter(Boolean))];
  const info = {};
  for (let i = 0; i < ids.length; i += 40) {
    const chunk = ids.slice(i, i + 40);
    const rows = (await env.DB.prepare(`SELECT id, name, images, pos_model, source FROM products WHERE id IN (${chunk.map(() => "?").join(",")})`).bind(...chunk).all()).results || [];
    for (const r of rows) {
      let imgs = []; try { imgs = r.images && r.images.startsWith("[") ? JSON.parse(r.images) : String(r.images || "").split(",").map((url) => ({ url })); } catch { imgs = []; }
      info[r.id] = { posModel: r.pos_model || "", source: r.source || "", images: imgs.filter((x) => x && x.url) };
    }
  }
  for (const o of orders) for (const it of o.items || []) {
    const p = info[it.productId] || {};
    it.posModel = p.posModel || ""; it.fromPos = p.source === "pos";
    const im = (p.images || []).find((x) => x.color === it.colorKey) || (p.images || [])[0];
    it.image = im ? im.url : "";
  }
  return orders;
}
