import { json } from "../_shared/util.js";
import { recordBatch } from "../_shared/insight.js";

/* POST /api/ev — what a visit does on the storefront, a batch at a time (see _shared/insight.js), for the shop's
   program (Website → Visitors). Anonymous; never fails the visitor's page. */
export async function onRequestPost(context) {
  try {
    const text = await context.request.text();
    if (text.length > 24000 || !context.env.DB) return new Response(null, { status: 204 });
    const body = JSON.parse(text || "{}");
    if (body && typeof body === "object") await recordBatch(context.env, context.request, body);
  } catch { /* never break a visit */ }
  return new Response(null, { status: 204 });
}
export async function onRequestGet() { return json({ ok: true }); }
