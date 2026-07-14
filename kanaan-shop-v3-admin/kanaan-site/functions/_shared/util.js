/* Shared helpers for all API functions. */

export const CATEGORY_IDS = ["tshirts", "jeans", "pants", "sets", "shorts", "shoes"];
export const CATEGORY_LABELS = {
  tshirts: "T-Shirts", jeans: "Jeans", pants: "Pants", sets: "Sets", shorts: "Shorts", shoes: "Shoes",
};

export const COLOR_KEYS = [
  "black","charcoal","gray","white","cream","beige","sand","khaki","brown",
  "coral","red","maroon","burgundy","pink","orange","mustard","yellow",
  "olive","green","teal","sky","blue","navy","indigo","purple",
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
export function rowToProduct(r) {
  const split = (s) => String(s || "").split(",").map((x) => x.trim()).filter(Boolean);
  const colors = split(r.colors);
  const sizes = split(r.sizes);
  const images = split(r.images);
  const badge = r.badge === "new" || r.badge === "sale" ? r.badge : null;
  return {
    id: r.id,
    slug: r.id,
    name: r.name,
    category: r.category,
    price: Math.round(Number(r.price) || 0),
    colors: colors.length ? colors : ["black"],
    sizes: sizes.length ? sizes : ["One Size"],
    desc: r.description || "",
    badge,
    discount: badge === "sale" ? Number(r.discount) || 0 : 0,
    images,
    image: images[0] || null,
    icon: r.category === "shoes" ? "shoe" : "shirt",
    soldOut: !!r.sold_out,
    active: r.active === undefined ? true : !!r.active,
    sortOrder: Number(r.sort_order) || 0,
  };
}

/* Normalize an incoming product payload from the admin form into DB columns. */
export function payloadToRow(body) {
  const clean = (s) => String(s == null ? "" : s).trim();
  const list = (v) => (Array.isArray(v) ? v : String(v || "").split(",")).map((x) => String(x).trim()).filter(Boolean);

  const name = clean(body.name);
  const category = CATEGORY_IDS.includes(clean(body.category)) ? clean(body.category) : "tshirts";
  const price = Math.max(0, Math.round(Number(body.price) || 0));
  const colors = list(body.colors).filter((c) => COLOR_KEYS.includes(c));
  const sizes = list(body.sizes);
  const images = list(body.images);
  let badge = clean(body.badge).toLowerCase();
  if (badge !== "new" && badge !== "sale") badge = "";
  const discount = badge === "sale" ? Math.max(0, Math.min(90, Math.round(Number(body.discount) || 0))) : 0;

  return {
    name,
    category,
    price,
    colors: colors.join(","),
    sizes: sizes.join(","),
    description: clean(body.description || body.desc),
    badge,
    discount,
    images: images.join(","),
    sold_out: body.soldOut ? 1 : 0,
    active: body.active === false ? 0 : 1,
  };
}
