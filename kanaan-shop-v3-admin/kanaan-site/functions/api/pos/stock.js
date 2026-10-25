import { json } from "../../_shared/util.js";
import { guard, setStock, restockPush } from "../../_shared/pos.js";

/* POST /api/pos/stock — { products: [{ id, stock: { "color|size": qty } }] }
   Live stock from the shop: absolute numbers, many products in one call. */
export async function onRequestPost(context) {
  const denied = await guard(context); if (denied) return denied;
  const { request, env } = context;
  let body = {};
  try { body = await request.json(); } catch { return json({ error: "bad json" }, 400); }
  const list = (Array.isArray(body.products) ? body.products : []).slice(0, 100);
  const done = []; const missing = [];
  for (const p of list) {
    const id = String(p.id || "");
    const exists = id && await env.DB.prepare("SELECT id FROM products WHERE id = ? AND source = 'pos'").bind(id).first();
    if (!exists) { missing.push(id); continue; }
    const s = await setStock(env, id, p.stock || {});
    if (s.before === 0 && s.after > 0) await restockPush(env, id);
    done.push({ id, available: s.after });
  }
  await env.DB.prepare("INSERT INTO pos_state (key, value) VALUES ('last_stock', ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value").bind(String(Date.now())).run();
  return json({ ok: true, done, missing });
}
