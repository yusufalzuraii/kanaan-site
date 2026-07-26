/* Shared helpers for all API functions. */

/* Categories, in the order they appear everywhere: tops, then bottoms,
   then sets/underwear, then footwear, then accessories and the
   Old Money edit last. */
export const CATEGORY_IDS = [
  "tshirts", "shirts", "jeans", "pants", "shorts",
  "sets", "underwear", "shoes", "slippers", "accessories", "oldmoney",
];
export const CATEGORY_LABELS = {
  tshirts: "T-Shirts", shirts: "Shirts", jeans: "Jeans", pants: "Pants",
  shorts: "Shorts", sets: "Sets", underwear: "Underwear", shoes: "Shoes",
  slippers: "Slippers", accessories: "Accessories", oldmoney: "Old Money Collection",
};

/* Sub-categories (fits). Only these two categories have them; everything
   else just has an empty subcategory. */
export const SUBCATEGORIES = {
  tshirts: [
    { id: "oversized", label: "Oversized" },
    { id: "regular", label: "Regular fit" },
  ],
  jeans: [
    { id: "baggy", label: "Baggy" },
    { id: "regular", label: "Regular" },
  ],
};

export function subcategoriesFor(category) {
  return SUBCATEGORIES[category] || [];
}

export function isValidSub(category, sub) {
  return subcategoriesFor(category).some((s) => s.id === sub);
}

/* Keep in sync with src/palette.js — never remove a key, products
   in the database point at these. */
export const COLOR_KEYS = [
  "black","white","gray","navy","beige","brown","red","blue","green","coral",
  "charcoal","graphite","slate","silver","lightgray","offwhite","ivory","cream",
  "oatmeal","sand","stone","taupe","khaki","tan","camel","mocha","coffee","chocolate",
  "crimson","rust","terracotta","maroon","burgundy","wine","oxblood","salmon","blush",
  "pink","dustyrose","hotpink","fuchsia","magenta",
  "orange","apricot","peach","copper","amber","mustard","gold","yellow","lemon","butter",
  "olive","army","forest","emerald","sage","pistachio","mint","lime","chartreuse",
  "teal","turquoise","aqua","petrol","sky","babyblue","denim","cobalt","royal","indigo","midnight",
  "lavender","lilac","mauve","violet","purple","plum","aubergine",
  "multicolor","striped","printed",
];

export function json(data, status = 200, extraHeaders = {}) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store", ...extraHeaders },
  });
}

export function slugify(str) {
  return String(str).toLowerCase().trim().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
}

// Which placeholder icon a category uses when a product has no photo.
export function iconForCategory(category) {
  if (category === "shoes" || category === "slippers") return "shoe";
  if (category === "shirts" || category === "oldmoney") return "shirt-button";
  if (category === "underwear") return "underwear";
  if (category === "accessories") return "accessory";
  if (category === "jeans" || category === "pants" || category === "shorts") return "pants";
  return "shirt";
}

