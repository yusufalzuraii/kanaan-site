import { json } from "../../_shared/util.js";
import { guard } from "../../_shared/pos.js";
import { INVITE_DAYS, newToken, normalPieces, productsById, pieceView } from "../../_shared/reviews.js";

/* POST /api/pos/review-invites — the shop asks for a review link for a buyer (Kanaan POS: after a delivered website
   order, or a sale in the shop to a customer with a file).
   { name (first name), phone, source: 'site' | 'shop', ref (the order number / the invoice number),
     pieces: [{ productId (the site's id), color, size, image }] }
   → { token, url, expiresAt, pieces: [...], again }
   One invite per order / invoice: asked again with the same ref, the same link comes back (new pieces are added to
   it). Only the site's real products are kept; a website order must exist (its pieces are the order's). */
export async function onRequestPost(context) {
  const denied = await guard(context); if (denied) return denied;
  const { request, env, device } = context;
  let body = {};
  try { body = await request.json(); } catch { return json({ error: "bad json" }, 400); }
  const source = body.source === "site" ? "site" : body.source === "shop" ? "shop" : "";
  if (!source) return json({ error: "source must be 'site' or 'shop'" }, 400);
  const ref = String(body.ref || "").trim().slice(0, 40);
  if (!ref) return json({ error: "The order or invoice number is missing" }, 400);
  let name = String(body.name || "").replace(/\s+/g, " ").trim().split(" ")[0].slice(0, 30);
  let phone = String(body.phone || "").replace(/[^\d+ ]/g, "").trim().slice(0, 24);
  let pieces = normalPieces(body.pieces);

  // a website order: it must be a real order of the site, and only what was in it can be reviewed
  if (source === "site") {
    const o = await env.DB.prepare("SELECT customer_name, phone, items, status FROM orders WHERE id = ?").bind(ref).first();
    if (!o) return json({ error: `No website order #${ref}` }, 400);
    if (o.status === "cancelled" || o.status === "expired") return json({ error: `Website order #${ref} was not delivered (${o.status})` }, 400);
    let items = []; try { items = JSON.parse(o.items || "[]"); } catch { items = []; }
    const inOrder = normalPieces(items.map((i) => ({ productId: i.productId, color: i.color || i.colorKey, size: i.size, image: i.image })));
    const ids = new Set(inOrder.map((p) => p.productId));
    pieces = pieces.length ? pieces.filter((p) => ids.has(p.productId)) : inOrder;
    if (!name) name = String(o.customer_name || "").trim().split(/\s+/)[0].slice(0, 30);
    if (!phone) phone = String(o.phone || "").slice(0, 24);
  }

  const products = await productsById(env, pieces.map((p) => p.productId));
  pieces = pieces.filter((p) => products.has(p.productId));
  const now = Date.now();
  const have = await env.DB.prepare("SELECT * FROM review_invites WHERE source = ? AND ref = ?").bind(source, ref).first();
  if (have) {
    let old = []; try { old = JSON.parse(have.pieces || "[]"); } catch { old = []; }
    const merged = normalPieces([...old, ...pieces]);
    if (merged.length !== old.length || (!have.name && name) || (!have.phone && phone)) {
      await env.DB.prepare("UPDATE review_invites SET pieces = ?, name = ?, phone = ? WHERE token = ?")
        .bind(JSON.stringify(merged), have.name || name, have.phone || phone, have.token).run();
    }
    const all = await productsById(env, merged.map((p) => p.productId));
    return answer(request, have.token, Number(have.expires_at), merged.map((p) => pieceView(p, all.get(p.productId))), true);
  }
  if (!pieces.length) return json({ error: "None of these pieces are on the website", none: true }, 422);
  const token = newToken();
  const expires = now + INVITE_DAYS * 86400000;
  try {
    await env.DB.prepare("INSERT INTO review_invites (token, source, ref, name, phone, pieces, created_at, expires_at, made_by) VALUES (?,?,?,?,?,?,?,?,?)")
      .bind(token, source, ref, name, phone, JSON.stringify(pieces), now, expires, String((device && device.name) || "")).run();
  } catch {
    // the same order asked twice at the same moment: the other one won, answer with it
    const r = await env.DB.prepare("SELECT * FROM review_invites WHERE source = ? AND ref = ?").bind(source, ref).first();
    if (!r) throw new Error("The invite could not be saved");
    let p2 = []; try { p2 = JSON.parse(r.pieces || "[]"); } catch { p2 = []; }
    return answer(request, r.token, Number(r.expires_at), p2.map((p) => pieceView(p, products.get(p.productId))), true);
  }
  return answer(request, token, expires, pieces.map((p) => pieceView(p, products.get(p.productId))), false);
}

function answer(request, token, expiresAt, pieces, again) {
  const origin = new URL(request.url).origin;
  return json({ ok: true, token, url: `${origin}/review/${token}`, expiresAt, pieces, again });
}
