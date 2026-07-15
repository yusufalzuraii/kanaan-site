import { json, isAuthed, rowToOrder, confirmReservation, releaseReservation } from "../../../_shared/util.js";

/* POST /api/admin/orders/:id   { action: "confirm" | "cancel" }
   confirm -> stock is deducted for real
   cancel  -> reservation released, stock free again
   Both are safe to call once; re-confirming an already-confirmed order
   won't deduct twice. */
export async function onRequestPost(context) {
  const { request, env, params } = context;
  if (!(await isAuthed(request, env))) return json({ error: "unauthorized" }, 401);

  const id = params.id;
  let body = {};
  try { body = await request.json(); } catch { return json({ error: "bad json" }, 400); }
  const action = String(body.action || "");

  const row = await env.DB.prepare("SELECT * FROM orders WHERE id = ?").bind(id).first();
  if (!row) return json({ error: "not found" }, 404);

  let items = [];
  try { items = JSON.parse(row.items || "[]"); } catch { /* ignore */ }

  if (action === "confirm") {
    if (row.status !== "pending") return json({ error: `Order is already ${row.status}.` }, 409);
    await confirmReservation(env, items);
    await env.DB.prepare("UPDATE orders SET status = 'confirmed', updated_at = ? WHERE id = ?")
      .bind(Date.now(), id).run();
  } else if (action === "cancel") {
    if (row.status === "pending") {
      await releaseReservation(env, items);
    } else if (row.status === "confirmed") {
      // Put the stock back — the sale fell through after confirmation.
      for (const it of items) {
        if (!it.productId || !it.colorKey || !it.size) continue;
        await env.DB.prepare(
          "UPDATE variants SET quantity = quantity + ? WHERE product_id = ? AND color = ? AND size = ?"
        ).bind(Math.max(0, Number(it.qty) || 0), it.productId, it.colorKey, it.size).run();
      }
    }
    await env.DB.prepare("UPDATE orders SET status = 'cancelled', updated_at = ? WHERE id = ?")
      .bind(Date.now(), id).run();
  } else {
    return json({ error: "unknown action" }, 400);
  }

  const updated = await env.DB.prepare("SELECT * FROM orders WHERE id = ?").bind(id).first();
  return json({ ok: true, order: rowToOrder(updated) });
}

// DELETE /api/admin/orders/:id — remove an order record entirely.
export async function onRequestDelete(context) {
  const { request, env, params } = context;
  if (!(await isAuthed(request, env))) return json({ error: "unauthorized" }, 401);

  const row = await env.DB.prepare("SELECT * FROM orders WHERE id = ?").bind(params.id).first();
  if (!row) return json({ error: "not found" }, 404);

  // If it was still holding stock, release it before deleting.
  if (row.status === "pending") {
    let items = [];
    try { items = JSON.parse(row.items || "[]"); } catch { /* ignore */ }
    await releaseReservation(env, items);
  }

  await env.DB.prepare("DELETE FROM orders WHERE id = ?").bind(params.id).run();
  return json({ ok: true });
}
