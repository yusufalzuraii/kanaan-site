import { json } from "../../../_shared/util.js";
import { guard } from "../../../_shared/pos.js";
import { REPLY_MAX, cleanText, counts, withContext, summaryOf } from "../../../_shared/reviews.js";

/* PUT /api/pos/reviews/:id  { status?: 'approved' | 'hidden', reply?: "the shop's answer" ('' takes it away) }
   The shop's check (Kanaan POS → Website → Reviews): put it on the site, hide it (from the site; the buyer isn't
   told), answer it. → { review, before: { status, reply }, counts, summary (the piece's stars on the site now) } */
export async function onRequestPut(context) {
  const denied = await guard(context); if (denied) return denied;
  const { request, env, params, device } = context;
  let body = {};
  try { body = await request.json(); } catch { return json({ error: "bad json" }, 400); }
  const id = Number(params.id);
  if (!Number.isInteger(id) || id <= 0) return json({ error: "Review not found" }, 404);
  const row = await env.DB.prepare("SELECT * FROM reviews WHERE id = ?").bind(id).first();
  if (!row) return json({ error: "Review not found" }, 404);
  const sets = []; const args = []; const now = Date.now();
  if (body.status !== undefined) {
    if (body.status !== "approved" && body.status !== "hidden") return json({ error: "status must be 'approved' or 'hidden'" }, 400);
    if (body.status !== row.status) { sets.push("status = ?", "checked_at = ?", "checked_by = ?"); args.push(body.status, now, String((device && device.name) || "").slice(0, 60)); }
  }
  if (body.reply !== undefined) {
    if (body.reply !== null && typeof body.reply !== "string") return json({ error: "reply must be text" }, 400);
    const reply = cleanText(body.reply || "");
    if (reply.length > REPLY_MAX) return json({ error: `Keep the answer under ${REPLY_MAX} characters` }, 400);
    if (reply !== (row.reply || "")) { sets.push("reply = ?", "reply_at = ?"); args.push(reply, reply ? now : 0); }
  }
  if (!sets.length && body.status === undefined && body.reply === undefined) return json({ error: "Nothing to change" }, 400);
  if (sets.length) await env.DB.prepare(`UPDATE reviews SET ${sets.join(", ")} WHERE id = ?`).bind(...args, id).run();
  const after = await env.DB.prepare("SELECT * FROM reviews WHERE id = ?").bind(id).first();
  const [review] = await withContext(env, [after]);
  const summary = await summaryOf(env, after.product_id);
  review.piece.summary = { avg: summary.avg, count: summary.count };
  return json({ ok: true, changed: sets.length > 0, review, before: { status: row.status, reply: row.reply || "" }, counts: await counts(env), summary });
}
