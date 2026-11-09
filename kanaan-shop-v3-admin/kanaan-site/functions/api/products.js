import { json } from "../_shared/util.js";
import { catalogPayload } from "../_shared/catalog.js";

// GET /api/products — public list of visible products, with stock info (functions/_shared/catalog.js; every page
// the server writes also carries it, so the site rarely needs to ask).
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
    const { at: _at, ...data } = await catalogPayload(env, { app: isAppClient });
    return json(data, 200, { "Cache-Control": "no-store" });
  } catch (err) {
    return json({ products: [], error: String((err && err.message) || err) }, 200);
  }
}
