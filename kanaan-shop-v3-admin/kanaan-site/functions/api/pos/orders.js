import { json, rowToOrder, releaseExpiredOrders } from "../../_shared/util.js";
import { guard, withPosInfo } from "../../_shared/pos.js";

/* GET /api/pos/orders?since=<ms>   website orders created or changed after `since` (oldest first), each with the
   photo and the program's model of every line, so the program shows and matches them without asking again.
   GET /api/pos/orders?open=1        every order still waiting (pending / being handled). */
export async function onRequestGet(context) {
  const denied = await guard(context); if (denied) return denied;
  const { request, env } = context;
  try { await releaseExpiredOrders(env); } catch { /* non-fatal */ }
  const u = new URL(request.url);
  const since = Math.max(0, Number(u.searchParams.get("since")) || 0);
  const { results } = u.searchParams.get("open") === "1"
    ? await env.DB.prepare("SELECT * FROM orders WHERE status IN ('pending','processing') ORDER BY created_at ASC LIMIT 200").all()
    : await env.DB.prepare("SELECT * FROM orders WHERE updated_at > ? ORDER BY updated_at ASC LIMIT 200").bind(since).all();
  const orders = (results || []).map((r) => ({ ...rowToOrder(r), claimedBy: r.claimed_by ?? null, claimedAt: Number(r.claimed_at) || 0, posSale: r.pos_sale || "", posNote: r.pos_note || "" }));
  await withPosInfo(env, orders);
  // "the program checked the orders" (shown to the old admin) — written at most every 5 minutes (free plan writes)
  const seen = await env.DB.prepare("SELECT value FROM pos_state WHERE key = 'last_orders'").first();
  if (!seen || Date.now() - Number(seen.value) > 300000) await env.DB.prepare("INSERT INTO pos_state (key, value) VALUES ('last_orders', ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value").bind(String(Date.now())).run();
  return json({ orders, now: Date.now() });
}
