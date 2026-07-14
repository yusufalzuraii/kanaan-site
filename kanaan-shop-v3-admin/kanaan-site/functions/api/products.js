import { json, rowToProduct } from "../_shared/util.js";

// GET /api/products — public list of visible products for the storefront.
export async function onRequestGet(context) {
  const { env } = context;
  try {
    const { results } = await env.DB.prepare(
      "SELECT * FROM products WHERE active = 1 ORDER BY sort_order ASC, created_at DESC"
    ).all();
    const products = (results || []).map(rowToProduct);
    return json({ products }, 200, { "Cache-Control": "public, max-age=30" });
  } catch (err) {
    return json({ products: [], error: String(err && err.message || err) }, 200);
  }
}
