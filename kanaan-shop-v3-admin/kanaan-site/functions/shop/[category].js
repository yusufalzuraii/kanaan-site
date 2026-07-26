/* GET /shop/:category
   ------------------------------------------------------------
   Same idea as the product page: the SPA can't be seen by a search
   crawler that doesn't run JavaScript, so every category was showing
   the exact same homepage title/description in search results —
   Google had no way to tell "Jeans" apart from "Shoes". This gives
   each category its own title, description, canonical URL, and an
   ItemList of what's actually in stock there right now. */

import { CATEGORY_IDS, CATEGORY_LABELS, parseImages } from "../_shared/util.js";
import { renderListingContent, injectContent } from "../_shared/ssr.js";

const esc = (s) =>
  String(s == null ? "" : s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");

const jsonLd = (obj) => JSON.stringify(obj).replace(/</g, "\\u003c");

export async function onRequestGet(context) {
  const { request, env, params, next } = context;

  let res;
  try {
    res = await next();
  } catch {
    return new Response("Not found", { status: 404 });
  }

  const ct = res.headers.get("Content-Type") || "";
  if (!ct.includes("text/html")) return res;

  const category = String(params.category || "").trim();
  if (!CATEGORY_IDS.includes(category) || !env.DB) return res;

  let rows;
  try {
    const result = await env.DB.prepare(
      "SELECT id, name, price, badge, discount, images FROM products WHERE active = 1 AND sold_out = 0 AND category = ? ORDER BY sort_order ASC, created_at DESC LIMIT 24"
    ).bind(category).all();
    rows = result.results || [];
  } catch {
    return res;
  }

  const origin = new URL(request.url).origin;
  const url = `${origin}/shop/${category}`;
  const label = CATEGORY_LABELS[category] || "Shop";
  const count = rows.length;

  const title = `${label} — Kanaan Shop`;
  const descText = count > 0
    ? `Shop ${label} at Kanaan Shop — ${count} piece${count === 1 ? "" : "s"} available now, delivery all over Lebanon, cash on delivery.`
    : `Shop ${label} at Kanaan Shop. Delivery all over Lebanon, cash on delivery.`;

  const items = rows.slice(0, 12).map((r, i) => {
    const price = Math.round(Number(r.price) || 0);
    const discount = r.badge === "sale" ? Number(r.discount) || 0 : 0;
    const finalPrice = discount > 0 ? Math.round(price * (1 - discount / 100)) : price;
    const img = parseImages(r.images)[0]?.url || "";
    const absImg = img ? (/^https?:\/\//i.test(img) ? img : `${origin}${img.startsWith("/") ? "" : "/"}${img}`) : undefined;
    return {
      "@type": "ListItem",
      position: i + 1,
      url: `${origin}/product/${r.id}`,
      item: {
        "@type": "Product",
        name: r.name,
        image: absImg,
        url: `${origin}/product/${r.id}`,
        offers: { "@type": "Offer", price: finalPrice, priceCurrency: "USD" },
      },
    };
  });

  const listLd = jsonLd({
    "@context": "https://schema.org",
    "@type": "ItemList",
    name: `${label} — Kanaan Shop`,
    itemListElement: items,
  });

  const breadcrumbLd = jsonLd({
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: [
      { "@type": "ListItem", position: 1, name: "Shop", item: `${origin}/shop` },
      { "@type": "ListItem", position: 2, name: label, item: url },
    ],
  });

  const tags = `
    <title>${esc(title)}</title>
    <meta name="description" content="${esc(descText)}" />
    <link rel="canonical" href="${esc(url)}" />
    <meta property="og:type" content="website" />
    <meta property="og:site_name" content="Kanaan Shop" />
    <meta property="og:title" content="${esc(title)}" />
    <meta property="og:description" content="${esc(descText)}" />
    <meta property="og:url" content="${esc(url)}" />
    <meta name="twitter:card" content="summary" />
    <meta name="twitter:title" content="${esc(title)}" />
    <meta name="twitter:description" content="${esc(descText)}" />
    ${items.length ? `<script type="application/ld+json">${listLd}</script>` : ""}
    <script type="application/ld+json">${breadcrumbLd}</script>
  `;

  let html = await res.text();

  // Real listing content for crawlers (and a faster first paint for
  // shoppers) — see functions/_shared/ssr.js for why.
  try {
    html = injectContent(html, renderListingContent({
      title: label,
      intro: descText,
      products: rows.map((r) => {
        const img = parseImages(r.images)[0]?.url || "";
        return {
          id: r.id, name: r.name, price: Math.round(Number(r.price) || 0),
          discount: r.badge === "sale" ? Number(r.discount) || 0 : 0,
          image: img ? (/^https?:\/\//i.test(img) ? img : `${origin}${img.startsWith("/") ? "" : "/"}${img}`) : "",
        };
      }),
      origin,
    }));
  } catch { /* meta tags still apply */ }

  html = html
    .replace(/<title>[\s\S]*?<\/title>/i, "")
    .replace(/<meta\s+name="description"[^>]*>/gi, "")
    .replace(/<link\s+rel="canonical"[^>]*>/gi, "")
    .replace(/<meta\s+property="og:[^"]*"[^>]*>/gi, "")
    .replace(/<meta\s+name="twitter:[^"]*"[^>]*>/gi, "")
    .replace(/<\/head>/i, `${tags}\n  </head>`);

  const headers = new Headers(res.headers);
  headers.set("Cache-Control", "public, max-age=300");
  return new Response(html, { status: 200, headers });
}
