import { json, rowToOrder, releaseStatements, confirmStatements } from "../../../_shared/util.js";
import { guard, setStockMany, withPosInfo } from "../../../_shared/pos.js";

/* POST /api/pos/orders/:id
   { action: "claim" }     one device takes the order (atomic: two devices can never both take it). A claim older
                           than 10 minutes that was never finished can be taken again.
   { action: "release" }   the device gives it back (the sale could not be made): pending again, still reserved.
   { action: "accept", sale, stock: { productId: { "color|size": qty } }, v }
                           the program made the sale (a delivery invoice): the new stock numbers are set and the
                           reservation released together — the pieces are never taken twice. A line of an old site
                           page (stock kept by the site) has its pieces taken out of the site's own numbers.
   { action: "reject", reason }
                           the order is cancelled; a pending one gives its pieces back.
   Each action changes the status first, and only if it is still what it was: a retry, a double tap or the 24h
   expiry at the same moment can never release a hold twice or take pieces twice. */
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
    // confirmed first, and only from where it was (pending, or being handled by this device / a stale claim)
    const won = await env.DB.prepare(`UPDATE orders SET status = 'confirmed', pos_sale = ?, claimed_by = ?, updated_at = ?
        WHERE id = ? AND (status = 'pending' OR (status = 'processing' AND (claimed_by = ? OR claimed_at < ?))) RETURNING id`)
      .bind(String(body.sale || "").slice(0, 40), device.no, now, row.id, device.no, now - STALE).first();
    if (!won) {
      const cur = await env.DB.prepare("SELECT status FROM orders WHERE id = ?").bind(row.id).first();
      if (cur && cur.status === "confirmed") return back({ already: true });
      return json({ error: cur && cur.status === "processing" ? "Another device is handling this order." : `This order is ${cur ? cur.status : "gone"}.` }, 409);
    }
    try {
      // the shop's new numbers for its own products (the sold pieces are already out of them), then the hold goes
      const v = Math.max(0, Math.round(Number(body.v) || 0));
      const wanted = Object.entries(body.stock && typeof body.stock === "object" ? body.stock : {});
      const posIds = new Set();
      if (wanted.length) {
        const part = wanted.map(([pid]) => String(pid)).slice(0, 40);
        const { results } = await env.DB.prepare(`SELECT id FROM products WHERE source = 'pos' AND id IN (${part.map(() => "?").join(",")})`).bind(...part).all();
        for (const r of results || []) posIds.add(r.id);
        await setStockMany(env, wanted.filter(([pid]) => posIds.has(String(pid))).map(([pid, stock]) => ({ id: String(pid), stock, v })));
      }
      const { results: srcRows } = await env.DB.prepare(`SELECT id, source FROM products WHERE id IN (${[...new Set(items.map((i) => i.productId))].map(() => "?").join(",") || "''"})`).bind(...new Set(items.map((i) => i.productId))).all();
      const fromPos = new Set((srcRows || []).filter((r) => r.source === "pos").map((r) => r.id));
      const st = [
        ...releaseStatements(env, items.filter((i) => fromPos.has(i.productId))),
        ...confirmStatements(env, items.filter((i) => !fromPos.has(i.productId))),
      ];
      if (st.length) await env.DB.batch(st);
    } catch (e) {
      // the stock could not be written: back to being handled, the device tries again later
      await env.DB.prepare("UPDATE orders SET status = 'processing', updated_at = ? WHERE id = ? AND status = 'confirmed'").bind(now, row.id).run();
      return json({ error: `The website could not take the stock right now (${String((e && e.message) || e).slice(0, 80)}) — try again` }, 503);
    }
    return back();
  }
  if (body.action === "reject") {
    if (row.status === "cancelled" || row.status === "expired") return back({ already: true });
    // from waiting: its pieces go back; from confirmed (the delivery came back): the status only
    const held = await env.DB.prepare("UPDATE orders SET status = 'cancelled', pos_note = ?, updated_at = ? WHERE id = ? AND status IN ('pending','processing') RETURNING id")
      .bind(String(body.reason || "").slice(0, 200), now, row.id).first();
    if (held) { const st = releaseStatements(env, items); if (st.length) await env.DB.batch(st); return back(); }
    const done = await env.DB.prepare("UPDATE orders SET status = 'cancelled', pos_note = ?, updated_at = ? WHERE id = ? AND status = 'confirmed' RETURNING id")
      .bind(String(body.reason || "").slice(0, 200), now, row.id).first();
    if (!done) return back({ already: true });
    return back();
  }
  return json({ error: "unknown action" }, 400);
}
