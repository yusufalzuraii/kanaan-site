/* The shop's catalogue as the site and the app use it: the pieces online (with their stock and stars), the
   categories and the owner's site settings — what GET /api/products answers, and what every page the server
   writes carries inside it (embedCatalog), so the page shows the pieces the moment its script runs instead of
   asking for them first (one round trip less on every first visit; no blank moment, nothing jumping). */
import { rowToProduct, loadStock, releaseExpiredOrders } from "./util.js";
import { loadCategories } from "./site.js";
import { loadSettings, publicSettings } from "./settings.js";
import { summaries as reviewSummaries } from "./reviews.js";

export async function catalogPayload(env, { app = false } = {}) {
  // Free any stock held by pending orders that were never confirmed.
  try { await releaseExpiredOrders(env); } catch { /* non-fatal */ }

  const { results } = await env.DB.prepare(
    "SELECT * FROM products WHERE active = 1 ORDER BY sort_order ASC, created_at DESC"
  ).all();
  let products = (results || []).map(rowToProduct);

  const exclusiveCount = products.filter((p) => p.appExclusive).length;
  if (!app) products = products.filter((p) => !p.appExclusive);

  const [stock, cats, settings, sums] = await Promise.all([
    loadStock(env, products.map((p) => p.id)).catch(() => ({})), // if stock lookup fails, products stay untracked = available
    loadCategories(env).catch(() => null), // edited from Kanaan POS
    loadSettings(env).then((s) => publicSettings(s, Date.now(), env)).catch(() => null), // the bar, delivery, hours…
    reviewSummaries(env).catch(() => null), // real reviews: { avg, count } per piece
  ]);
  for (const p of products) {
    const s = stock[p.id];
    p.tracked = !!s;
    p.stock = s ? s.stock : null;
    const r = sums && sums.get(p.id);
    if (r) p.reviews = r;
  }
  const categories = cats ? cats.list.filter((c) => c.active) : null;
  return { products, appExclusiveCount: exclusiveCount, categories, settings, at: Date.now() };
}

/** The catalogue written into a page (a JSON block the app reads as it starts). Never breaks the page: no
    database, or any failure, and the page goes as it was (the app then asks for it as before). */
export async function embedCatalog(html, env, payloadPromise) {
  try {
    if (!env.DB || !/<\/body>/i.test(html)) return html;
    const data = await (payloadPromise || catalogPayload(env));
    const text = JSON.stringify(data).replace(/</g, "\\u003c").replace(/\u2028/g, "\\u2028").replace(/\u2029/g, "\\u2029");
    return html.replace(/<\/body>/i, `<script id="kanaan-catalog" type="application/json">${text}</script>\n</body>`);
  } catch {
    return html;
  }
}
