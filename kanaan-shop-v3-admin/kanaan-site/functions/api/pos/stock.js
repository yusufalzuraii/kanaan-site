import { json } from "../../_shared/util.js";
import { guard, setStock, restockPush } from "../../_shared/pos.js";

/* POST /api/pos/stock — { v, products: [{ id | posModel, stock: { "color|size": qty } }] }
   Live stock from the shop: absolute numbers, many products in one call. v = the Kanaan Cloud version these
   numbers come from: a product already updated from a newer version is left alone (the phone and the computer
   can both send; the newest view always wins, whatever arrives last). */
export async function onRequestPost(context) {
  const denied = await guard(context); if (denied) return denied;
  const { request, env } = context;
  let body = {};
  try { body = await request.json(); } catch { return json({ error: "bad json" }, 400); }
  const v = Math.max(0, Math.round(Number(body.v) || 0));
  const list = (Array.isArray(body.products) ? body.products : []).slice(0, 100);
  const done = []; const missing = []; const older = [];
  for (const p of list) {
    const row = p.id
      ? await env.DB.prepare("SELECT id, pos_v FROM products WHERE id = ? AND source = 'pos'").bind(String(p.id)).first()
      : await env.DB.prepare("SELECT id, pos_v FROM products WHERE pos_model = ? AND source = 'pos'").bind(String(p.posModel || "")).first();
    if (!row) { missing.push(p.id || p.posModel || ""); continue; }
    if (v && Number(row.pos_v) > v) { older.push(row.id); continue; }
    const s = await setStock(env, row.id, p.stock || {});
    if (v) await env.DB.prepare("UPDATE products SET pos_v = ? WHERE id = ?").bind(v, row.id).run();
    if (s.before === 0 && s.after > 0) await restockPush(env, row.id);
    done.push({ id: row.id, available: s.after });
  }
  await env.DB.prepare("INSERT INTO pos_state (key, value) VALUES ('last_stock', ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value").bind(String(Date.now())).run();
  return json({ ok: true, done, missing, older });
}
