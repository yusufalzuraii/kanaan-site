/* GET /shop — the "all products" listing.

   Like the categories: its own title, description and address, and the
   pieces themselves written into the page (with links to every category),
   so a search engine that doesn't run JavaScript still sees the shop. */
import { renderListingContent, injectContent, headTags, setHead, jsonLd } from "../_shared/ssr.js";
import { catalogCounts, categoryLinks, categoryWords, cardsFrom, itemList, loadCategories, ONLINE } from "../_shared/seo.js";

export async function onRequestGet(context) {
  const { request, env, next } = context;

  let res;
  try {
    res = await next(fresh(context.request));
  } catch {
    return new Response("Not found", { status: 404 });
  }

  const ct = res.headers.get("Content-Type") || "";
  if (!ct.includes("text/html")) return res;
  if (!env.DB) return res;

  const origin = new URL(request.url).origin;
  const url = `${origin}/shop`;
  // a search inside the shop (/shop?q=…) is the same page for Google: it
  // keeps the plain address as its canonical one
  let rows = [];
  try {
    rows = (await env.DB.prepare(`SELECT id, name, price, badge, discount, images FROM products WHERE ${ONLINE} AND sold_out = 0 ORDER BY sort_order ASC, created_at DESC LIMIT 96`).all()).results || [];
  } catch { /* the tags below still apply */ }
  const [cats, counts] = await Promise.all([loadCategories(env), catalogCounts(env)]);
  const nav = categoryLinks(cats, counts, origin);
  const cards = cardsFrom(rows, origin);
  const count = counts.total || cards.length;

  const title = "Shop all menswear — Kanaan Shop, Lebanon";
  const description = count > 0
    ? `All ${count} pieces at Kanaan Shop: ${categoryWords(nav, 6)}. From our shop in Saida, delivered all over Lebanon, cash on delivery.`
    : "The full Kanaan Shop catalogue. Delivery all over Lebanon, cash on delivery.";

  const breadcrumbLd = jsonLd({
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: [
      { "@type": "ListItem", position: 1, name: "Kanaan Shop", item: `${origin}/` },
      { "@type": "ListItem", position: 2, name: "Shop", item: url },
    ],
  });

  let html = await res.text();
  try {
    html = injectContent(html, renderListingContent({ title: "Shop all", intro: description, products: cards, origin, nav, limit: 96 }));
  } catch { /* meta tags still apply */ }
  html = setHead(html, headTags({
    title,
    description,
    url,
    image: cards[0] ? cards[0].image : "",
    extra: (cards.length ? `<script type="application/ld+json">${jsonLd(itemList("Kanaan Shop", cards, origin))}</script>\n` : "") + `<script type="application/ld+json">${breadcrumbLd}</script>`,
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
