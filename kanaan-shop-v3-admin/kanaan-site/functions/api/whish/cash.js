import { json, rateLimit, tooManyRequests } from "../../_shared/util.js";
import { ensureSchema } from "../../_shared/site.js";
import { ensureMembers, sameKey } from "../../_shared/members.js";
import { checkPayment, tellShop } from "../../_shared/whish.js";

/* POST /api/whish/cash { id, t } — "Pay cash at the door instead" on the order's page (the Whish payment didn't go
   through, or they'd rather not): Whish is asked first (a payment that went through counts), then the order goes
   to the shop as cash on delivery, with the pieces it already holds. → { ok } | { paid: true } */
export async function onRequestPost(context) {
  const { request, env } = context;
  const limit = await rateLimit(request, env, "whishcash", 30, 60 * 60 * 1000);
  if (!limit.allowed) return tooManyRequests(limit.retryAfter);
  let body = {};
  try { body = await request.json(); } catch { return json({ error: "bad json" }, 400); }
  const id = String(body.id || "").replace(/\D/g, "").slice(0, 12);
  await ensureSchema(env); await ensureMembers(env);
  let row = id ? await env.DB.prepare("SELECT * FROM orders WHERE id = ?").bind(id).first() : null;
  if (!row || !sameKey(row.track, String(body.t || ""))) return json({ error: "We couldn't find this order." }, 404);
  if (row.pay_status === "paid") return json({ ok: true, paid: true });
  if (row.status !== "paying") return json({ error: row.status === "expired" ? "This order's time ran out, so its pieces went back. Put them in your bag again to order." : "This order is already with the shop." }, 409);
  try { row = await checkPayment(env, row, { force: true, ctx: context }); } catch { /* switched all the same */ }
  if (row.pay_status === "paid") return json({ ok: true, paid: true });
  const now = Date.now();
  const won = await env.DB.prepare(`UPDATE orders SET pay = 'cod', pay_status = '', whish_url = '', status = 'pending', created_at = ?, updated_at = ?
    WHERE id = ? AND status = 'paying' AND pay_status <> 'paid' RETURNING *`).bind(now, now, row.id).first();
  if (!won) return json({ error: "This order changed — open its page again." }, 409);
  await tellShop(env, won, context);
  return json({ ok: true });
}
