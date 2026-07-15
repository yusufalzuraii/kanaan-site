import { json, isAuthed, rowToOrder, releaseExpiredOrders } from "../../_shared/util.js";

// GET /api/admin/orders — all orders, newest first.
export async function onRequestGet(context) {
  const { request, env } = context;
  if (!(await isAuthed(request, env))) return json({ error: "unauthorized" }, 401);

  try { await releaseExpiredOrders(env); } catch { /* non-fatal */ }

  const { results } = await env.DB.prepare(
    "SELECT * FROM orders ORDER BY created_at DESC LIMIT 200"
  ).all();
  return json({ orders: (results || []).map(rowToOrder) });
}
