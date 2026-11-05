import { json } from "../../_shared/util.js";
import { guard } from "../../_shared/pos.js";
import { STATUSES, counts, withContext, summaries } from "../../_shared/reviews.js";

/* GET /api/pos/reviews?status=pending|approved|hidden|all&limit=&before=
   The reviews for the shop to check (Kanaan POS → Website → Reviews): each with the piece (name, photo, colour, size,
   its stars on the site now), the buyer (first name, phone), where they bought it (website order / in the shop and the
   number), the shop's answer. Waiting ones oldest first (in the order they came); the others newest first.
   before = updatedAt of the last one shown (the next page). */
export async function onRequestGet(context) {
  const denied = await guard(context); if (denied) return denied;
  const { request, env } = context;
  const u = new URL(request.url);
  const status = String(u.searchParams.get("status") || "pending");
  if (status !== "all" && !STATUSES.includes(status)) return json({ error: "status must be pending, approved, hidden or all" }, 400);
  const limit = Math.max(1, Math.min(200, Number(u.searchParams.get("limit")) || 100));
  const before = Number(u.searchParams.get("before")) || 0;
  const where = []; const args = [];
  if (status !== "all") { where.push("status = ?"); args.push(status); }
  if (before) { where.push(status === "pending" ? "updated_at > ?" : "updated_at < ?"); args.push(before); }
  const order = status === "pending" ? "updated_at ASC, id ASC" : "updated_at DESC, id DESC";
  const rows = (await env.DB.prepare(`SELECT * FROM reviews ${where.length ? `WHERE ${where.join(" AND ")}` : ""} ORDER BY ${order} LIMIT ?`).bind(...args, limit + 1).all()).results || [];
  const more = rows.length > limit;
  const list = await withContext(env, rows.slice(0, limit));
  const sums = await summaries(env);
  for (const r of list) r.piece.summary = sums.get(r.piece.productId) || { avg: 0, count: 0 };
  return json({ reviews: list, counts: await counts(env), more });
}
