import { json, isAuthed, rowToOrder, confirmStatements, releaseStatements } from "../../../_shared/util.js";

/* POST /api/admin/orders/:id   { action: "confirm" | "cancel" }
   confirm -> stock is deducted for real
   cancel  -> reservation released, stock free again
   Both are safe to call once: the status changes first, and only from what it was, so a double tap or the
   24h expiry at the same moment never deducts or releases twice.
   An order Kanaan POS is handling, or one it made an invoice of, is the program's: changed there, never here. */
async function posInvolved(env, row, items) {
  if (row.status === "processing" || row.pos_sale) return true;
  const ids = [...new Set(items.map((i) => i.productId).filter(Boolean))];
  if (!ids.length) return false;
  const pos = await env.DB.prepare(`SELECT COUNT(*) n FROM products WHERE id IN (${ids.map(() => "?").join(",")}) AND source = 'pos'`).bind(...ids).first().catch(() => null);
  return !!(pos && pos.n > 0);
}

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
  const now = Date.now();

  if (action === "confirm") {
    if (row.status !== "pending") return json({ error: `Order is already ${row.status}.` }, 409);
    if (await posInvolved(env, row, items)) return json({ error: "This order has pieces from Kanaan POS: accept it in the program (Website → Orders)." }, 409);
    const won = await env.DB.prepare("UPDATE orders SET status = 'confirmed', updated_at = ? WHERE id = ? AND status = 'pending' RETURNING id").bind(now, id).first();
    if (!won) return json({ error: "Order was changed meanwhile." }, 409);
    const st = confirmStatements(env, items);
    if (st.length) await env.DB.batch(st);
  } else if (action === "cancel") {
    if (await posInvolved(env, row, items)) return json({ error: "Kanaan POS is handling this order: reject it there (Website → Orders), so the shop's stock and accounts stay right." }, 409);
    if (row.status === "pending") {
      const won = await env.DB.prepare("UPDATE orders SET status = 'cancelled', updated_at = ? WHERE id = ? AND status = 'pending' RETURNING id").bind(now, id).first();
      if (won) { const st = releaseStatements(env, items); if (st.length) await env.DB.batch(st); }
    } else if (row.status === "confirmed") {
      // Put the stock back — the sale fell through after confirmation.
      const won = await env.DB.prepare("UPDATE orders SET status = 'cancelled', updated_at = ? WHERE id = ? AND status = 'confirmed' RETURNING id").bind(now, id).first();
      if (won) {
        const st = items.filter((it) => it.productId && it.colorKey && it.size).map((it) => env.DB.prepare(
          "UPDATE variants SET quantity = quantity + ? WHERE product_id = ? AND color = ? AND size = ?"
        ).bind(Math.max(0, Number(it.qty) || 0), it.productId, it.colorKey, it.size));
        if (st.length) await env.DB.batch(st);
      }
    } else {
      await env.DB.prepare("UPDATE orders SET status = 'cancelled', updated_at = ? WHERE id = ?").bind(now, id).run();
    }
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
  let items = [];
  try { items = JSON.parse(row.items || "[]"); } catch { /* ignore */ }
  if (await posInvolved(env, row, items)) return json({ error: "Kanaan POS is handling this order: it stays." }, 409);

  // If it was still holding stock, release it before deleting.
  if (row.status === "pending") { const st = releaseStatements(env, items); if (st.length) await env.DB.batch(st); }

  await env.DB.prepare("DELETE FROM orders WHERE id = ?").bind(params.id).run();
  return json({ ok: true });
}
