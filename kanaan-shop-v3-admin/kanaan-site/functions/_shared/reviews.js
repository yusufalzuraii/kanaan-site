/* ============================================================
   REAL REVIEWS
   ------------------------------------------------------------
   Only people who really bought can review, and nothing shows on the
   site before the shop has read it:

   1. The shop (Kanaan POS, after a delivered website order or a sale in
      the shop to a customer with a file) asks for an invite:
      POST /api/pos/review-invites → one private link per order/invoice,
      kanaanshop.com/review/<token>, good for about 60 days. The program
      sends it to the buyer on WhatsApp.
   2. The buyer opens it: each piece they bought with its photo, stars,
      how it fits, a few words → stored as "pending".
   3. The shop checks it in the program (Website → Reviews): put it on
      the site, hide it, answer it.
   4. Approved reviews show on the piece's page (with the shop's answer),
      their stars on the cards, and in the page's search data
      (schema.org aggregateRating + review).

   Tables are made here the first time (called from ensureSchema).
   ============================================================ */
import { COLORS } from "../../src/palette.js";
import { parseImages } from "./util.js";

export const INVITE_DAYS = 60;
export const TEXT_MAX = 600;
export const REPLY_MAX = 300;
export const NAME_MAX = 40;
export const PIECES_MAX = 12;
export const FITS = ["small", "true", "large"];
export const STATUSES = ["pending", "approved", "hidden"];
export const TOKEN_RX = /^[A-Za-z0-9_-]{24,64}$/;

let ready = false;
export async function ensureReviewTables(env) {
  if (ready || !env.DB) return;
  const stmts = [
    // one invite per order / invoice: the buyer's first name and phone (never shown on the site), what they bought
    `CREATE TABLE IF NOT EXISTS review_invites (
       token TEXT PRIMARY KEY, source TEXT NOT NULL, ref TEXT NOT NULL, name TEXT NOT NULL DEFAULT '', phone TEXT NOT NULL DEFAULT '',
       pieces TEXT NOT NULL DEFAULT '[]', created_at INTEGER NOT NULL DEFAULT 0, expires_at INTEGER NOT NULL DEFAULT 0, made_by TEXT NOT NULL DEFAULT '')`,
    `CREATE UNIQUE INDEX IF NOT EXISTS idx_review_invites_ref ON review_invites (source, ref)`,
    // one review per piece per invite; status pending → approved | hidden (only approved ones are public)
    `CREATE TABLE IF NOT EXISTS reviews (
       id INTEGER PRIMARY KEY AUTOINCREMENT, token TEXT NOT NULL, product_id TEXT NOT NULL, color TEXT NOT NULL DEFAULT '', size TEXT NOT NULL DEFAULT '',
       rating INTEGER NOT NULL, fit TEXT NOT NULL DEFAULT '', text TEXT NOT NULL DEFAULT '', display_name TEXT NOT NULL DEFAULT '',
       status TEXT NOT NULL DEFAULT 'pending', reply TEXT NOT NULL DEFAULT '', reply_at INTEGER NOT NULL DEFAULT 0,
       created_at INTEGER NOT NULL DEFAULT 0, updated_at INTEGER NOT NULL DEFAULT 0, checked_at INTEGER NOT NULL DEFAULT 0, checked_by TEXT NOT NULL DEFAULT '',
       UNIQUE (token, product_id))`,
    `CREATE INDEX IF NOT EXISTS idx_reviews_product ON reviews (product_id, status)`,
    `CREATE INDEX IF NOT EXISTS idx_reviews_status ON reviews (status, updated_at)`,
  ];
  for (const s of stmts) await env.DB.prepare(s).run();
  ready = true;
}

