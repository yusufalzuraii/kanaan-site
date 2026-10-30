import { json } from "../../../_shared/util.js";
import { guard } from "../../../_shared/pos.js";

/* POST /api/pos/products/order — { ids: [product ids, first = first in the shop] } the order the shop shows the
   program's pieces in. Only those ids move: they take the first places, in this order, ahead of everything else. */
export async function onRequestPost(context) {
  const denied = await guard(context); if (denied) return denied;
  const { request, env } = context;
  let body = {};
  try { body = await request.json(); } catch { return json({ error: "bad json" }, 400); }
  const ids = [...new Set((Array.isArray(body.ids) ? body.ids : []).map((x) => String(x).slice(0, 120)))].slice(0, 400);
  if (!ids.length) return json({ error: "No products" }, 400);
  const low = ((await env.DB.prepare("SELECT MIN(sort_order) m FROM products").first()) || {}).m;
  const start = Math.min(0, Number(low) || 0) - ids.length - 1;
  const stmts = ids.map((id, i) => env.DB.prepare("UPDATE products SET sort_order = ? WHERE id = ? AND source = 'pos'").bind(start + i, id));
  for (let i = 0; i < stmts.length; i += 100) await env.DB.batch(stmts.slice(i, i + 100));
  return json({ ok: true, moved: ids.length });
}
