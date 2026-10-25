import { json, rowToOrder, releaseExpiredOrders } from "../../_shared/util.js";
import { guard } from "../../_shared/pos.js";

/* GET /api/pos/orders?since=<ms> — website orders created or changed after `since` (oldest first). */
export async function onRequestGet(context) {
  const denied = await guard(context); if (denied) return denied;
  const { request, env } = context;
  try { await releaseExpiredOrders(env); } catch { /* non-fatal */ }
  const since = Math.max(0, Number(new URL(request.url).searchParams.get("since")) || 0);
  const { results } = await env.DB.prepare("SELECT * FROM orders WHERE updated_at > ? ORDER BY updated_at ASC LIMIT 200").bind(since).all();
  await env.DB.prepare("INSERT INTO pos_state (key, value) VALUES ('last_orders', ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value").bind(String(Date.now())).run();
  return json({ orders: (results || []).map(rowToOrder), now: Date.now() });
}
