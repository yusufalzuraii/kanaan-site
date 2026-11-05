import { json, rateLimit, tooManyRequests } from "../_shared/util.js";
import { withPosInfo } from "../_shared/pos.js";
import { ensureSchema } from "../_shared/site.js";
import { ensureMembers, sameKey, stageOf, shopNumber } from "../_shared/members.js";
import { payOf, checkPayment, holdUntil } from "../_shared/whish.js";

/* GET /api/track?id=<order number>&t=<key> — the order's own page (linked from the shop's WhatsApp messages and
   from "My Kanaan"): where it stands (received → confirmed → on its way → delivered, or cancelled) with the times,
   the pieces with their photos, the amounts. Only with the key that came with it — an order number alone shows
   nothing (they are six digits, easy to guess). No address and no phone number on it.
   An order paid with Whish says how the payment stands (pay); one still waiting for it (stage 'paying') is asked
   about at Whish on each look (at most every 4 s): the page asks every 3 s then, with &pay=1 (its own limit). */
export async function onRequestGet(context) {
  const { request, env } = context;
  const u = new URL(request.url);
  const paying = u.searchParams.get("pay") === "1";
  const limit = await rateLimit(request, env, paying ? "trackpay" : "track", paying ? 1500 : 120, 60 * 60 * 1000);
  if (!limit.allowed) return tooManyRequests(limit.retryAfter);
  const id = String(u.searchParams.get("id") || "").replace(/\D/g, "").slice(0, 12);
  const t = String(u.searchParams.get("t") || "");
  await ensureSchema(env); await ensureMembers(env);
  let o = id ? await env.DB.prepare("SELECT * FROM orders WHERE id = ?").bind(id).first() : null;
  if (!o || !sameKey(o.track, t)) return json({ error: "We couldn't find this order — open the link from our WhatsApp message again." }, 404);
  // waiting for Whish — or let go in the last day without a word from Whish (a payment whose message was lost still counts)
  const late = o.status === "expired" && o.pay === "whish" && o.pay_status !== "paid" && Date.now() - holdUntil(o) < 86400000;
  // switched to cash with a Whish link made in the last hours: a payment that went through after all is seen here too
  const after = o.pay === "cod" && o.whish_ext && !o.pay_status && Date.now() - (Number(o.whish_link_at) || 0) < 3 * 3600000;
  if (o.status === "paying" || late || after) { try { o = await checkPayment(env, o, { ctx: context }); } catch { /* asked again on the next look */ } }
  let items = []; try { items = JSON.parse(o.items || "[]"); } catch { items = []; }
  const order = { items: items.map((i) => ({ productId: i.productId, colorKey: i.colorKey, name: i.name, color: i.color, size: i.size, qty: Number(i.qty) || 1, price: Number(i.price) || 0, was: i.was || 0 })) };
  await withPosInfo(env, [order]);
  const stage = stageOf(o);
  const first = String(o.customer_name || "").trim().split(/\s+/)[0] || "";
  return json({
    id: o.id, stage, name: first, area: o.area || "",
    at: { received: Number(o.created_at) || 0, confirmed: Number(o.confirmed_at) || (o.status === "confirmed" ? Number(o.updated_at) || 0 : 0),
      shipped: Number(o.shipped_at) || 0, delivered: Number(o.delivered_at) || 0, cancelled: stage === "cancelled" ? Number(o.updated_at) || 0 : 0 },
    items: order.items.map((i) => ({ productId: i.productId, name: i.name, color: i.color, size: i.size, qty: i.qty, price: i.price, was: i.was, image: i.image || "" })),
    subtotal: Number(o.subtotal) || 0, discount: Number(o.discount) || 0, delivery: Number(o.delivery) || 0, total: Number(o.total) || 0,
    pay: payOf(o),
    shop: await shopNumber(env),
  }, 200, { "Cache-Control": "no-store" });
}
