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

import { COLORS } from "../../src/palette.js";

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
  h2: "font-family:'Space Grotesk',Inter,sans-serif;font-size:18px;font-weight:700;margin:24px 0 10px;",
  navWrap: "margin:0 0 8px;",
  chip: "display:inline-block;font-size:14px;color:#14141A;text-decoration:none;border:1px solid rgba(20,20,26,0.14);border-radius:999px;padding:6px 12px;margin:0 6px 8px 0;",
};

const money = (n) => `$${Math.round(Number(n) || 0)}`;

/* The small copy of an uploaded photo ("-thumb" before the extension, made when it was uploaded): what a card
   or a thumbnail shows. These pages are on screen only until the app takes over, and the app's cards show the
   very same small copies — so they're fetched once, and a category page no longer pulls every piece's full
   photo (a third of a megabyte each: 33 of them, 11 MB, on Jeans). The full photos stay in the page's
   structured data for search engines. A photo without a small copy falls back to the full one. */
export function smallPhoto(url) {
  const u = String(url || "");
  const m = u.match(/^((?:https?:\/\/[^/]+)?\/img\/[^?#]*)(\.[a-z0-9]+)$/i);
  if (!m || /-thumb$/i.test(m[1])) return "";
  return `${m[1]}-thumb${m[2]}`;
}
function cardImg(url, alt, style, eager) {
  const small = smallPhoto(url);
  const src = small || url;
  const back = small ? ` data-full="${esc(url)}" onerror="this.onerror=null;this.src=this.dataset.full"` : "";
  return `<img src="${esc(src)}" alt="${esc(alt)}" style="${style}" width="480" height="600"${eager ? "" : ' loading="lazy"'} decoding="async"${back} />`;
}

/** Full product page content. */
export function renderProductContent({ product, origin, categoryLabel, images, inStock, description, related = [] }) {
  const finalPrice = product.discount > 0
    ? Math.round(product.price * (1 - product.discount / 100))
    : product.price;

  // the first photo is fetched at once (it's the one the page opens on); the others only if someone scrolls to
  // them before the app takes over — search engines read them all the same
  const gallery = images.slice(0, 4)
    .map((url, i) => (i === 0 ? `<img src="${esc(url)}" alt="${esc(product.name)}" style="${S.img}" fetchpriority="high" />` : cardImg(url, product.name, S.img, false)))
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
      ${description || product.desc ? `<p style="${S.desc}">${esc(description || product.desc)}</p>` : ""}
      ${product.colors.length ? `<p style="${S.meta}">Colours: ${esc(product.colors.join(", "))}</p>` : ""}
      ${product.sizes.length ? `<p style="${S.meta}">Sizes: ${esc(product.sizes.join(", "))}</p>` : ""}
      <p style="${S.meta}">${inStock ? "In stock" : "Out of stock"} · Delivery across Lebanon · Cash on delivery</p>
      ${related.length ? `<h2 style="${S.h2}">More ${esc(categoryLabel)}</h2>
      <div style="${S.grid}">
        ${related.map((p) => `<a href="${origin}/product/${esc(p.id)}" style="${S.card}">
          ${p.image ? cardImg(p.image, p.name, S.cardImg, false) : ""}
          <p style="${S.cardName}">${esc(p.name)}</p>
          <p style="${S.cardPrice}">${money(p.price)}</p>
        </a>`).join("\n        ")}
      </div>` : ""}
    </div></div>`;
}

/** Category / subcategory listing content. `nav` is a list of
    { href, label, count } links (the shop's categories, or a category's
    fits) so a crawler can reach every listing from any of them. */
export function renderListingContent({ title, intro, products, origin, nav = [], navTitle = "Shop by category", limit = 48 }) {
  const links = nav.length
    ? `<nav aria-label="${esc(navTitle)}" style="${S.navWrap}"><h2 style="${S.h2}">${esc(navTitle)}</h2>${nav.map((n) => `<a href="${esc(n.href)}" style="${S.chip}">${esc(n.label)}${n.count ? ` (${n.count})` : ""}</a>`).join(" ")}</nav>`
    : "";
  const cards = products.slice(0, limit).map((p, i) => {
    const finalPrice = p.discount > 0 ? Math.round(p.price * (1 - p.discount / 100)) : p.price;
    // the first row straight away (the app's first cards are the same small copies), the rest as they're reached
    const img = p.image ? cardImg(p.image, p.name, S.cardImg, i < 4) : "";
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
      ${links}
      <div style="${S.grid}">
        ${cards}
      </div>
    </div></div>`;
}

/** Swap the empty #root for real content, leaving everything else alone. */
export function injectContent(html, content) {
  return html.replace(
    /<div id="root"><\/div>/,
    () => `<div id="root">${content}</div>` // a function: "$&" in the words stays as it is
  );
}

/* ------------------------------------------------------------------
   The <head> of a page: one place for the tags every server-rendered page
   sets, so none of them forgets its own canonical address, picture or
   description again.
   ------------------------------------------------------------------ */
export function headTags({ title, description, url, image, imageW, imageH, type = "website", noindex = false, extra = "" }) {
  const img = image || "https://kanaanshop.com/logo-full.png";
  return `
    <title>${esc(title)}</title>
    <meta name="description" content="${esc(description)}" />
    ${noindex ? '<meta name="robots" content="noindex, follow" />' : ""}
    ${url ? `<link rel="canonical" href="${esc(url)}" />` : ""}
    <meta property="og:type" content="${esc(type)}" />
    <meta property="og:site_name" content="Kanaan Shop" />
    <meta property="og:locale" content="en_US" />
    <meta property="og:title" content="${esc(title)}" />
    <meta property="og:description" content="${esc(description)}" />
    ${url ? `<meta property="og:url" content="${esc(url)}" />` : ""}
    <meta property="og:image" content="${esc(img)}" />
    ${imageW ? `<meta property="og:image:width" content="${imageW}" />\n    <meta property="og:image:height" content="${imageH}" />` : ""}
    <meta name="twitter:card" content="${image ? "summary_large_image" : "summary"}" />
    <meta name="twitter:title" content="${esc(title)}" />
    <meta name="twitter:description" content="${esc(description)}" />
    <meta name="twitter:image" content="${esc(img)}" />
    ${extra}
  `;
}

/** Drop the shell's generic tags and put this page's own in. */
export function setHead(html, tags) {
  return html
    .replace(/<title>[\s\S]*?<\/title>/i, "")
    .replace(/<meta\s+name="description"[^>]*>/gi, "")
    .replace(/<meta\s+name="robots"[^>]*>/gi, "")
    .replace(/<link\s+rel="canonical"[^>]*>/gi, "")
    .replace(/<meta\s+property="og:[^"]*"[^>]*>/gi, "")
    .replace(/<meta\s+name="twitter:[^"]*"[^>]*>/gi, "")
    .replace(/<\/head>/i, () => `${tags}\n  </head>`); // a function: "$&" or "$'" in a description stays as it is
}

export const jsonLd = (obj) => JSON.stringify(obj).replace(/</g, "\\u003c");

export const absoluteUrl = (origin, u) => (u ? (/^https?:\/\//i.test(u) ? u : `${origin}${u.startsWith("/") ? "" : "/"}${u}`) : "");

const colorName = (k) => (COLORS[k] ? COLORS[k].label.toLowerCase() : String(k || "").replace(/-/g, " "));
const list = (a) => (a.length <= 1 ? a.join("") : `${a.slice(0, -1).join(", ")} and ${a[a.length - 1]}`);
/** "S to XL", "29 to 40", or the one size */
function sizeRange(sizes) {
  const s = (sizes || []).filter((x) => x && x !== "One Size");
  if (!s.length) return "";
  return s.length === 1 ? s[0] : `${s[0]} to ${s[s.length - 1]}`;
}

/** The words a search result shows for a piece, when the owner hasn't
    written any: what it is, its colours and sizes, its price, and how the
    shop sells. Under 160 characters where it can be. */
/** The opening of a piece's words: the lines before "Fit: …", "Look: …" and the like (see src/components/SiteBits.jsx). */
export function leadOf(desc) {
  const lines = String(desc || "").replace(/\r\n/g, "\n").split("\n");
  const i = lines.findIndex((l) => /^\s*(fit|look|details|wear it with|fabric|care)\s*[:：]/i.test(l));
  return (i < 0 ? lines : lines.slice(0, i)).join(" ").replace(/\s+/g, " ").trim();
}

export function productDescription({ name, categoryLabel, colors = [], sizes = [], price, desc }) {
  const own = leadOf(desc) || String(desc || "").replace(/\s+/g, " ").trim();
  if (own) return own.slice(0, 200);
  const kind = categoryLabel ? `Men's ${String(categoryLabel).toLowerCase()}` : "Menswear";
  const cols = colors.slice(0, 4).map(colorName);
  const range = sizeRange(sizes);
  const parts = [`${name}: ${kind}${cols.length ? ` in ${list(cols)}` : ""}${range ? `, sizes ${range}` : ""}.`];
  parts.push(`$${price} at Kanaan Shop, Saida. Delivery all over Lebanon, cash on delivery.`);
  return parts.join(" ");
}

/* The shop itself, for Google's business panel: address, phone, the
   opening hours the owner sets in Kanaan POS. */
const DAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
export function storeLd(settings) {
  const ld = {
    "@context": "https://schema.org",
    "@type": "ClothingStore",
    "@id": "https://kanaanshop.com/#store",
    name: "Kanaan Shop",
    url: "https://kanaanshop.com",
    logo: "https://kanaanshop.com/logo-compact.png",
    image: "https://kanaanshop.com/home/shop-front.webp",
    description: "Menswear shop in Saida, Lebanon: jeans, jackets, hoodies, sweatshirts and knitwear, with delivery all over Lebanon and cash on delivery.",
    telephone: "+96181445681",
    priceRange: "$$",
    currenciesAccepted: "USD",
    paymentAccepted: "Cash",
    address: { "@type": "PostalAddress", streetAddress: "Eastern Boulevard", addressLocality: "Saida", addressRegion: "South Governorate", addressCountry: "LB" },
    hasMap: "https://maps.app.goo.gl/APgMmZV7bCxhFXSz7",
    areaServed: { "@type": "Country", name: "Lebanon" },
    sameAs: ["https://www.instagram.com/kanaan.shop"],
  };
  const days = settings && settings.hours && Array.isArray(settings.hours.days) ? settings.hours.days : null;
  if (days) {
    const spec = [];
    days.forEach((d, i) => { if (d) spec.push({ "@type": "OpeningHoursSpecification", dayOfWeek: `https://schema.org/${DAYS[i]}`, opens: d[0], closes: d[1] }); });
    if (spec.length) ld.openingHoursSpecification = spec;
  }
  return ld;
}

/* What a shopper is promised with every piece: delivery to Lebanon and the
   exchange window (both set by the owner), for each product's offer. */
export function offerExtras(settings) {
  const fee = settings && Number.isFinite(Number(settings.deliveryFee)) ? Number(settings.deliveryFee) : 5;
  const days = settings && Number(settings.exchangeDays) > 0 ? Number(settings.exchangeDays) : 0;
  const out = {
    shippingDetails: {
      "@type": "OfferShippingDetails",
      shippingRate: { "@type": "MonetaryAmount", value: fee, currency: "USD" },
      shippingDestination: { "@type": "DefinedRegion", addressCountry: "LB" },
      deliveryTime: {
        "@type": "ShippingDeliveryTime",
        handlingTime: { "@type": "QuantitativeValue", minValue: 0, maxValue: 1, unitCode: "DAY" },
        transitTime: { "@type": "QuantitativeValue", minValue: 1, maxValue: 3, unitCode: "DAY" },
      },
    },
  };
  out.hasMerchantReturnPolicy = days
    ? { "@type": "MerchantReturnPolicy", applicableCountry: "LB", returnPolicyCategory: "https://schema.org/MerchantReturnFiniteReturnWindow", merchantReturnDays: days, refundType: "https://schema.org/ExchangeRefund", returnMethod: "https://schema.org/ReturnInStore", returnFees: "https://schema.org/FreeReturn" }
    : { "@type": "MerchantReturnPolicy", applicableCountry: "LB", returnPolicyCategory: "https://schema.org/MerchantReturnNotPermitted" };
  return out;
}
