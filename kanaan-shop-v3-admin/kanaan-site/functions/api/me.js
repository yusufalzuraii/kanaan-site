import { json } from "../_shared/util.js";
import { withPosInfo } from "../_shared/pos.js";
import { ensureSchema } from "../_shared/site.js";
import { ensureMembers, sessionPhone, endSession, clearSessionCookie, maskPhone, touchAccount, ordersOfPhone, photoOf, stageOf } from "../_shared/members.js";
import { parsePhone } from "../_shared/phone.js";

/* GET /api/me — the signed-in shopper ("My Kanaan"): { phone (masked), pretty, name, orders (on the site, newest
   first, each with where it stands and its own page), shop (what Kanaan POS sent from their file at the shop:
   since, visits, the pieces they bought there), asks (the sizes they wait for) } or { signedIn: false }.
   PUT /api/me { name?, likes?, bag? } — their name; the pieces they liked and their bag (so the shop's program
   shows them in the customer's file). DELETE /api/me — signs out on this device. */
export async function onRequestGet(context) {
  const { request, env } = context;
  await ensureSchema(env); await ensureMembers(env);
  const phone = await sessionPhone(env, request);
  if (!phone) return json({ signedIn: false });
  const acc = await env.DB.prepare("SELECT * FROM site_accounts WHERE phone = ?").bind(phone).first();
  const pretty = (parsePhone(`+${phone}`) || {}).pretty || `+${phone}`;
  const q = ordersOfPhone(phone);
  const rows = ((await env.DB.prepare(`SELECT * FROM orders WHERE ${q.where} ORDER BY created_at DESC LIMIT 30`).bind(...q.binds).all()).results) || [];
  const orders = rows.map((o) => {
    let items = []; try { items = JSON.parse(o.items || "[]"); } catch { items = []; }
    return { id: o.id, stage: stageOf(o), total: Number(o.total) || 0, at: Number(o.created_at) || 0, track: o.track || "",
      pieces: items.reduce((a, i) => a + (Number(i.qty) || 1), 0), items: items.slice(0, 8).map((i) => ({ productId: i.productId, colorKey: i.colorKey, name: i.name, size: i.size, color: i.color, qty: i.qty })) };
  });
  await withPosInfo(env, orders);
  for (const o of orders) for (const i of o.items) { delete i.posModel; delete i.fromPos; }
  const asks = ((await env.DB.prepare(`SELECT a.id, a.product_id, a.color, a.size, a.created_at, a.notified_at, p.name, p.images FROM restock_asks a
    LEFT JOIN products p ON p.id = a.product_id WHERE a.phone = ? AND a.cancelled_at = 0 ORDER BY a.created_at DESC LIMIT 20`).bind(phone).all()).results || [])
    .map((a) => ({ id: a.id, productId: a.product_id, name: a.name || "", colorKey: a.color, size: a.size, at: a.created_at, back: !!a.notified_at, image: photoOf(a.images, a.color) }));
  let shop = null; try { shop = acc && acc.card ? JSON.parse(acc.card) : null; } catch { shop = null; }
  await touchAccount(env, phone);
  const firstName = (acc && acc.name) || (shop && shop.name) || (rows[0] && rows[0].customer_name) || "";
  return json({ signedIn: true, phone: maskPhone(phone), pretty, name: firstName, since: acc ? acc.created_at : Date.now(), orders, shop, asks });
}

const cleanLikes = (v) => (Array.isArray(v) ? v : []).map((x) => String(x || "").slice(0, 120)).filter(Boolean).slice(0, 60);
const cleanBag = (v) => (Array.isArray(v) ? v : []).slice(0, 30).map((x) => ({
  productId: String((x && x.productId) || "").slice(0, 120), colorKey: String((x && x.colorKey) || "").slice(0, 40),
  size: String((x && x.size) || "").slice(0, 20), qty: Math.max(1, Math.min(99, Math.round(Number(x && x.qty) || 1))),
})).filter((x) => x.productId);

export async function onRequestPut(context) {
  const { request, env } = context;
  const phone = await sessionPhone(env, request);
  if (!phone) return json({ error: "Sign in first" }, 401);
  let body = {}; try { body = await request.json(); } catch { return json({ error: "bad json" }, 400); }
  const sets = []; const binds = []; const out = {};
  if ("name" in body) { out.name = String(body.name || "").replace(/\s+/g, " ").trim().slice(0, 60); sets.push("name = ?"); binds.push(out.name); }
  if ("likes" in body) { sets.push("likes = ?"); binds.push(JSON.stringify(cleanLikes(body.likes))); }
  if ("bag" in body) { sets.push("bag = ?"); binds.push(JSON.stringify(cleanBag(body.bag))); }
  if (!sets.length) return json({ ok: true });
  await env.DB.prepare(`UPDATE site_accounts SET ${sets.join(", ")}, updated_at = ? WHERE phone = ?`).bind(...binds, Date.now(), phone).run();
  return json({ ok: true, ...out });
}

export async function onRequestDelete(context) {
  const { request, env } = context;
  await endSession(env, request);
  return json({ ok: true }, 200, { "Set-Cookie": clearSessionCookie() });
}
