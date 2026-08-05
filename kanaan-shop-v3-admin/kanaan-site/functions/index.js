/* GET /  — the homepage.

   The most visited page on the site was the only one still shipping an
   empty <div id="root"> to crawlers. Product and category pages already
   inject real content; this closes the gap.

   It also fixes the blank-screen delay on a slow connection: the shop's
   name, its promise and its newest pieces are in the HTML itself, so a
   visitor sees the shop while the JavaScript is still downloading rather
   than staring at white. React clears this and takes over on mount, so
   nothing about the live experience changes. */

import { CATEGORY_LABELS, parseImages } from "./_shared/util.js";
import { renderListingContent, injectContent, esc } from "./_shared/ssr.js";

const jsonLd = (obj) => JSON.stringify(obj).replace(/</g, "\\u003c");

export async function onRequestGet(context) {
  const { request, env, next } = context;

  let res;
  try {
    res = await next();
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
      "SELECT id, name, price, badge, discount, images, category FROM products WHERE active = 1 AND sold_out = 0 ORDER BY sort_order ASC, created_at DESC LIMIT 12"
    ).all();
    rows = result.results || [];
  } catch {
    return res; // no database, no injection — the app still works
  }

  const absolute = (u) =>
    u ? (/^https?:\/\//i.test(u) ? u : `${origin}${u.startsWith("/") ? "" : "/"}${u}`) : "";

  const products = rows.map((r) => ({
    id: r.id,
    name: r.name,
    price: Math.round(Number(r.price) || 0),
    discount: r.badge === "sale" ? Number(r.discount) || 0 : 0,
    image: absolute(parseImages(r.images)[0]?.url || ""),
  }));

  const content = renderListingContent({
    title: "Kanaan Shop — Everyday wear, refined",
    intro:
      "Menswear in heavy fabrics with a youthful edge, from Saida to all of Lebanon. Delivery across Lebanon, cash on delivery.",
    products,
    origin,
  });

  /* An ItemList of what's on the homepage right now, so the products are
     discoverable from the site's front door rather than only from their
     own pages. */
  const listLd = jsonLd({
    "@context": "https://schema.org",
    "@type": "ItemList",
    name: "New in — Kanaan Shop",
    itemListElement: products.slice(0, 12).map((p, i) => ({
      "@type": "ListItem",
      position: i + 1,
      url: `${origin}/product/${p.id}`,
      item: {
        "@type": "Product",
        name: p.name,
        image: p.image || undefined,
        url: `${origin}/product/${p.id}`,
        offers: {
          "@type": "Offer",
          price: p.discount > 0 ? Math.round(p.price * (1 - p.discount / 100)) : p.price,
          priceCurrency: "USD",
        },
      },
    })),
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

  html = html.replace(
    /<\/head>/i,
    `<script type="application/ld+json">${listLd}</script>\n` +
      `<script type="application/ld+json">${searchLd}</script>\n  </head>`
  );

  const headers = new Headers(res.headers);
  headers.set("Cache-Control", "public, max-age=300");
  return new Response(html, { status: 200, headers });
}
