import { json } from "../_shared/util.js";
import { ensureSchema, beirutDay } from "../_shared/site.js";

/* GET /api/popular — public: the pieces opened most on the site in the last
   7 days (most first), for the shop window on the homepage. Only the ids
   and their order: how many times is the shop's own business. Pieces taken
   off the site, sold out or only in the app are left out. */
export async function onRequestGet(context) {
  const { env } = context;
  let ids = [];
  try {
    if (env.DB) {
      await ensureSchema(env);
      const from = beirutDay(Date.now() - 6 * 86400000);
      const rows = (await env.DB.prepare(
        `SELECT a.key AS id, SUM(a.n) AS n FROM analytics_daily a JOIN products p ON p.id = a.key
         WHERE a.kind = 'product' AND a.day >= ? AND p.active = 1 AND p.app_exclusive = 0 AND p.sold_out = 0
         GROUP BY a.key ORDER BY n DESC, a.key LIMIT 12`
      ).bind(from).all()).results || [];
      // a piece seen once is not "popular": at least 2 visits
      ids = rows.filter((r) => Number(r.n) >= 2).map((r) => r.id);
    }
  } catch { ids = []; }
  return json({ ids }, 200, { "Cache-Control": "public, max-age=600" });
}
