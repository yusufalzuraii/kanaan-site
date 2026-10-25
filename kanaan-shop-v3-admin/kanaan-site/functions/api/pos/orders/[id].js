import { json, rowToOrder, releaseReservation } from "../../../_shared/util.js";
import { guard } from "../../../_shared/pos.js";

/* POST /api/pos/orders/:id  { action: "accept" | "reject" }
   accept: the POS made the sale (its stock went down and it already sent the new numbers), so here the
           reservation is only released — the quantity is NOT taken again (that would count the piece twice).
   reject: the reservation is released (or, for an accepted order, nothing: the POS puts its own stock back
           and sends the numbers). */
export async function onRequestPost(context) {
  const denied = await guard(context); if (denied) return denied;
  const { request, env, params } = context;
  let body = {};
  try { body = await request.json(); } catch { return json({ error: "bad json" }, 400); }
  const row = await env.DB.prepare("SELECT * FROM orders WHERE id = ?").bind(params.id).first();
  if (!row) return json({ error: "not found" }, 404);
  let items = []; try { items = JSON.parse(row.items || "[]"); } catch { /* ignore */ }
  const now = Date.now();
  if (body.action === "accept") {
    if (row.status === "confirmed") return json({ ok: true, order: rowToOrder(row), already: true });
    if (row.status !== "pending") return json({ error: `Order is ${row.status}.` }, 409);
    await releaseReservation(env, items);
    await env.DB.prepare("UPDATE orders SET status = 'confirmed', updated_at = ? WHERE id = ?").bind(now, row.id).run();
  } else if (body.action === "reject") {
    if (row.status === "cancelled" || row.status === "expired") return json({ ok: true, order: rowToOrder(row), already: true });
    if (row.status === "pending") await releaseReservation(env, items);
    await env.DB.prepare("UPDATE orders SET status = 'cancelled', updated_at = ? WHERE id = ?").bind(now, row.id).run();
  } else return json({ error: "unknown action" }, 400);
  return json({ ok: true, order: rowToOrder(await env.DB.prepare("SELECT * FROM orders WHERE id = ?").bind(row.id).first()) });
}
