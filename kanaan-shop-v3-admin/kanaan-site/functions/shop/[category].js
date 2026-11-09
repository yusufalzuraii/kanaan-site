/* GET /shop/:category
   ------------------------------------------------------------
   Same idea as the product page: the SPA can't be seen by a search
   crawler that doesn't run JavaScript, so every category was showing
   the exact same homepage title/description in search results —
   Google had no way to tell "Jeans" apart from "Shoes". This gives
   each category its own title, description, canonical URL, and an
   ItemList of what's actually in stock there right now. */

import { renderListingContent, injectContent, headTags, setHead, jsonLd } from "../_shared/ssr.js";
import { embedCatalog } from "../_shared/catalog.js";
import { catalogCounts, categoryLinks, subLinks, cardsFrom, itemList, loadCategories, ONLINE } from "../_shared/seo.js";

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
  if (!env.DB) return res;
  const cats = await loadCategories(env); // categories are edited from Kanaan POS (built-in list as fallback)
  if (!cats.ids.includes(category)) return notFound(res);

  let rows;
  try {
    const result = await env.DB.prepare(
      `SELECT id, name, price, badge, discount, images FROM products WHERE ${ONLINE} AND sold_out = 0 AND category = ? ORDER BY sort_order ASC, created_at DESC LIMIT 96`
    ).bind(category).all();
    rows = result.results || [];
  } catch {
    return res;
  }
  const counts = await catalogCounts(env);

  const origin = new URL(request.url).origin;
  const url = `${origin}/shop/${category}`;
  const label = cats.labels[category] || "Shop";
  const cards = cardsFrom(rows, origin);
  const count = counts.counts[category] || cards.length;
  const fits = subLinks(cats, counts, category, origin);
  const low = cards.length ? Math.min(...cards.map((c) => c.finalPrice)) : 0;

  const title = `Men's ${label} in Lebanon — Kanaan Shop`;
  const description = count > 0
    ? `${count} men's ${label.toLowerCase()} at Kanaan Shop in Saida${fits.length ? `: ${fits.map((f) => f.label.toLowerCase()).join(", ")}` : ""}${low ? `, from $${low}` : ""}. Delivery all over Lebanon, cash on delivery.`
    : `Men's ${label.toLowerCase()} at Kanaan Shop in Saida. Delivery all over Lebanon, cash on delivery.`;

  const breadcrumbLd = jsonLd({
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: [
      { "@type": "ListItem", position: 1, name: "Shop", item: `${origin}/shop` },
      { "@type": "ListItem", position: 2, name: label, item: url },
    ],
  });

  let html = await res.text();

  // Real listing content for crawlers (and a faster first paint for
  // shoppers) — see functions/_shared/ssr.js for why. The category's fits
  // link from it, and the other categories after them.
  try {
    const others = categoryLinks(cats, counts, origin).filter((l) => l.id !== category);
    html = injectContent(html, renderListingContent({
      title: label,
      intro: description,
      products: cards,
      origin,
      nav: fits.length ? fits : others,
      navTitle: fits.length ? `${label} by fit` : "Shop by category",
      limit: 96,
    }));
  } catch { /* meta tags still apply */ }

  html = setHead(html, headTags({
    title,
    description,
    url,
    image: cards[0] ? cards[0].image : "",
    // nothing online in it right now: kept out of search results until
    // there is (the page still works for anyone who has the link)
    noindex: count === 0,
    extra: (cards.length ? `<script type="application/ld+json">${jsonLd(itemList(`${label} — Kanaan Shop`, cards, origin))}</script>\n` : "") + `<script type="application/ld+json">${breadcrumbLd}</script>`,
  }));

  const headers = new Headers(res.headers);
  // the page is re-checked every visit (like the shell, see public/_headers): a cached copy could point at the
  // previous deploy's files; and its own ETag (the shell's) must not answer "not changed" for a page that did
  headers.set("Cache-Control", "public, max-age=0, must-revalidate");
  headers.delete("ETag");
  headers.delete("Last-Modified");
  // the catalogue inside the page: the app shows the pieces straight away (functions/_shared/catalog.js)
  html = await embedCatalog(html, env);
  return new Response(html, { status: 200, headers });
}

/* A category that doesn't exist: the app still shows its own "not found"
   page, but search engines are told so (404) instead of a copy of the
   homepage. */
async function notFound(res) {
  let html = await res.text();
  html = setHead(html, headTags({ title: "Not found — Kanaan Shop", description: "This page isn't in the shop. Browse all the pieces at kanaanshop.com/shop.", url: "", noindex: true }));
  const headers = new Headers(res.headers);
  headers.set("Cache-Control", "no-store");
  headers.delete("ETag");
  headers.delete("Last-Modified");
  return new Response(html, { status: 404, headers });
}

/* The shell, asked plainly: without the browser's If-None-Match / If-Modified-Since (the shell's "not changed"
   would answer for this page, which did change). */
function fresh(request) {
  const h = new Headers(request.headers);
  h.delete("If-None-Match");
  h.delete("If-Modified-Since");
  return new Request(request.url, { method: "GET", headers: h });
}
