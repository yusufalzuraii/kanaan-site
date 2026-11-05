import { json, rateLimit, tooManyRequests } from "../../_shared/util.js";
import { ensureSchema } from "../../_shared/site.js";
import { ensureMembers, sameKey } from "../../_shared/members.js";
import { checkPayment, checkSecond } from "../../_shared/whish.js";

/* GET or POST /api/whish/callback?o=<order>&k=<the order's key>&e=<the payment>&r=ok|no — Whish calls this when a
   payment goes through or fails. Nothing in the call is believed: the order is found by its own key (only Whish has
   the address), then Whish is asked with the shop's keys where the payment stands, and that is written down
   (functions/_shared/whish.js). A second call changes nothing; a call about another payment of an order already
   paid is asked about too (paid twice → the shop is told to send one back). */
async function handle(context) {
  const { request, env } = context;
  const limit = await rateLimit(request, env, "whishcb", 300, 60 * 60 * 1000);
  if (!limit.allowed) return tooManyRequests(limit.retryAfter);
  const u = new URL(request.url);
  const id = String(u.searchParams.get("o") || "").replace(/\D/g, "").slice(0, 12);
  const k = String(u.searchParams.get("k") || "");
  await ensureSchema(env); await ensureMembers(env);
  const row = id ? await env.DB.prepare("SELECT * FROM orders WHERE id = ?").bind(id).first() : null;
  if (!row || !row.pay_key || !sameKey(row.pay_key, k)) return json({ ok: false, error: "unknown order" }, 404);
  let after = row;
  const e = String(u.searchParams.get("e") || "").replace(/\D/g, "").slice(0, 20);
  try {
    if (row.pay_status === "paid" || row.pay_status === "late") after = await checkSecond(env, row, e, context);
    else after = await checkPayment(env, row, { force: true, ctx: context });
  } catch { /* the order page asks again */ }
  return json({ ok: true, paid: after.pay_status === "paid" || after.pay_status === "late" });
}

export const onRequestGet = handle;
export const onRequestPost = handle;
