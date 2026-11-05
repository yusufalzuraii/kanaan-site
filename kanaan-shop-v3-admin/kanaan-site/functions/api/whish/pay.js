import { json, rateLimit, tooManyRequests } from "../../_shared/util.js";
import { ensureSchema } from "../../_shared/site.js";
import { ensureMembers, sameKey } from "../../_shared/members.js";
import { loadSettings } from "../../_shared/settings.js";
import { checkPayment, createPayment, whishOn, holdUntil, HOLD_MIN, MAX_TRIES, LINK_OPEN_MS } from "../../_shared/whish.js";

/* POST /api/whish/pay { id, t } — "Pay with Whish" again on the order's page (the last try failed, or its page was
   closed): Whish is asked first (it may be paid already). The link still open (not failed, less than 10 minutes old)
   is given again — never two open at once (a second payment would go unseen) — else a new one is made, which keeps
   the pieces 15 minutes more (up to an hour from the order). → { url } | { paid: true } */
export async function onRequestPost(context) {
  const { request, env } = context;
  const limit = await rateLimit(request, env, "whishpay", 30, 60 * 60 * 1000);
  if (!limit.allowed) return tooManyRequests(limit.retryAfter, "That's a lot of tries — pay cash at your door instead, or message us on WhatsApp.");
  let body = {};
  try { body = await request.json(); } catch { return json({ error: "bad json" }, 400); }
  const id = String(body.id || "").replace(/\D/g, "").slice(0, 12);
  await ensureSchema(env); await ensureMembers(env);
  let row = id ? await env.DB.prepare("SELECT * FROM orders WHERE id = ?").bind(id).first() : null;
  if (!row || !sameKey(row.track, String(body.t || ""))) return json({ error: "We couldn't find this order." }, 404);
  if (row.pay_status === "paid") return json({ ok: true, paid: true });
  if (row.status !== "paying") return json({ error: row.status === "expired" ? "This order's time ran out, so its pieces went back. Put them in your bag again to order." : "This order is no longer waiting for a payment." }, 409);
  try { row = await checkPayment(env, row, { force: true, ctx: context }); } catch { /* asked below anyway */ }
  if (row.pay_status === "paid") return json({ ok: true, paid: true });
  const now0 = Date.now();
  if (row.pay_status !== "failed" && row.whish_url && now0 - (Number(row.whish_link_at) || 0) < LINK_OPEN_MS) return json({ ok: true, url: row.whish_url, again: true });
  const tries = String(row.whish_ext || "").split(",").filter(Boolean).length;
  if (tries >= MAX_TRIES) return json({ error: "That's a lot of tries for one order — pay cash at your door instead, or message us on WhatsApp.", tooMany: true }, 429);
  let settings = null; try { settings = await loadSettings(env); } catch { settings = null; }
  if (!whishOn(env, settings)) return json({ error: "Whish isn't available right now — pay cash at your door instead.", whishOff: true }, 409);
  let made;
  try { made = await createPayment(env, request, { id: row.id, total: row.total, track: row.track, payKey: row.pay_key }); } catch {
    return json({ error: "Whish isn't answering right now. Try again in a minute, or pay cash at your door.", whishDown: true }, 502);
  }
  const now = Date.now();
  const until = Math.min((Number(row.created_at) || now) + 2 * HOLD_MIN * 60000, Math.max(holdUntil(row), now + 15 * 60000));
  const won = await env.DB.prepare(`UPDATE orders SET whish_ext = CASE WHEN whish_ext = '' THEN ? ELSE whish_ext || ',' || ? END, whish_url = ?, whish_link_at = ?, pay_status = 'waiting', pay_until = ?
    WHERE id = ? AND status = 'paying' AND pay_status NOT IN ('paid','late') RETURNING id`).bind(made.ext, made.ext, made.url, now, until, row.id).first();
  if (!won) return json({ error: "This order is no longer waiting for a payment." }, 409);
  return json({ ok: true, url: made.url, until });
}
