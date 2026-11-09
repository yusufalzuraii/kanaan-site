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

// Safe to drop straight into a <script type="application/ld+json">: escapes
// the one sequence that would otherwise break out of the tag early.
const jsonLd = (obj) => JSON.stringify(obj).replace(/</g, "\\u003c");

import { parseImages, rowToProduct } from "../_shared/util.js";
import { embedCatalog } from "../_shared/catalog.js";
import { loadCategories } from "../_shared/site.js";
import { loadSettings } from "../_shared/settings.js";
import { renderProductContent, injectContent, headTags, setHead, productDescription, offerExtras } from "../_shared/ssr.js";
import { cardsFrom } from "../_shared/seo.js";
import { summaryOf, approvedOf } from "../_shared/reviews.js";
import { esc } from "../_shared/ssr.js";

export async function onRequestGet(context) {
  const { request, env, params, next } = context;

  // Always fall back to the normal app if anything is off.
  let res;
  try {
    res = await next(fresh(context.request));
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
      "SELECT id, name, category, subcategory, description, images, price, badge, discount, sold_out, colors, sizes FROM products WHERE id = ? AND active = 1 AND app_exclusive = 0"
    ).bind(slug).first();
  } catch {
    return res;
  }
  if (!row) {
    // a product taken off the site: its link (shared on WhatsApp, Instagram, Google) never dead-ends —
    // it goes to the product that replaced it, or to its category
    try {
      const gone = await env.DB.prepare("SELECT category, replaced_by FROM products WHERE id = ? AND active = 0").bind(slug).first();
      if (gone) {
        let to = ""; let moved = false;
        if (gone.replaced_by) { const n = await env.DB.prepare("SELECT id FROM products WHERE id = ? AND active = 1").bind(gone.replaced_by).first(); if (n) { to = `/product/${n.id}`; moved = true; } }
        if (!to) { const cats = await loadCategories(env); to = cats.ids.includes(gone.category) ? `/shop/${gone.category}` : "/shop"; }
        // replaced for good: a permanent move; only hidden (it may come back): a temporary one browsers don't keep
        return new Response(null, { status: moved ? 301 : 302, headers: { Location: new URL(to, request.url).toString(), "Cache-Control": moved ? "public, max-age=86400" : "no-store" } });
      }
    } catch { /* fall back to the app */ }
    // never on the site: the app shows its own "not found", and search
    // engines are told so (404) instead of a copy of the homepage
    let html = await res.text();
    html = setHead(html, headTags({ title: "Not found — Kanaan Shop", description: "This piece isn't in the shop. Browse all the pieces at kanaanshop.com/shop.", url: "", noindex: true }));
    const h404 = new Headers(res.headers);
    h404.set("Cache-Control", "no-store");
    h404.delete("ETag");
    h404.delete("Last-Modified");
    return new Response(html, { status: 404, headers: h404 });
  }

  const origin = new URL(request.url).origin;
  const url = `${origin}/product/${row.id}`;

  const allImages = parseImages(row.images).map((im) => im.url).filter(Boolean);
  const firstImage = allImages[0] || "";
  const absolute = (u) => (u ? (/^https?:\/\//i.test(u) ? u : `${origin}${u.startsWith("/") ? "" : "/"}${u}`) : "");
  const image = firstImage ? absolute(firstImage) : `${origin}/logo-full.png`;
  const allImagesAbsolute = allImages.map(absolute);

  const price = Math.round(Number(row.price) || 0);
  const discount = row.badge === "sale" ? Number(row.discount) || 0 : 0;
  const finalPrice = discount > 0 ? Math.round(price * (1 - discount / 100)) : price;

  const product = rowToProduct(row);
  const [cats, settings] = await Promise.all([loadCategories(env), loadSettings(env).catch(() => null)]);
  const categoryLabel = cats.labels[row.category] || "Menswear";
  const title = `${row.name} — Men's ${categoryLabel.toLowerCase()}, $${finalPrice} | Kanaan Shop`;
  const descText = productDescription({ name: row.name, categoryLabel, colors: product.colors, sizes: product.sizes, price: finalPrice, desc: row.description });

  // Sold out: the owner's switch, or — when the piece's stock is counted —
  // nothing left in any colour or size
  let soldOut = !!row.sold_out;
  if (!soldOut) {
    try {
      const v = await env.DB.prepare("SELECT COUNT(*) AS n, COALESCE(SUM(MAX(quantity - reserved, 0)), 0) AS left FROM variants WHERE product_id = ?").bind(row.id).first();
      if (v && Number(v.n) > 0 && Number(v.left) <= 0) soldOut = true;
    } catch { /* not counted: in stock */ }
  }
  const availability = soldOut ? "https://schema.org/OutOfStock" : "https://schema.org/InStock";

  // a few more pieces from the same category, linked from the page
  let related = [];
  try {
    const rr = (await env.DB.prepare("SELECT id, name, price, badge, discount, images FROM products WHERE active = 1 AND app_exclusive = 0 AND sold_out = 0 AND category = ? AND id != ? ORDER BY created_at DESC LIMIT 8").bind(row.category, row.id).all()).results || [];
    related = cardsFrom(rr, origin).map((c) => ({ ...c, price: c.finalPrice }));
  } catch { related = []; }

  // real reviews (approved by the shop): the stars in search results, and the reviews on the page itself
  let rev = null;
  try {
    const summary = await summaryOf(env, row.id);
    if (summary.count > 0) rev = { summary, list: await approvedOf(env, row.id, 10) };
  } catch { rev = null; }
  const day = (ms) => new Date(Number(ms) || Date.now()).toISOString().slice(0, 10);
  const reviewLd = rev ? {
    aggregateRating: { "@type": "AggregateRating", ratingValue: rev.summary.avg, reviewCount: rev.summary.count, ratingCount: rev.summary.count, bestRating: 5, worstRating: 1 },
    review: rev.list.map((r) => ({
      "@type": "Review",
      reviewRating: { "@type": "Rating", ratingValue: r.rating, bestRating: 5, worstRating: 1 },
      author: { "@type": "Person", name: r.name },
      datePublished: day(r.date),
      ...(r.text ? { reviewBody: r.text } : {}),
    })),
  } : {};

  const productLd = jsonLd({
    "@context": "https://schema.org",
    "@type": "Product",
    name: row.name,
    description: descText,
    image: allImagesAbsolute.length ? allImagesAbsolute : [image],
    sku: row.id,
    category: categoryLabel,
    color: product.colors.join(", "),
    size: product.sizes.join(", "),
    audience: { "@type": "PeopleAudience", suggestedGender: "male" },
    brand: { "@type": "Brand", name: "Kanaan Shop" },
    offers: {
      "@type": "Offer",
      url,
      priceCurrency: "USD",
      price: finalPrice,
      // prices hold until the owner changes them; Google asks for a date
      priceValidUntil: `${new Date().getUTCFullYear() + 1}-12-31`,
      availability,
      itemCondition: "https://schema.org/NewCondition",
      areaServed: { "@type": "Country", name: "Lebanon" },
      seller: { "@type": "Organization", name: "Kanaan Shop", "@id": "https://kanaanshop.com/#store" },
      ...offerExtras(settings),
    },
    ...reviewLd,
  }).replace(/\$/g, "\\u0024"); // "$" written the JSON way: a "$&" in someone's words must not be read as a pattern when the head is put in

  const breadcrumbLd = jsonLd({
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: [
      { "@type": "ListItem", position: 1, name: "Shop", item: `${origin}/shop` },
      { "@type": "ListItem", position: 2, name: categoryLabel, item: `${origin}/shop/${row.category}` },
      { "@type": "ListItem", position: 3, name: row.name, item: url },
    ],
  });

  const tags = headTags({
    title,
    description: descText,
    url,
    image,
    imageW: 800,
    imageH: 1000,
    type: "product",
    extra: `<meta property="product:price:amount" content="${finalPrice}" />
    <meta property="product:price:currency" content="USD" />
    <meta property="product:availability" content="${soldOut ? "out of stock" : "in stock"}" />
    <script type="application/ld+json">${productLd}</script>
    <script type="application/ld+json">${breadcrumbLd}</script>`,
  });

  let html = await res.text();

  /* Write the real product content into the page. Without this, the HTML
     a crawler receives is an empty <div id="root"> — the product name,
     price and description simply don't exist for any engine that doesn't
     run JavaScript. React replaces it the moment it mounts. */
  try {
    html = injectContent(
      html,
      renderProductContent({
        product,
        origin,
        categoryLabel,
        images: allImagesAbsolute.length ? allImagesAbsolute : [image],
        inStock: !soldOut,
        // the whole words for the page itself (the meta description above has the opening only)
        description: row.description ? String(row.description).replace(/\s*\n+\s*/g, " · ").replace(/^ · | · $/g, "") : descText,
        related,
      }).replace(/<\/div><\/div>\s*$/, () => `${reviewsHtml(rev)}</div></div>`)
    );
  } catch { /* the meta tags below still apply even if this part fails */ }

  // Drop the generic tags, then insert the product-specific ones.
  html = setHead(html, tags);

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

/* The shell, asked plainly: without the browser's If-None-Match / If-Modified-Since (the shell's "not changed"
   would answer for this page, which did change). */
function fresh(request) {
  const h = new Headers(request.headers);
  h.delete("If-None-Match");
  h.delete("If-Modified-Since");
  return new Request(request.url, { method: "GET", headers: h });
}

/* The approved reviews written into the page for crawlers that don't run JavaScript (the same ones the page shows). */
function reviewsHtml(rev) {
  if (!rev) return "";
  const stars = (n) => "★".repeat(n) + "☆".repeat(5 - n);
  const h2 = "font-family:'Space Grotesk',Inter,sans-serif;font-size:18px;font-weight:700;margin:24px 0 10px;";
  const item = "margin:0 0 14px;max-width:600px;font-size:14px;line-height:1.6;color:rgba(20,20,26,0.75);";
  return `<section aria-label="Reviews"><h2 style="${h2}">Reviews · ${rev.summary.avg} out of 5 (${rev.summary.count})</h2>
      ${rev.list.map((r) => `<div style="${item}"><b>${stars(r.rating)}</b> ${esc(r.name)} · Verified buyer${r.bought ? ` · bought ${esc(r.bought)}` : ""}${r.text ? `<br />${esc(r.text)}` : ""}${r.reply ? `<br /><i>Kanaan Shop: ${esc(r.reply)}</i>` : ""}</div>`).join("\n      ")}
    </section>`.replace(/\$/g, "&#36;"); // a "$&" in someone's words must stay words when the page is put together
}
