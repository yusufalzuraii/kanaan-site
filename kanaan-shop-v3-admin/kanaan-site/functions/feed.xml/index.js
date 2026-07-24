/* GET /feed.xml
   ------------------------------------------------------------
   A real Google Shopping product feed (RSS 2.0 + the Google Merchant
   "g:" namespace), generated live from the same products table every
   request — never stale, never needs re-uploading by hand. This is
   what Google Merchant Center's "Data source" should point at, instead
   of a regular webpage (which fails with "format not supported: HTML").

   Field choices follow Google's required/recommended spec for Apparel
   & Accessories: id, title, description, link, image_link, availability,
   price, brand, condition, product_type. Sale items also get
   sale_price so Google Shopping shows the strikethrough price. */

import { rowToProduct, CATEGORY_LABELS, loadStock } from "../_shared/util.js";

const esc = (s) =>
  String(s == null ? "" : s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");

export async function onRequestGet(context) {
  const { env } = context;
  const origin = "https://kanaanshop.com";

  let products = [];
  try {
    const { results } = await env.DB.prepare(
      "SELECT * FROM products WHERE active = 1 ORDER BY sort_order ASC, created_at DESC"
    ).all();
    products = (results || []).map(rowToProduct);
  } catch {
    // Empty feed rather than a broken response — Merchant Center will
    // just see zero items rather than an error.
  }

  let stock = {};
  try {
    stock = await loadStock(env, products.map((p) => p.id));
  } catch { /* untracked products stay "in stock" below */ }

  const absolute = (u) => (u ? (/^https?:\/\//i.test(u) ? u : `${origin}${u.startsWith("/") ? "" : "/"}${u}`) : "");

  const items = products
    .filter((p) => p.images.length > 0) // Google requires a real image — skip photoless placeholders
    .map((p) => {
      const s = stock[p.id];
      const inStock = p.soldOut
        ? false
        : !s
          ? true // not stock-tracked = always available
          : Object.values(s.stock).some((n) => n > 0);

      const price = p.price;
      const finalPrice = p.discount > 0 ? Math.round(price * (1 - p.discount / 100)) : price;
      const onSale = p.discount > 0 && finalPrice < price;

      const link = `${origin}/product/${p.id}`;
      const image = absolute(p.images[0].url);
      const extraImages = p.images.slice(1, 11).map((im) => absolute(im.url)); // Google allows up to 10 extra images
      const desc = (p.desc || `${p.name} — available now at Kanaan Shop.`).replace(/\s+/g, " ").trim().slice(0, 5000);
      const productType = CATEGORY_LABELS[p.category] || "Menswear";

      return `
    <item>
      <g:id>${esc(p.id)}</g:id>
      <title>${esc(p.name)}</title>
      <description>${esc(desc)}</description>
      <link>${esc(link)}</link>
      <g:image_link>${esc(image)}</g:image_link>
      ${extraImages.map((u) => `<g:additional_image_link>${esc(u)}</g:additional_image_link>`).join("\n      ")}
      <g:availability>${inStock ? "in stock" : "out of stock"}</g:availability>
      <g:price>${price}.00 USD</g:price>
      ${onSale ? `<g:sale_price>${finalPrice}.00 USD</g:sale_price>` : ""}
      <g:brand>Kanaan Shop</g:brand>
      <g:condition>new</g:condition>
      <g:product_type>${esc(productType)}</g:product_type>
      <g:google_product_category>Apparel &amp; Accessories</g:google_product_category>
      <g:shipping>
        <g:country>LB</g:country>
        <g:price>5.00 USD</g:price>
      </g:shipping>
    </item>`;
    })
    .join("\n");

  const body = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:g="http://base.google.com/ns/1.0">
  <channel>
    <title>Kanaan Shop</title>
    <link>${origin}</link>
    <description>Menswear from Saida, Lebanon</description>
${items}
  </channel>
</rss>`;

  return new Response(body, {
    headers: { "Content-Type": "application/xml; charset=utf-8", "Cache-Control": "public, max-age=1800" },
  });
}
