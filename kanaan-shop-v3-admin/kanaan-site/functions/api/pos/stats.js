import { json } from "../../_shared/util.js";
import { guard } from "../../_shared/pos.js";
import { statsBetween, beirutDay } from "../../_shared/site.js";

/* GET /api/pos/stats?from=YYYY-MM-DD&to=YYYY-MM-DD — visits, products seen, carts, orders, sources. */
export async function onRequestGet(context) {
  const denied = await guard(context); if (denied) return denied;
  const u = new URL(context.request.url);
  const ok = (d) => /^\d{4}-\d{2}-\d{2}$/.test(d || "");
  const to = ok(u.searchParams.get("to")) ? u.searchParams.get("to") : beirutDay();
  const from = ok(u.searchParams.get("from")) ? u.searchParams.get("from") : to;
  return json(await statsBetween(context.env, from, to));
}
