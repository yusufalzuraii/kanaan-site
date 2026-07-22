import { json, rowToProduct, loadStock, releaseExpiredOrders } from "../_shared/util.js";

// GET /api/products — public list of visible products, with stock info.
//
// طلبات التطبيق (أندرويد/آيفون) بترسل هيدر "X-Kanaan-Client: app" —
// هيك منقدر نميّز طلبات التطبيق الحقيقية عن أي طلب من متصفح، ونخفي
// المنتجات الحصرية للتطبيق (app_exclusive) عن الموقع بالكامل. هاد
// مش حماية أمنية 100% (أي حدا فاهم بالتقنية يقدر يزوّر الهيدر)، بس
// كافي لمنع التصفح العادي/الفضولي من الموقع، وهاد بالضبط الهدف هون.
export async function onRequestGet(context) {
  const { request, env } = context;
  const isAppClient = request.headers.get("X-Kanaan-Client") === "app";

  try {
    // Free any stock held by pending orders that were never confirmed.
    try { await releaseExpiredOrders(env); } catch { /* non-fatal */ }

    const { results } = await env.DB.prepare(
      "SELECT * FROM products WHERE active = 1 ORDER BY sort_order ASC, created_at DESC"
    ).all();
    let products = (results || []).map(rowToProduct);

    const exclusiveCount = products.filter((p) => p.appExclusive).length;
    if (!isAppClient) {
      products = products.filter((p) => !p.appExclusive);
    }

    let stock = {};
    try {
      stock = await loadStock(env, products.map((p) => p.id));
    } catch { /* if stock lookup fails, products stay untracked = available */ }

    for (const p of products) {
      const s = stock[p.id];
      p.tracked = !!s;
      p.stock = s ? s.stock : null;
    }

    return json({ products, appExclusiveCount: exclusiveCount }, 200, { "Cache-Control": "no-store" });
  } catch (err) {
    return json({ products: [], error: String((err && err.message) || err) }, 200);
  }
}
