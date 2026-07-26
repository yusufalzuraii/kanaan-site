/* ============================================================
   SERVER-RENDERED CONTENT
   ------------------------------------------------------------
   The shop is a single-page app, which means the HTML that actually
   leaves the server is this and nothing more:

       <body><div id="root"></div></body>

   Every product name, price and description only exists after the
   browser has downloaded and run the JavaScript. Google can eventually
   render that, but it happens on a slower second pass — and Bing,
   Yandex, and every social/AI crawler mostly can't do it at all. So the
   shop was effectively invisible to them no matter how good the meta
   tags were.

   This writes the real content into #root on the server. React clears
   the container when it mounts and takes over as usual, so nothing
   about the live site changes — but a crawler that never runs a line of
   JavaScript still sees the full page.

   This is the pattern Google documents for SPAs, and it isn't cloaking:
   the crawler is shown exactly what the shopper is shown.

   Side benefit: a visitor on a slow connection now sees the product and
   its price while the JavaScript is still downloading, instead of a
   blank white screen.
   ============================================================ */

export const esc = (s) =>
  String(s == null ? "" : s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");

/* Inline styles only. The stylesheet uses CSS variables scoped to
   [data-theme], which this markup sits outside of — and it has to look
   right during the split second before React replaces it. */
const S = {
  page: "font-family:Inter,system-ui,sans-serif;background:#F2F2F4;color:#14141A;min-height:100vh;margin:0;padding:24px 16px;",
  wrap: "max-width:1100px;margin:0 auto;",
  crumb: "font-size:13px;color:rgba(20,20,26,0.55);margin-bottom:20px;",
  link: "color:rgba(20,20,26,0.55);text-decoration:none;",
  h1: "font-family:'Space Grotesk',Inter,sans-serif;font-size:30px;font-weight:700;margin:0 0 10px;line-height:1.2;",
  price: "font-family:'Space Grotesk',Inter,sans-serif;font-size:22px;font-weight:600;margin:0 0 16px;",
  was: "font-size:15px;color:rgba(20,20,26,0.45);text-decoration:line-through;margin-left:8px;font-weight:400;",
  desc: "font-size:15px;line-height:1.7;color:rgba(20,20,26,0.7);margin:0 0 20px;max-width:600px;",
  meta: "font-size:14px;color:rgba(20,20,26,0.6);margin:0 0 8px;",
  img: "width:100%;max-width:420px;aspect-ratio:4/5;object-fit:cover;border-radius:20px;display:block;margin-bottom:16px;background:#e8e8ec;",
  grid: "display:grid;grid-template-columns:repeat(auto-fill,minmax(160px,1fr));gap:20px;margin-top:20px;",
  card: "text-decoration:none;color:inherit;display:block;",
  cardImg: "width:100%;aspect-ratio:4/5;object-fit:cover;border-radius:14px;background:#e8e8ec;display:block;",
  cardName: "font-size:14px;margin:8px 0 2px;",
  cardPrice: "font-family:'Space Grotesk',Inter,sans-serif;font-size:14px;font-weight:600;margin:0;",
};

const money = (n) => `$${Math.round(Number(n) || 0)}`;

/** Full product page content. */
export function renderProductContent({ product, origin, categoryLabel, images, inStock }) {
  const finalPrice = product.discount > 0
    ? Math.round(product.price * (1 - product.discount / 100))
    : product.price;

  const gallery = images.slice(0, 4)
    .map((url) => `<img src="${esc(url)}" alt="${esc(product.name)}" style="${S.img}" />`)
    .join("\n      ");

  return `<div style="${S.page}"><div style="${S.wrap}">
      <nav style="${S.crumb}">
        <a href="${origin}/" style="${S.link}">Kanaan Shop</a> ›
        <a href="${origin}/shop" style="${S.link}">Shop</a> ›
        <a href="${origin}/shop/${esc(product.category)}" style="${S.link}">${esc(categoryLabel)}</a>
      </nav>
      ${gallery}
      <h1 style="${S.h1}">${esc(product.name)}</h1>
      <p style="${S.price}">${money(finalPrice)}${
        product.discount > 0 ? `<span style="${S.was}">${money(product.price)}</span>` : ""
      }</p>
      ${product.desc ? `<p style="${S.desc}">${esc(product.desc)}</p>` : ""}
      ${product.colors.length ? `<p style="${S.meta}">Colours: ${esc(product.colors.join(", "))}</p>` : ""}
      ${product.sizes.length ? `<p style="${S.meta}">Sizes: ${esc(product.sizes.join(", "))}</p>` : ""}
      <p style="${S.meta}">${inStock ? "In stock" : "Out of stock"} · Delivery across Lebanon · Cash on delivery</p>
    </div></div>`;
}

/** Category / subcategory listing content. */
export function renderListingContent({ title, intro, products, origin }) {
  const cards = products.slice(0, 24).map((p) => {
    const finalPrice = p.discount > 0 ? Math.round(p.price * (1 - p.discount / 100)) : p.price;
    const img = p.image ? `<img src="${esc(p.image)}" alt="${esc(p.name)}" style="${S.cardImg}" />` : "";
    return `<a href="${origin}/product/${esc(p.id)}" style="${S.card}">
          ${img}
          <p style="${S.cardName}">${esc(p.name)}</p>
          <p style="${S.cardPrice}">${money(finalPrice)}</p>
        </a>`;
  }).join("\n        ");

  return `<div style="${S.page}"><div style="${S.wrap}">
      <nav style="${S.crumb}">
        <a href="${origin}/" style="${S.link}">Kanaan Shop</a> ›
        <a href="${origin}/shop" style="${S.link}">Shop</a>
      </nav>
      <h1 style="${S.h1}">${esc(title)}</h1>
      ${intro ? `<p style="${S.desc}">${esc(intro)}</p>` : ""}
      <div style="${S.grid}">
        ${cards}
      </div>
    </div></div>`;
}

/** Swap the empty #root for real content, leaving everything else alone. */
export function injectContent(html, content) {
  return html.replace(
    /<div id="root"><\/div>/,
    `<div id="root">${content}</div>`
  );
}
