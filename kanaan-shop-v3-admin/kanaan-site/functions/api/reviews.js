import { json } from "../_shared/util.js";
import { ensureSchema } from "../_shared/site.js";
import { approvedOf, summaryOf } from "../_shared/reviews.js";

/* GET /api/reviews?product=<id> — a piece's reviews as the site shows them: only the ones the shop approved, newest
   first ({ rating, fit, text, name "Rami H.", bought "M · Black", date, reply }), with the average, the count and how
   many said it runs small / true to size / large. */
export async function onRequestGet(context) {
  const { request, env } = context;
  const id = String(new URL(request.url).searchParams.get("product") || "").trim().slice(0, 80);
  if (!id) return json({ error: "product is missing" }, 400);
  if (!env.DB) return json({ summary: { avg: 0, count: 0, fit: { small: 0, true: 0, large: 0 } }, reviews: [] });
  try {
    await ensureSchema(env);
    const [summary, reviews] = await Promise.all([summaryOf(env, id), approvedOf(env, id, 60)]);
    return json({ summary, reviews });
  } catch (e) {
    return json({ summary: { avg: 0, count: 0, fit: { small: 0, true: 0, large: 0 } }, reviews: [], error: String((e && e.message) || e) });
  }
}
