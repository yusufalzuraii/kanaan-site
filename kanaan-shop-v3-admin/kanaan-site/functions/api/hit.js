import { json } from "../_shared/util.js";
import { recordHit } from "../_shared/site.js";

/* POST /api/hit — the storefront's tiny visit counter (page seen, product seen, added to cart, checkout,
   order, search). Never fails the visitor's page. */
export async function onRequestPost(context) {
  try {
    const text = await context.request.text();
    if (text.length > 2000) return new Response(null, { status: 204 });
    const ev = JSON.parse(text || "{}");
    if (context.env.DB) await recordHit(context.env, context.request, ev);
  } catch { /* never break a visit */ }
  return new Response(null, { status: 204 });
}
export async function onRequestGet() { return json({ ok: true }); }