/** 24 random bytes → 32 characters, safe in a link. */
export function newToken() {
  const b = new Uint8Array(24);
  crypto.getRandomValues(b);
  return btoa(String.fromCharCode(...b)).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

/** Text a person typed: no control characters, at most one empty line in a row, trimmed. */
export function cleanText(s) {
  return String(s == null ? "" : s)
    .replace(/\r\n?/g, "\n")
    // eslint-disable-next-line no-control-regex
    .replace(/[\u0000-\u0009\u000B-\u001F\u007F​-‏‪-‮⁦-⁩]/g, "")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

/** The name under a review: "Rami Haddad" → "Rami H.", "rami" → "Rami". Nothing typed: the invite's first name. */
export function shownName(raw, fallback = "") {
  const words = (s) => String(s || "").replace(/[^\p{L}\p{M}\s'’-]/gu, " ").replace(/\s+/g, " ").trim().split(" ").filter(Boolean);
  let w = words(raw);
  if (!w.length) w = words(fallback);
  if (!w.length) return "Kanaan customer";
  const cap = (x) => x.charAt(0).toLocaleUpperCase("en") + x.slice(1).toLocaleLowerCase("en");
  const first = cap(w[0]).slice(0, 20);
  if (w.length < 2) return first;
  const last = w[w.length - 1].replace(/^(al|el)[-’']/i, "");
  const initial = last.charAt(0).toLocaleUpperCase("en");
  return initial ? `${first} ${initial}.` : first;
}

/** A colour as people read it: a palette key ("babyblue") → its label, the program's words ("LIGHT BLUE") → "Light Blue". */
export function colorLabel(c) {
  const s = String(c || "").trim();
  if (!s) return "";
  if (COLORS[s]) return COLORS[s].label;
  if (COLORS[s.toLowerCase()]) return COLORS[s.toLowerCase()].label;
  return s.toLowerCase().replace(/(^|[\s/-])(\p{L})/gu, (m, a, b) => a + b.toUpperCase()).slice(0, 30);
}

/** "M · Black" */
export function boughtLine(size, color) {
  return [String(size || "").trim(), colorLabel(color)].filter(Boolean).join(" · ");
}

const json = (s, d) => { try { const v = JSON.parse(s); return v == null ? d : v; } catch { return d; } };

/** The photo for a piece: the one sent with the invite, else the product's photo in that colour, else its first. */
function photoFor(piece, product) {
  if (piece && piece.image) return String(piece.image);
  const imgs = product ? parseImages(product.images) : [];
  const want = String((piece && piece.color) || "").toLowerCase().replace(/[^a-z]/g, "");
  const im = imgs.find((x) => x.color && want && x.color === want) || imgs[0];
  return im ? im.url : "";
}

/** Products by id, in chunks (D1 takes at most ~100 bound values). */
export async function productsById(env, ids) {
  const out = new Map();
  const list = [...new Set((ids || []).filter(Boolean).map(String))];
  for (let i = 0; i < list.length; i += 40) {
    const part = list.slice(i, i + 40);
    const rows = (await env.DB.prepare(`SELECT id, name, images, active FROM products WHERE id IN (${part.map(() => "?").join(",")})`).bind(...part).all()).results || [];
    for (const r of rows) out.set(r.id, r);
  }
  return out;
}

/** A piece as the review page and the program show it. */
export function pieceView(piece, product) {
  return {
    productId: piece.productId,
    name: product ? product.name : "",
    image: photoFor(piece, product),
    color: piece.color || "",
    colorLabel: colorLabel(piece.color),
    size: piece.size || "",
    bought: boughtLine(piece.size, piece.color),
    url: `/product/${piece.productId}`,
    onSite: !!(product && Number(product.active)),
  };
}

export async function loadInvite(env, token) {
  if (!TOKEN_RX.test(String(token || ""))) return null;
  const r = await env.DB.prepare("SELECT * FROM review_invites WHERE token = ?").bind(String(token)).first();
  if (!r) return null;
  return { ...r, pieces: json(r.pieces, []) };
}

/** The invite's pieces from what the program sent: real site products only, each once, a dozen at most. */
export function normalPieces(input) {
  const seen = new Set(); const out = [];
  for (const p of Array.isArray(input) ? input : []) {
    const productId = String((p && (p.productId || p.id)) || "").trim().slice(0, 80);
    if (!productId || seen.has(productId)) continue;
    seen.add(productId);
    const image = String((p && p.image) || "").trim();
    out.push({
      productId,
      color: String((p && (p.color || p.colorKey)) || "").trim().slice(0, 40),
      size: String((p && p.size) || "").trim().slice(0, 20),
      // a photo of this site only (a path), never a link elsewhere
      image: image.startsWith("/") && !image.startsWith("//") ? image.slice(0, 300) : "",
    });
    if (out.length >= PIECES_MAX) break;
  }
  return out;
}

/** { avg, count, fit: { small, true, large } } of a product's approved reviews. */
export async function summaryOf(env, productId) {
  const r = await env.DB.prepare(`SELECT COUNT(*) n, AVG(rating) a, SUM(fit = 'small') s, SUM(fit = 'true') t, SUM(fit = 'large') l
    FROM reviews WHERE product_id = ? AND status = 'approved'`).bind(String(productId)).first();
  const n = Number((r && r.n) || 0);
  return { avg: n ? Math.round(Number(r.a) * 10) / 10 : 0, count: n, fit: { small: Number((r && r.s) || 0), true: Number((r && r.t) || 0), large: Number((r && r.l) || 0) } };
}

/** id → { avg, count } for every product with approved reviews (the products list carries it). */
export async function summaries(env) {
  const rows = (await env.DB.prepare("SELECT product_id, COUNT(*) n, AVG(rating) a FROM reviews WHERE status = 'approved' GROUP BY product_id").all()).results || [];
  return new Map(rows.map((r) => [r.product_id, { avg: Math.round(Number(r.a) * 10) / 10, count: Number(r.n) }]));
}

/** An approved review as the site shows it (never the buyer's phone, order or link). */
export function publicReview(r) {
  return {
    id: r.id, rating: Number(r.rating), fit: r.fit || "", text: r.text || "", name: r.display_name || "Kanaan customer",
    size: r.size || "", color: colorLabel(r.color), bought: boughtLine(r.size, r.color),
    date: Number(r.created_at) || 0, reply: r.reply || "", replyAt: Number(r.reply_at) || 0,
  };
}

/** The newest approved reviews of a product. */
export async function approvedOf(env, productId, limit = 60) {
  const rows = (await env.DB.prepare("SELECT * FROM reviews WHERE product_id = ? AND status = 'approved' ORDER BY created_at DESC, id DESC LIMIT ?")
    .bind(String(productId), Math.max(1, Math.min(200, Number(limit) || 60))).all()).results || [];
  return rows.map(publicReview);
}

/** A review as the program shows it to the shop: the piece, the buyer, where they bought it. */
export function shopReview(r, invite, product) {
  const piece = (invite ? invite.pieces : []).find((p) => p.productId === r.product_id) || { productId: r.product_id, color: r.color, size: r.size };
  return {
    id: r.id, status: r.status, rating: Number(r.rating), fit: r.fit || "", text: r.text || "", name: r.display_name || "",
    reply: r.reply || "", replyAt: Number(r.reply_at) || 0, createdAt: Number(r.created_at) || 0, updatedAt: Number(r.updated_at) || 0,
    checkedAt: Number(r.checked_at) || 0, checkedBy: r.checked_by || "",
    piece: pieceView({ ...piece, color: r.color || piece.color, size: r.size || piece.size }, product),
    buyer: { name: invite ? invite.name : "", phone: invite ? invite.phone : "" },
    source: invite ? invite.source : "", ref: invite ? invite.ref : "",
  };
}

export async function counts(env) {
  const rows = (await env.DB.prepare("SELECT status, COUNT(*) n FROM reviews GROUP BY status").all()).results || [];
  const out = { pending: 0, approved: 0, hidden: 0 };
  for (const r of rows) if (r.status in out) out[r.status] = Number(r.n);
  return out;
}

/** Reviews with their invite and product, for the program. */
export async function withContext(env, rows) {
  const tokens = [...new Set(rows.map((r) => r.token))];
  const invites = new Map();
  for (let i = 0; i < tokens.length; i += 40) {
    const part = tokens.slice(i, i + 40);
    const list = (await env.DB.prepare(`SELECT * FROM review_invites WHERE token IN (${part.map(() => "?").join(",")})`).bind(...part).all()).results || [];
    for (const v of list) invites.set(v.token, { ...v, pieces: json(v.pieces, []) });
  }
  const products = await productsById(env, rows.map((r) => r.product_id));
  return rows.map((r) => shopReview(r, invites.get(r.token), products.get(r.product_id)));
}
