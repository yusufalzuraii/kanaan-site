import { json, rowToOrder, releaseReservation } from "../../../_shared/util.js";
import { guard, setStock, withPosInfo } from "../../../_shared/pos.js";

/* POST /api/pos/orders/:id
   { action: "claim" }     one device takes the order (atomic: two devices can never both take it). A claim older
                           than 10 minutes that was never finished can be taken again.
   { action: "release" }   the device gives it back (the sale could not be made): pending again, still reserved.
   { action: "accept", sale, stock: { productId: { "color|size": qty } }, v }
                           the program made the sale (a delivery invoice): the new stock numbers are set and the
                           reservation released together — the pieces are never taken twice.
   { action: "reject", reason }
                           the order is cancelled; a pending one gives its pieces back. */
const STALE = 10 * 60 * 1000;

export async function onRequestPost(context) {
  const denied = await guard(context); if (denied) return denied;
  const { request, env, params, device } = context;
  let body = {};
  try { body = await request.json(); } catch { return json({ error: "bad json" }, 400); }
  const row = await env.DB.prepare("SELECT * FROM orders WHERE id = ?").bind(params.id).first();
  if (!row) return json({ error: "Order not found" }, 404);
  let items = []; try { items = JSON.parse(row.items || "[]"); } catch { /* ignore */ }
  const now = Date.now();
  const back = async (extra = {}) => {
    const r = await env.DB.prepare("SELECT * FROM orders WHERE id = ?").bind(row.id).first();
    const order = { ...rowToOrder(r), claimedBy: r.claimed_by ?? null, claimedAt: Number(r.claimed_at) || 0, posSale: r.pos_sale || "", posNote: r.pos_note || "" };
    await withPosInfo(env, [order]);
    return json({ ok: true, ...extra, order });
  };
  const mine = row.claimed_by !== null && row.claimed_by !== undefined && Number(row.claimed_by) === device.no;

  if (body.action === "claim") {
    if (row.status === "processing" && mine) return back({ already: true });
    const r = await env.DB.prepare(`UPDATE orders SET status = 'processing', claimed_by = ?, claimed_at = ?, updated_at = ?
        WHERE id = ? AND (status = 'pending' OR (status = 'processing' AND claimed_at < ?)) RETURNING id`).bind(device.no, now, now, row.id, now - STALE).first();
    if (!r) {
      if (row.status === "processing") return json({ error: "Another device is handling this order right now." }, 409);
      return json({ error: `This order is already ${row.status}.` }, 409);
    }
    return back();
  }
  if (body.action === "release") {
    if (row.status !== "processing") return back({ already: true });
    await env.DB.prepare("UPDATE orders SET status = 'pending', claimed_by = NULL, claimed_at = 0, updated_at = ? WHERE id = ? AND status = 'processing'").bind(now, row.id).run();
    return back();
  }
  if (body.action === "accept") {
    if (row.status === "confirmed") return back({ already: true });
    if (row.status !== "pending" && !(row.status === "processing" && (mine || now - Number(row.claimed_at) > STALE))) {
      return json({ error: row.status === "processing" ? "Another device is handling this order." : `This order is ${row.status}.` }, 409);
    }
    // the shop's new numbers first (the sold pieces are already out of them), then the hold is let go
    for (const [pid, stock] of Object.entries(body.stock && typeof body.stock === "object" ? body.stock : {})) {
      const p = await env.DB.prepare("SELECT id, pos_v FROM products WHERE id = ? AND source = 'pos'").bind(pid).first();
      if (!p) continue;
      await setStock(env, pid, stock);
      const v = Math.max(0, Math.round(Number(body.v) || 0));
      if (v) await env.DB.prepare("UPDATE products SET pos_v = MAX(pos_v, ?) WHERE id = ?").bind(v, pid).run();
    }
    await releaseReservation(env, items);
    await env.DB.prepare("UPDATE orders SET status = 'confirmed', pos_sale = ?, claimed_by = ?, updated_at = ? WHERE id = ?")
      .bind(String(body.sale || "").slice(0, 40), device.no, now, row.id).run();
    return back();
  }
  if (body.action === "reject") {
    if (row.status === "cancelled" || row.status === "expired") return back({ already: true });
    if (row.status === "pending" || row.status === "processing") await releaseReservation(env, items);
    await env.DB.prepare("UPDATE orders SET status = 'cancelled', pos_note = ?, updated_at = ? WHERE id = ?").bind(String(body.reason || "").slice(0, 200), now, row.id).run();
    return back();
  }
  return json({ error: "unknown action" }, 400);
}
