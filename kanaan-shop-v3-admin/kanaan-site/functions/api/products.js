import { json, rowToProduct, loadStock, releaseExpiredOrders } from "../_shared/util.js";

// GET /api/products — public list of visible products, with stock info.
export async function onRequestGet(context) {
  const { env } = context;
  try {
    // Free any stock held by pending orders that were never confirmed.
    try { await releaseExpiredOrders(env); } catch { /* non-fatal */ }

    const { results } = await env.DB.prepare(
      "SELECT * FROM products WHERE active = 1 ORDER BY sort_order ASC, created_at DESC"
    ).all();
    const products = (results || []).map(rowToProduct);

    let stock = {};
    try {
      stock = await loadStock(env, products.map((p) => p.id));
    } catch { /* if stock lookup fails, products stay untracked = available */ }

    for (const p of products) {
      const s = stock[p.id];
      p.tracked = !!s;
      p.stock = s ? s.stock : null;
    }

    return json({ products }, 200, { "Cache-Control": "no-store" });
  } catch (err) {
    return json({ products: [], error: String((err && err.message) || err) }, 200);
  }
}
