import { json } from "../../_shared/util.js";
import { guard, setStockMany, restockPush } from "../../_shared/pos.js";

/* POST /api/pos/stock — { v, products: [{ id | posModel, stock: { "color|size": qty } }] }
   Live stock from the shop: absolute numbers, many products in one call. v = the Kanaan Cloud version these
   numbers come from: a product already updated from a newer version is left alone (the phone and the computer
   can both send; the newest view always wins, whatever arrives last). The whole call is a handful of queries,
   however many products (the free plan allows ~50 per call). */
export async function onRequestPost(context) {
  const denied = await guard(context); if (denied) return denied;
  const { request, env } = context;
  let body = {};
  try { body = await request.json(); } catch { return json({ error: "bad json" }, 400); }
  const v = Math.max(0, Math.round(Number(body.v) || 0));
  const list = (Array.isArray(body.products) ? body.products : []).slice(0, 100);
  const done = []; const missing = []; const older = [];
  // the products, by id or by model: one read per 40
  const found = new Map(); // key (id or "m:"+model) → row
  const ids = [...new Set(list.filter((p) => p.id).map((p) => String(p.id)))];
  const models = [...new Set(list.filter((p) => !p.id).map((p) => String(p.posModel || "")).filter(Boolean))];
  for (let i = 0; i < ids.length; i += 40) {
    const part = ids.slice(i, i + 40);
    const { results } = await env.DB.prepare(`SELECT id, pos_model, pos_v FROM products WHERE source = 'pos' AND id IN (${part.map(() => "?").join(",")})`).bind(...part).all();
    for (const r of results || []) found.set(r.id, r);
  }
  for (let i = 0; i < models.length; i += 40) {
    const part = models.slice(i, i + 40);
    const { results } = await env.DB.prepare(`SELECT id, pos_model, pos_v FROM products WHERE source = 'pos' AND pos_model IN (${part.map(() => "?").join(",")})`).bind(...part).all();
    for (const r of results || []) found.set(`m:${r.pos_model}`, r);
  }
  const entries = [];
  for (const p of list) {
    const row = p.id ? found.get(String(p.id)) : found.get(`m:${String(p.posModel || "")}`);
    if (!row) { missing.push(p.id || p.posModel || ""); continue; }
    if (v && Number(row.pos_v) > v) { older.push(row.id); continue; }
    entries.push({ id: row.id, stock: p.stock || {}, v });
  }
  const res = await setStockMany(env, entries);
  let pushes = 0;
  for (const e of entries) {
    const s = res.get(e.id);
    done.push({ id: e.id, available: s.after });
    // "notify me when it's back": a few per call (each reaches out to the phones)
    if (s.before === 0 && s.after > 0 && pushes < 3) { pushes++; await restockPush(env, e.id); }
  }
  await env.DB.prepare("INSERT INTO pos_state (key, value) VALUES ('last_stock', ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value").bind(String(Date.now())).run();
  return json({ ok: true, done, missing, older });
}
