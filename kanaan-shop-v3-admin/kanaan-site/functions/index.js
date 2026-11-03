/* GET /  — the homepage.

   The most visited page on the site was the only one still shipping an
   empty <div id="root"> to crawlers. Product and category pages already
   inject real content; this closes the gap.

   It also fixes the blank-screen delay on a slow connection: the shop's
   name, its promise and its newest pieces are in the HTML itself, so a
   visitor sees the shop while the JavaScript is still downloading rather
   than staring at white. React clears this and takes over on mount, so
   nothing about the live experience changes. */

import { renderListingContent, injectContent, headTags, setHead, jsonLd, storeLd } from "./_shared/ssr.js";
import { catalogCounts, categoryLinks, categoryWords, cardsFrom, itemList, loadCategories, ONLINE } from "./_shared/seo.js";
import { loadSettings } from "./_shared/settings.js";

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

  const url = new URL(request.url);
  // Only the homepage itself — never a deeper path that happens to fall
  // through to this handler.
  if (url.pathname !== "/") return res;

  const origin = url.origin;

  let rows = [];
  try {
    const result = await env.DB.prepare(
      `SELECT id, name, price, badge, discount, images, category FROM products WHERE ${ONLINE} AND sold_out = 0 ORDER BY sort_order ASC, created_at DESC LIMIT 24`
    ).all();
    rows = result.results || [];
  } catch {
    return res; // no database, no injection — the app still works
  }
  const [cats, counts, settings] = await Promise.all([loadCategories(env), catalogCounts(env), loadSettings(env).catch(() => null)]);
  const nav = categoryLinks(cats, counts, origin);
  const products = cardsFrom(rows, origin);

  // the words a search result shows: what the shop sells, from what's online
  const what = categoryWords(nav) || "menswear";
  const description = `Kanaan Shop, menswear in Saida, Lebanon: ${what}. ${counts.total ? `${counts.total} pieces online, ` : ""}delivery all over Lebanon, cash on delivery.`;

  const content = renderListingContent({
    title: "Kanaan Shop — Everyday wear, refined",
    intro: "Menswear from our shop on Eastern Boulevard in Saida, delivered all over Lebanon. Cash on delivery.",
    products,
    origin,
    nav,
    limit: 24,
  });

  // Lets Google show a search box for the site directly in results.
  const searchLd = jsonLd({
    "@context": "https://schema.org",
    "@type": "WebSite",
    name: "Kanaan Shop",
    url: origin,
    potentialAction: {
      "@type": "SearchAction",
      target: { "@type": "EntryPoint", urlTemplate: `${origin}/shop?q={search_term_string}` },
      "query-input": "required name=search_term_string",
    },
  });

  let html = await res.text();
  try {
    html = injectContent(html, content);
  } catch { /* meta and structured data below still apply */ }

  /* The homepage opens on a still of the shop (the 3D scene fades in over
     it). Fetching it alongside the HTML, instead of only once the app has
     started, puts the shop on screen sooner. The light theme is the
     default, so these are the day stills; the shape decides which. */
  const preload =
    `<link rel="preload" as="image" href="/home/store-day-tall.webp" media="(max-aspect-ratio: 21/20)" fetchpriority="high">\n` +
    `<link rel="preload" as="image" href="/home/store-day-wide.webp" media="(min-aspect-ratio: 21/20)" fetchpriority="high">\n`;

  // the shell's own ClothingStore block is replaced by the full one (hours
  // from the owner's settings)
  html = html.replace(/<script type="application\/ld\+json">\{"@context":"https:\/\/schema.org","@type":"ClothingStore"[\s\S]*?<\/script>/, "");
  html = setHead(html, headTags({
    title: "Kanaan Shop — Menswear from Saida, Lebanon",
    description,
    url: `${origin}/`,
    image: `${origin}/home/shop-front.webp`,
    extra:
      preload +
      `<script type="application/ld+json">${jsonLd(storeLd(settings))}</script>\n` +
      (products.length ? `<script type="application/ld+json">${jsonLd(itemList("New in — Kanaan Shop", products, origin))}</script>\n` : "") +
      `<script type="application/ld+json">${searchLd}</script>`,
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
