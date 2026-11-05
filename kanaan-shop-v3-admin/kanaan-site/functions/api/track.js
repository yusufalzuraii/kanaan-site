import { json, rateLimit, tooManyRequests } from "../_shared/util.js";
import { withPosInfo } from "../_shared/pos.js";
import { ensureSchema } from "../_shared/site.js";
import { ensureMembers, sameKey, stageOf, shopNumber } from "../_shared/members.js";

/* GET /api/track?id=<order number>&t=<key> — the order's own page (linked from the shop's WhatsApp messages and
   from "My Kanaan"): where it stands (received → confirmed → on its way → delivered, or cancelled) with the times,
   the pieces with their photos, the amounts. Only with the key that came with it — an order number alone shows
   nothing (they are six digits, easy to guess). No address and no phone number on it. */
export async function onRequestGet(context) {
  const { request, env } = context;
  const limit = await rateLimit(request, env, "track", 120, 60 * 60 * 1000);
  if (!limit.allowed) return tooManyRequests(limit.retryAfter);
  const u = new URL(request.url);
  const id = String(u.searchParams.get("id") || "").replace(/\D/g, "").slice(0, 12);
  const t = String(u.searchParams.get("t") || "");
  await ensureSchema(env); await ensureMembers(env);
  const o = id ? await env.DB.prepare("SELECT * FROM orders WHERE id = ?").bind(id).first() : null;
  if (!o || !sameKey(o.track, t)) return json({ error: "We couldn't find this order — open the link from our WhatsApp message again." }, 404);
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
    shop: await shopNumber(env),
  }, 200, { "Cache-Control": "no-store" });
}