/* ---------- auth (stateless signed cookie) ---------- */
export async function makeToken(password) {
  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey("raw", enc.encode(password), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const sig = await crypto.subtle.sign("HMAC", key, enc.encode("kanaan-admin-v1"));
  return [...new Uint8Array(sig)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

function safeEqual(a, b) {
  if (typeof a !== "string" || typeof b !== "string" || a.length !== b.length) return false;
  let r = 0;
  for (let i = 0; i < a.length; i++) r |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return r === 0;
}

export async function isAuthed(request, env) {
  if (!env.ADMIN_PASSWORD) return false;
  const cookie = request.headers.get("Cookie") || "";
  const m = cookie.match(/(?:^|;\s*)kanaan_admin=([a-f0-9]+)/);
  if (!m) return false;
  const expected = await makeToken(env.ADMIN_PASSWORD);
  return safeEqual(m[1], expected);
}

export function cookieHeader(token) {
  // 30 days
  return `kanaan_admin=${token}; HttpOnly; Secure; SameSite=Strict; Path=/; Max-Age=2592000`;
}
export function clearCookieHeader() {
  return "kanaan_admin=; HttpOnly; Secure; SameSite=Strict; Path=/; Max-Age=0";
}

/* ---------- product shaping ---------- */
/* Photos are stored as JSON: [{ "url": "/img/...", "color": "black" }].
   Older products stored a plain comma-separated list of urls with no colors —
   we still read those correctly so nothing breaks. */
export function parseImages(raw) {
  const v = String(raw || "").trim();
  if (!v) return [];
  if (v.startsWith("[")) {
    try {
      const arr = JSON.parse(v);
      if (Array.isArray(arr)) {
        return arr
          .map((x) => (typeof x === "string" ? { url: x.trim(), color: null } : { url: String(x.url || "").trim(), color: x.color || null }))
          .filter((x) => x.url);
      }
    } catch { /* fall through to legacy */ }
  }
  return v.split(",").map((s) => s.trim()).filter(Boolean).map((url) => ({ url, color: null }));
}

export function serializeImages(list) {
  const arr = (Array.isArray(list) ? list : [])
    .map((x) => (typeof x === "string" ? { url: x.trim(), color: null } : { url: String(x.url || "").trim(), color: x.color || null }))
    .filter((x) => x.url)
    .map((x) => ({ url: x.url, color: x.color && COLOR_KEYS.includes(x.color) ? x.color : null }));
  return JSON.stringify(arr);
}

export function rowToProduct(r) {
  const split = (s) => String(s || "").split(",").map((x) => x.trim()).filter(Boolean);
  const colors = split(r.colors);
  const sizes = split(r.sizes);
  const images = parseImages(r.images);
  const badge = r.badge === "new" || r.badge === "sale" ? r.badge : null;
  return {
    id: r.id,
    slug: r.id,
    name: r.name,
    category: r.category,
    subcategory: r.subcategory || "",
    price: Math.round(Number(r.price) || 0),
    colors: colors.length ? colors : ["black"],
    sizes: sizes.length ? sizes : ["One Size"],
    desc: r.description || "",
    badge,
    discount: badge === "sale" ? Number(r.discount) || 0 : 0,
    images,
    image: images[0] ? images[0].url : null,
    icon: iconForCategory(r.category),
    soldOut: !!r.sold_out,
    active: r.active === undefined ? true : !!r.active,
    sortOrder: Number(r.sort_order) || 0,
    isSpotlight: !!r.is_spotlight,
    appExclusive: !!r.app_exclusive,
  };
}

/* Normalize an incoming product payload from the admin form into DB columns. */
export function payloadToRow(body) {
  const clean = (s) => String(s == null ? "" : s).trim();
  const list = (v) => (Array.isArray(v) ? v : String(v || "").split(",")).map((x) => String(x).trim()).filter(Boolean);

  const name = clean(body.name);
  const category = CATEGORY_IDS.includes(clean(body.category)) ? clean(body.category) : "tshirts";
  // A fit only sticks if it's actually offered for this category.
  const subRaw = clean(body.subcategory);
  const subcategory = isValidSub(category, subRaw) ? subRaw : "";
  const price = Math.max(0, Math.round(Number(body.price) || 0));
  const colors = list(body.colors).filter((c) => COLOR_KEYS.includes(c));
  const sizes = list(body.sizes);
  const images = Array.isArray(body.images) ? body.images : list(body.images).map((u) => ({ url: u, color: null }));
  let badge = clean(body.badge).toLowerCase();
  if (badge !== "new" && badge !== "sale") badge = "";
  const discount = badge === "sale" ? Math.max(0, Math.min(90, Math.round(Number(body.discount) || 0))) : 0;

  return {
    name,
    category,
    subcategory,
    price,
    colors: colors.join(","),
    sizes: sizes.join(","),
    description: clean(body.description || body.desc),
    badge,
    discount,
    images: serializeImages(images),
    sold_out: body.soldOut ? 1 : 0,
    active: body.active === false ? 0 : 1,
    is_spotlight: body.isSpotlight ? 1 : 0,
    app_exclusive: body.appExclusive ? 1 : 0,
  };
}

/* ============================================================
   INVENTORY
   ------------------------------------------------------------
   Stock lives in the `variants` table: one row per product+color+size.
   A product with NO variant rows is "not tracked" — it behaves exactly
   like before (always available). This lets the shop owner move products
   onto stock tracking one at a time without breaking anything.

   available = quantity - reserved
     quantity : real stock on the shelf
     reserved : held by pending orders that aren't confirmed yet
   ============================================================ */

export const RESERVATION_HOURS = 24;

// Load stock for a set of products, shaped for the storefront:
//   { [productId]: { tracked: true, stock: { "black|M": 3, ... } } }
export async function loadStock(env, productIds) {
  const out = {};
  if (!productIds || productIds.length === 0) return out;

  // D1 has a parameter limit; chunk to stay well within it.
  const chunks = [];
  for (let i = 0; i < productIds.length; i += 40) chunks.push(productIds.slice(i, i + 40));

  for (const chunk of chunks) {
    const placeholders = chunk.map(() => "?").join(",");
    const { results } = await env.DB.prepare(
      `SELECT product_id, color, size, quantity, reserved FROM variants WHERE product_id IN (${placeholders})`
    ).bind(...chunk).all();
    for (const v of results || []) {
      if (!out[v.product_id]) out[v.product_id] = { tracked: true, stock: {} };
      const available = Math.max(0, (Number(v.quantity) || 0) - (Number(v.reserved) || 0));
      out[v.product_id].stock[`${v.color}|${v.size}`] = available;
    }
  }
  return out;
}

// Replace a product's stock matrix. Preserves `reserved` on rows that still
// exist, so pending orders aren't lost when the owner edits quantities.
export async function saveVariants(env, productId, variants) {
  if (!variants || typeof variants !== "object") return;

  const { results } = await env.DB.prepare(
    "SELECT color, size, reserved FROM variants WHERE product_id = ?"
  ).bind(productId).all();
  const reservedMap = {};
  for (const r of results || []) reservedMap[`${r.color}|${r.size}`] = Number(r.reserved) || 0;

  await env.DB.prepare("DELETE FROM variants WHERE product_id = ?").bind(productId).run();

  for (const [key, qtyRaw] of Object.entries(variants)) {
    const [color, size] = String(key).split("|");
    if (!color || !size) continue;
    const quantity = Math.max(0, Math.round(Number(qtyRaw) || 0));
    const reserved = reservedMap[key] || 0;
    if (quantity === 0 && reserved === 0) continue; // don't store empty rows
    await env.DB.prepare(
      "INSERT INTO variants (product_id, color, size, quantity, reserved) VALUES (?,?,?,?,?)"
    ).bind(productId, color, size, quantity, reserved).run();
  }
}

export async function loadVariantsForAdmin(env, productId) {
  const { results } = await env.DB.prepare(
    "SELECT color, size, quantity, reserved FROM variants WHERE product_id = ?"
  ).bind(productId).all();
  const stock = {};
  const reserved = {};
  for (const v of results || []) {
    stock[`${v.color}|${v.size}`] = Number(v.quantity) || 0;
    reserved[`${v.color}|${v.size}`] = Number(v.reserved) || 0;
  }
  return { stock, reserved };
}

/* ============================================================
   ORDERS
   ============================================================ */

// Release stock held by pending orders that were never confirmed.
// Called lazily (no cron needed on the free plan).
export async function releaseExpiredOrders(env, hours = RESERVATION_HOURS) {
  const cutoff = Date.now() - hours * 3600 * 1000;
  let results;
  try {
    const res = await env.DB.prepare(
      "SELECT id, items FROM orders WHERE status = 'pending' AND created_at < ?"
    ).bind(cutoff).all();
    results = res.results;
  } catch {
    return 0;
  }
  if (!results || results.length === 0) return 0;

  for (const o of results) {
    let items = [];
    try { items = JSON.parse(o.items); } catch { /* skip */ }
    await releaseReservation(env, items);
    await env.DB.prepare("UPDATE orders SET status = 'expired', updated_at = ? WHERE id = ?")
      .bind(Date.now(), o.id).run();
  }
  return results.length;
}

export async function releaseReservation(env, items) {
  for (const it of items || []) {
    if (!it.productId || !it.colorKey || !it.size) continue;
    await env.DB.prepare(
      "UPDATE variants SET reserved = MAX(0, reserved - ?) WHERE product_id = ? AND color = ? AND size = ?"
    ).bind(Math.max(0, Number(it.qty) || 0), it.productId, it.colorKey, it.size).run();
  }
}

export async function confirmReservation(env, items) {
  for (const it of items || []) {
    if (!it.productId || !it.colorKey || !it.size) continue;
    const qty = Math.max(0, Number(it.qty) || 0);
    await env.DB.prepare(
      "UPDATE variants SET quantity = MAX(0, quantity - ?), reserved = MAX(0, reserved - ?) WHERE product_id = ? AND color = ? AND size = ?"
    ).bind(qty, qty, it.productId, it.colorKey, it.size).run();
  }
}

export function rowToOrder(r) {
  let items = [];
  try { items = JSON.parse(r.items || "[]"); } catch { /* ignore */ }
  return {
    id: r.id,
    status: r.status,
    name: r.customer_name || "",
    phone: r.phone || "",
    area: r.area || "",
    address: r.address || "",
    notes: r.notes || "",
    items,
    subtotal: Number(r.subtotal) || 0,
    delivery: Number(r.delivery) || 0,
    total: Number(r.total) || 0,
    createdAt: Number(r.created_at) || 0,
    updatedAt: Number(r.updated_at) || 0,
  };
}

/* ============================================================
   STORIES ("The Edit")
   ------------------------------------------------------------
   One DB row = one slide. Several rows sharing `ring_id` form one ring.
   "Auto" rings (Sale / New In) aren't stored at all — they're computed
   fresh from the live products table on every request, so they update
   themselves and can never show a sold-out or stale item.
   ============================================================ */

export function rowToStorySlide(r) {
  let tags = [];
  try {
    const parsed = JSON.parse(r.tags || "[]");
    if (Array.isArray(parsed)) {
      tags = parsed
        .map((t) => ({
          productId: String(t.productId || ""),
          x: Math.max(2, Math.min(98, Number(t.x))),
          y: Math.max(2, Math.min(98, Number(t.y))),
        }))
        .filter((t) => t.productId && Number.isFinite(t.x) && Number.isFinite(t.y));
    }
  } catch { /* keep empty */ }

  return {
    id: r.id,
    ringId: r.ring_id,
    ringTitle: r.ring_title || "",
    ringType: r.ring_type === "compare" ? "compare" : "editorial",
    pinned: !!r.pinned,
    expiresAt: r.expires_at || null,
    sortOrder: Number(r.sort_order) || 0,
    kind: r.ring_type === "compare" ? "compare" : "image",
    image: r.image || "",
    imageB: r.image_b || "",
    labelA: r.label_a || "",
    labelB: r.label_b || "",
    ctaCategory: r.cta_category || "",
    ctaSubcategory: r.cta_subcategory || "",
    caption: r.caption || "",
    tags,
    createdAt: Number(r.created_at) || 0,
  };
}

// Group flat slide rows into rings, preserving the order rings were
// first created in, and slide order within each ring.
export function groupIntoRings(slides) {
  const byRing = new Map();
  for (const s of slides) {
    if (!byRing.has(s.ringId)) {
      byRing.set(s.ringId, {
        id: s.ringId,
        title: s.ringTitle,
        kind: s.ringType, // 'editorial' | 'compare'
        pinned: s.pinned,
        expiresAt: s.expiresAt,
        slides: [],
      });
    }
    byRing.get(s.ringId).slides.push(s);
  }
  const rings = [...byRing.values()];
  for (const r of rings) r.slides.sort((a, b) => a.sortOrder - b.sortOrder);
  return rings.filter((r) => r.slides.length > 0);
}

/* ============================================================
   IMAGE THUMBNAILS
   ------------------------------------------------------------
   Every uploaded photo is stored twice: the full image, and a smaller
   copy under the same name with "-thumb" before the extension.
     /img/products/1234-ab.webp
     /img/products/1234-ab-thumb.webp
   Deriving one from the other means the database only ever stores a
   single URL per photo — no schema change, and older products that
   predate thumbnails keep working (their thumb simply 404s and the
   storefront falls back to the full image).
   ============================================================ */
export function thumbPathFor(path) {
  const p = String(path || "");
  const dot = p.lastIndexOf(".");
  if (dot <= 0) return "";
  return `${p.slice(0, dot)}-thumb${p.slice(dot)}`;
}

// Remove an uploaded image and its thumbnail. Only ever touches our own
// /img/ paths, and never throws — cleanup failing shouldn't fail the
// operation that triggered it.
export async function deleteUploadedImage(env, url) {
  const u = String(url || "");
  if (!env.BUCKET || !u.startsWith("/img/")) return;
  const key = u.slice(5);
  try { await env.BUCKET.delete(key); } catch { /* already gone */ }
  const thumb = thumbPathFor(key);
  if (thumb) {
    try { await env.BUCKET.delete(thumb); } catch { /* may not exist — fine */ }
  }
}
