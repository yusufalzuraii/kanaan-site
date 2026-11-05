import { json, rateLimit, tooManyRequests } from "../../_shared/util.js";
import { ensureSchema } from "../../_shared/site.js";
import { FITS, TEXT_MAX, NAME_MAX, cleanText, shownName, loadInvite, productsById, pieceView, TOKEN_RX } from "../../_shared/reviews.js";

/* The buyer's own review page (kanaanshop.com/review/<token>, sent by the shop on WhatsApp).
   GET  → { name, pieces: [{ productId, name, image, colorLabel, size, bought, review: null | { rating, fit, text, name, status } }], expiresAt }
   POST { productId, rating 1–5, fit: 'small' | 'true' | 'large' | '', text (≤ 600), name ("Rami Haddad" → shown "Rami H.") }
        → stored as pending (nothing is on the site before the shop checks it); the same piece again changes it while
        it waits. Never shows the buyer's phone or order number (the link could be passed on). */
const gone = (inv) => !inv || Date.now() > Number(inv.expires_at);

async function open(context) {
  const { env, params } = context;
  if (!env.DB) return { res: json({ error: "Database not configured." }, 500) };
  const token = String(params.token || "");
  if (!TOKEN_RX.test(token)) return { res: json({ error: "This review link isn't right — check the message from the shop.", code: "NOT_FOUND" }, 404) };
  await ensureSchema(env);
  const inv = await loadInvite(env, token);
  if (!inv) return { res: json({ error: "This review link isn't right — check the message from the shop.", code: "NOT_FOUND" }, 404) };
  if (gone(inv)) return { res: json({ error: "This review link has expired. Thank you for shopping with us!", code: "EXPIRED", name: inv.name }, 410) };
  return { inv };
}

async function page(env, inv) {
  const products = await productsById(env, inv.pieces.map((p) => p.productId));
  const mine = (await env.DB.prepare("SELECT product_id, rating, fit, text, display_name, status FROM reviews WHERE token = ?").bind(inv.token).all()).results || [];
  const by = new Map(mine.map((r) => [r.product_id, r]));
  const pieces = inv.pieces.filter((p) => products.has(p.productId)).map((p) => {
    const r = by.get(p.productId);
    const v = pieceView(p, products.get(p.productId));
    return { productId: v.productId, name: v.name, image: v.image, colorLabel: v.colorLabel, size: v.size, bought: v.bought, url: v.onSite ? v.url : "",
      review: r ? { rating: Number(r.rating), fit: r.fit || "", text: r.text || "", name: r.display_name || "", status: r.status } : null };
  });
  return { name: inv.name || "", shownAs: shownName("", inv.name), pieces, expiresAt: Number(inv.expires_at), done: pieces.filter((p) => p.review).length };
}

export async function onRequestGet(context) {
  const { request, env } = context;
  const rl = await rateLimit(request, env, "review-look", 120, 10 * 60 * 1000);
  if (!rl.allowed) return tooManyRequests(rl.retryAfter);
  const { res, inv } = await open(context);
  if (res) return res;
  return json(await page(env, inv), 200, { "X-Robots-Tag": "noindex", "Referrer-Policy": "no-referrer" });
}

export async function onRequestPost(context) {
  const { request, env } = context;
  const rl = await rateLimit(request, env, "review", 20, 10 * 60 * 1000);
  if (!rl.allowed) return tooManyRequests(rl.retryAfter, "Too many tries — wait a few minutes and send it again.");
  const { res, inv } = await open(context);
  if (res) return res;
  let body = {};
  try { body = await request.json(); } catch { return json({ error: "bad json" }, 400); }
  const productId = String(body.productId || "");
  const piece = inv.pieces.find((p) => p.productId === productId);
  if (!piece) return json({ error: "This piece isn't in your order." }, 400);
  const rating = Number(body.rating);
  if (!Number.isInteger(rating) || rating < 1 || rating > 5) return json({ error: "Tap the stars first (1 to 5)." }, 400);
  const fit = body.fit == null ? "" : String(body.fit);
  if (fit && !FITS.includes(fit)) return json({ error: "Fit must be small, true or large." }, 400);
  const text = cleanText(body.text || "");
  if (text.length > TEXT_MAX) return json({ error: `Keep it under ${TEXT_MAX} characters.` }, 400);
  if (String(body.name || "").length > 120) return json({ error: "The name is too long." }, 400);
  const name = shownName(String(body.name || "").slice(0, NAME_MAX * 2), inv.name);
  const now = Date.now();
  const had = await env.DB.prepare("SELECT id, status FROM reviews WHERE token = ? AND product_id = ?").bind(inv.token, productId).first();
  if (had && had.status !== "pending") return json({ error: "The shop has already checked this review — thank you!", code: "CHECKED" }, 409);
  if (had) {
    await env.DB.prepare("UPDATE reviews SET rating = ?, fit = ?, text = ?, display_name = ?, updated_at = ? WHERE id = ? AND status = 'pending'")
      .bind(rating, fit, text, name, now, had.id).run();
  } else {
    await env.DB.prepare(`INSERT INTO reviews (token, product_id, color, size, rating, fit, text, display_name, status, created_at, updated_at)
      VALUES (?,?,?,?,?,?,?,?, 'pending', ?, ?) ON CONFLICT(token, product_id) DO UPDATE SET rating = excluded.rating, fit = excluded.fit, text = excluded.text,
      display_name = excluded.display_name, updated_at = excluded.updated_at WHERE reviews.status = 'pending'`)
      .bind(inv.token, productId, piece.color || "", piece.size || "", rating, fit, text, name, now, now).run();
  }
  const out = await page(env, inv);
  const mine = out.pieces.find((p) => p.productId === productId);
  return json({ ok: true, edited: !!had, review: mine ? mine.review : null, ...out });
}
