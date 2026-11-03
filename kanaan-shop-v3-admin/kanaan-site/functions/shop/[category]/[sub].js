/* GET /shop/:category/:sub  (e.g. /shop/jeans/baggy)
   Same purpose as the category-level function, one level deeper. */

import { renderListingContent, injectContent, headTags, setHead, jsonLd } from "../../_shared/ssr.js";
import { catalogCounts, subLinks, cardsFrom, itemList, loadCategories, ONLINE } from "../../_shared/seo.js";

export async function onRequestGet(context) {
  const { request, env, params, next } = context;

  let res;
  try {
    res = await next(fresh(context.request));
  } catch {
    return new Response("Not found", { status: 404 });
  }

  const ct = res.headers.get("Content-Type") || "";
  if (!ct.includes("text/html")) return res;

  const category = String(params.category || "").trim();
  const sub = String(params.sub || "").trim();
  if (!env.DB) return res;
  const cats = await loadCategories(env);
  const subMeta = (cats.subs[category] || []).find((s) => s.id === sub);
  if (!cats.ids.includes(category) || !subMeta) return res;

  let rows;
  try {
    const result = await env.DB.prepare(
      `SELECT id, name, price, badge, discount, images FROM products WHERE ${ONLINE} AND sold_out = 0 AND category = ? AND subcategory = ? ORDER BY sort_order ASC, created_at DESC LIMIT 96`
    ).bind(category, sub).all();
    rows = result.results || [];
  } catch {
    return res;
  }
  const counts = await catalogCounts(env);

  const origin = new URL(request.url).origin;
  const url = `${origin}/shop/${category}/${sub}`;
  const catLabel = cats.labels[category] || "Shop";
  const label = `${catLabel} — ${subMeta.label}`;
  const cards = cardsFrom(rows, origin);
  const count = cards.length;
  const low = cards.length ? Math.min(...cards.map((c) => c.finalPrice)) : 0;

  const title = `${subMeta.label} ${catLabel.toLowerCase()} for men — Kanaan Shop`;
  const description = count > 0
    ? `${count} ${subMeta.label.toLowerCase()} ${catLabel.toLowerCase()} for men at Kanaan Shop in Saida${low ? `, from $${low}` : ""}. Delivery all over Lebanon, cash on delivery.`
    : `${subMeta.label} ${catLabel.toLowerCase()} for men at Kanaan Shop in Saida. Delivery all over Lebanon, cash on delivery.`;

  const breadcrumbLd = jsonLd({
    "@context": "https://schema.org", "@type": "BreadcrumbList",
    itemListElement: [
      { "@type": "ListItem", position: 1, name: "Shop", item: `${origin}/shop` },
      { "@type": "ListItem", position: 2, name: catLabel, item: `${origin}/shop/${category}` },
      { "@type": "ListItem", position: 3, name: subMeta.label, item: url },
    ],
  });

  let html = await res.text();

  // Real listing content for crawlers (and a faster first paint for
  // shoppers) — see functions/_shared/ssr.js for why.
  try {
    const fits = [{ href: `${origin}/shop/${category}`, label: `All ${catLabel.toLowerCase()}`, count: counts.counts[category] || 0 }, ...subLinks(cats, counts, category, origin).filter((f) => f.id !== sub)];
    html = injectContent(html, renderListingContent({ title: label, intro: description, products: cards, origin, nav: fits, navTitle: `${catLabel} by fit`, limit: 96 }));
  } catch { /* meta tags still apply */ }

  html = setHead(html, headTags({
    title,
    description,
    url,
    image: cards[0] ? cards[0].image : "",
    noindex: count === 0,
    extra: (cards.length ? `<script type="application/ld+json">${jsonLd(itemList(`${label} — Kanaan Shop`, cards, origin))}</script>\n` : "") + `<script type="application/ld+json">${breadcrumbLd}</script>`,
  }));

  const headers = new Headers(res.headers);
  // the page is re-checked every visit (like the shell, see public/_headers): a cached copy could point at the
  // previous deploy's files; and its own ETag (the shell's) must not answer "not changed" for a page that did
  headers.set("Cache-Control", "public, max-age=0, must-revalidate");
  headers.delete("ETag");
  headers.delete("Last-Modified");
  return new Response(html, { status: 200, headers });
}

/* The shell, asked plainly: without the browser's If-None-Match / If-Modified-Since (the shell's "not changed"
   would answer for this page, which did change). */
function fresh(request) {
  const h = new Headers(request.headers);
  h.delete("If-None-Match");
  h.delete("If-Modified-Since");
  return new Request(request.url, { method: "GET", headers: h });
}
