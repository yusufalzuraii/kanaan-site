/* GET /product/:slug
   ------------------------------------------------------------
   Serves the normal single-page app, but with this product's real
   title, description and photo injected into the HTML <head> first.

   Why: when someone pastes a product link into WhatsApp, Instagram or
   Facebook, their crawler reads the raw HTML and never runs JavaScript.
   Without this, every product link showed the same generic site preview.
   Now each link shows the product's own photo, name and price.

   The page itself still behaves exactly as before for real visitors —
   we only rewrite the tags in <head>. */

const esc = (s) =>
  String(s == null ? "" : s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");

import { parseImages } from "../_shared/util.js";

export async function onRequestGet(context) {
  const { request, env, params, next } = context;

  // Always fall back to the normal app if anything is off.
  let res;
  try {
    res = await next();
  } catch {
    return new Response("Not found", { status: 404 });
  }

  const ct = res.headers.get("Content-Type") || "";
  if (!ct.includes("text/html")) return res;

  const slug = String(params.slug || "").trim();
  if (!slug || !env.DB) return res;

  let row;
  try {
    row = await env.DB.prepare(
      "SELECT id, name, description, images, price, badge, discount FROM products WHERE id = ? AND active = 1"
    ).bind(slug).first();
  } catch {
    return res;
  }
  if (!row) return res;

  const origin = new URL(request.url).origin;
  const url = `${origin}/product/${row.id}`;

  const firstImage = parseImages(row.images)[0]?.url || "";
  const image = firstImage
    ? (/^https?:\/\//i.test(firstImage) ? firstImage : `${origin}${firstImage.startsWith("/") ? "" : "/"}${firstImage}`)
    : `${origin}/logo-full.png`;

  const price = Math.round(Number(row.price) || 0);
  const discount = row.badge === "sale" ? Number(row.discount) || 0 : 0;
  const finalPrice = discount > 0 ? Math.round(price * (1 - discount / 100)) : price;

  const title = `${row.name} — $${finalPrice} | Kanaan Shop`;
  const descText =
    (row.description && String(row.description).replace(/\s+/g, " ").trim().slice(0, 200)) ||
    `${row.name} — available now at Kanaan Shop. Delivery all over Lebanon, cash on delivery.`;

  const tags = `
    <title>${esc(title)}</title>
    <meta name="description" content="${esc(descText)}" />
    <link rel="canonical" href="${esc(url)}" />
    <meta property="og:type" content="product" />
    <meta property="og:site_name" content="Kanaan Shop" />
    <meta property="og:title" content="${esc(title)}" />
    <meta property="og:description" content="${esc(descText)}" />
    <meta property="og:url" content="${esc(url)}" />
    <meta property="og:image" content="${esc(image)}" />
    <meta property="og:image:width" content="800" />
    <meta property="og:image:height" content="1000" />
    <meta property="product:price:amount" content="${finalPrice}" />
    <meta property="product:price:currency" content="USD" />
    <meta name="twitter:card" content="summary_large_image" />
    <meta name="twitter:title" content="${esc(title)}" />
    <meta name="twitter:description" content="${esc(descText)}" />
    <meta name="twitter:image" content="${esc(image)}" />
  `;

  let html = await res.text();

  // Drop the generic tags, then insert the product-specific ones.
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
