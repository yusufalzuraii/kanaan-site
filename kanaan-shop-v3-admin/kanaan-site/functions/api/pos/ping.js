import { json } from "../../_shared/util.js";
import { guard } from "../../_shared/pos.js";
import { loadCategories } from "../../_shared/site.js";
import { COLORS } from "../../../src/palette.js";

/* GET /api/pos/ping — the POS checks the connection and learns what the site offers:
   categories (with fits), the colour palette, how many products and pending orders. */
export async function onRequestGet(context) {
  const denied = await guard(context); if (denied) return denied;
  const { env } = context;
  const count = async (sql) => ((await env.DB.prepare(sql).first()) || {}).n || 0;
  const cats = await loadCategories(env);
  return json({
    ok: true, time: Date.now(), bridge: 1,
    products: await count("SELECT COUNT(*) n FROM products WHERE active = 1"),
    posProducts: await count("SELECT COUNT(*) n FROM products WHERE active = 1 AND source = 'pos'"),
    oldProducts: await count("SELECT COUNT(*) n FROM products WHERE active = 1 AND source <> 'pos'"),
    pendingOrders: await count("SELECT COUNT(*) n FROM orders WHERE status = 'pending'"),
    categories: cats.list,
    colors: Object.entries(COLORS).map(([key, c]) => ({ key, label: c.label, hex: c.hex || "#888", group: c.group })),
  });
}
