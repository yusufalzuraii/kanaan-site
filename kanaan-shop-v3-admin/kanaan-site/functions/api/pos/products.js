const SITE = "https://kanaanshop.com";
import { json, payloadToRow, slugify, pingIndexNow, COLOR_KEYS } from "../../_shared/util.js";
import { guard, setStock, restockPush, productWithStock } from "../../_shared/pos.js";
import { loadCategories } from "../../_shared/site.js";

/* POST /api/pos/products — publish or update one product from the POS (one POS model = one product).
   { posModel, id?, name, category, subcategory, price, description, badge, discount, colors[], sizes[],
     images:[{url,color}], stock:{"color|size":qty}, active }
   The same posModel always lands on the same product (its link never changes once made). */
export async function onRequestPost(context) {
  const denied = await guard(context); if (denied) return denied;
  const { request, env } = context;
  let body = {};
  try { body = await request.json(); } catch { return json({ error: "bad json" }, 400); }
  const posModel = String(body.posModel || "").trim().slice(0, 120);
  if (!posModel) return json({ error: "posModel is required" }, 400);
  const cats = await loadCategories(env);
  if (!cats.ids.includes(String(body.category || ""))) return json({ error: `Unknown category "${body.category}"` }, 400);
  const colors = (body.colors || []).filter((c) => COLOR_KEYS.includes(c));
  if (!colors.length) return json({ error: "No colour from the site palette" }, 400);
  const row = payloadToRow({ ...body, colors }, cats);
  if (!row.name) return json({ error: "Name is required." }, 400);
  if (!JSON.parse(row.images).length) return json({ error: "A product needs at least one photo." }, 400);

  let existing = body.id ? await env.DB.prepare("SELECT id, active FROM products WHERE id = ?").bind(String(body.id)).first() : null;
  if (!existing) existing = await env.DB.prepare("SELECT id, active FROM products WHERE pos_model = ? AND source = 'pos'").bind(posModel).first();
  let id;
  if (existing) {
    id = existing.id;
    await env.DB.prepare(`UPDATE products SET name=?, category=?, subcategory=?, price=?, colors=?, sizes=?, description=?, badge=?, discount=?, images=?,
        active=?, source='pos', pos_model=?, replaced_at=0 WHERE id=?`)
      .bind(row.name, row.category, row.subcategory, row.price, row.colors, row.sizes, row.description, row.badge, row.discount, row.images, row.active, posModel, id).run();
  } else {
    const base = slugify(body.slug || row.name) || "product";
    id = base; let n = 2;
    while (await env.DB.prepare("SELECT id FROM products WHERE id = ?").bind(id).first()) id = `${base}-${n++}`;
    await env.DB.prepare(`INSERT INTO products (id, name, category, subcategory, price, colors, sizes, description, badge, discount, images, sold_out, active, sort_order, created_at, is_spotlight, app_exclusive, source, pos_model)
        VALUES (?,?,?,?,?,?,?,?,?,?,?,0,?,0,?,0,0,'pos',?)`)
      .bind(id, row.name, row.category, row.subcategory, row.price, row.colors, row.sizes, row.description, row.badge, row.discount, row.images, row.active, Date.now(), posModel).run();
  }
  const s = await setStock(env, id, body.stock || {});
  if (s.before === 0 && s.after > 0 && existing) await restockPush(env, id);
  if (row.active) pingIndexNow([`${SITE}/product/${id}`, `${SITE}/shop/${row.category}`, `${SITE}/sitemap.xml`]);
  return json({ ok: true, id, product: await productWithStock(env, id) });
}

/* GET /api/pos/products — every product the POS published (to check and repair links). */
export async function onRequestGet(context) {
  const denied = await guard(context); if (denied) return denied;
  const { results } = await context.env.DB.prepare("SELECT id, name, active, pos_model, category FROM products WHERE source = 'pos' ORDER BY created_at DESC").all();
  return json({ products: results || [] });
}
