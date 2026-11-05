/* The welcome offer's two questions: has this phone number ordered from the website before, and how has the
   offer done (for the switch in Kanaan POS → Website → Site). */

/** Has this number ordered from the website before (written any way: the last 8 digits)? Orders the shop
 *  rejected or cancelled, and ones never taken (expired), don't count. */
export async function orderedBefore(env, ph) {
  const tail = String(ph.e164 || "").slice(-8);
  const row = await env.DB.prepare(
    `SELECT COUNT(*) AS n FROM orders WHERE status NOT IN ('cancelled','rejected','expired','paying')
       AND (phone = ? OR REPLACE(REPLACE(REPLACE(REPLACE(phone,' ',''),'-',''),'+',''),'.','') LIKE ?)`
  ).bind(ph.pretty, `%${tail}`).first();
  return !!(row && Number(row.n) > 0);
}

/** First orders that got the offer (all of them, and since it was last switched on): how many, the dollars given,
 *  what they came to. Rejected / cancelled / never-taken orders are left out. */
export async function welcomeStats(env, since = 0) {
  const q = (from) => env.DB.prepare(
    `SELECT COUNT(*) AS n, IFNULL(SUM(discount), 0) AS given, IFNULL(SUM(total), 0) AS sales FROM orders
     WHERE promo LIKE 'welcome:%' AND status NOT IN ('cancelled','rejected','expired','paying') AND created_at >= ?`
  ).bind(from).first();
  try {
    const [all, now] = await Promise.all([q(0), q(since || 0)]);
    const shape = (r) => ({ orders: Number(r && r.n) || 0, given: Number(r && r.given) || 0, sales: Number(r && r.sales) || 0 });
    return { all: shape(all), since: shape(now) };
  } catch {
    return { all: { orders: 0, given: 0, sales: 0 }, since: { orders: 0, given: 0, sales: 0 } };
  }
}
