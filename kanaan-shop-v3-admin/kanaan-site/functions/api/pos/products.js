const SITE = "https://kanaanshop.com";
import { json, payloadToRow, slugify, pingIndexNow, COLOR_KEYS, parseImages } from "../../_shared/util.js";
import { guard, setStock, restockPush, productWithStock } from "../../_shared/pos.js";
import { loadCategories } from "../../_shared/site.js";

/* POST /api/pos/products — publish or update one product from the program (one model = one product).
   { posModel, id?, name, category, subcategory, price, description, badge, discount, colors[], sizes[],
     images:[{url,color}], stock:{"color|size":qty}, v, active, replaces:[old product ids] }
   The same posModel always lands on the same product: its link never changes once made.
   replaces: old products (made before the program was connected) this one takes over. The first one is adopted: it
   BECOMES this product (same link, same place in the shop, its likes and "notify me" kept) and the program runs it
   from now on. Any other one leaves the site and its link sends visitors here. */
export async function onRequestPost(context) {
  const denied = await guard(context); if (denied) return denied;
  const { request, env } = context;
  let body = {};
  try { body = await request.json(); } catch { return json({ error: "bad json" }, 400); }
  const posModel = String(body.posModel || "").trim().slice(0, 120);
  if (!posModel) return json({ error: "posModel is required" }, 400);
  const cats = await loadCategories(env);
  if (!cats.ids.includes(String(body.category || ""))) return json({ error: `Choose a category (unknown "${body.category || ""}")` }, 400);
  const colors = [...new Set((body.colors || []).filter((c) => COLOR_KEYS.includes(c)))];
  if (!colors.length) return json({ error: "Give each color a color from the site's palette" }, 400);
  const row = payloadToRow({ ...body, colors }, cats);
  if (!row.name) return json({ error: "Write the name shown on the site" }, 400);
  if (!JSON.parse(row.images).length) return json({ error: "Add at least one photo" }, 400);
  if (!row.price) return json({ error: "The price is missing" }, 400);

  let existing = body.id ? await env.DB.prepare("SELECT id, active, category FROM products WHERE id = ? AND (source = 'pos' OR pos_model = ?)").bind(String(body.id), posModel).first() : null;
  if (!existing) existing = await env.DB.prepare("SELECT id, active, category FROM products WHERE pos_model = ? AND source = 'pos'").bind(posModel).first();
  // the old product it takes over keeps its link: the program adopts it instead of making a new page
  const replaces = (Array.isArray(body.replaces) ? body.replaces : []).map(String).filter(Boolean).slice(0, 20);
  let adopted = null;
  if (!existing) {
    for (const old of replaces) {
      const o = await env.DB.prepare("SELECT id, active, category FROM products WHERE id = ? AND source <> 'pos'").bind(old).first();
      if (o) { existing = o; adopted = o.id; break; }
    }
  }
  let id;
  const now = Date.now();
  if (existing) {
    id = existing.id;
    await env.DB.prepare(`UPDATE products SET name=?, category=?, subcategory=?, price=?, colors=?, sizes=?, description=?, badge=?, discount=?, images=?,
        active=?, source='pos', pos_model=?, replaced_at=0, replaced_by='' WHERE id=?`)
      .bind(row.name, row.category, row.subcategory, row.price, row.colors, row.sizes, row.description, row.badge, row.discount, row.images, row.active, posModel, id).run();
  } else {
    const base = slugify(body.slug || row.name) || "product";
    id = base; let n = 2;
    while (await env.DB.prepare("SELECT id FROM products WHERE id = ?").bind(id).first()) id = `${base}-${n++}`;
    // new ones first in the shop (the lowest sort_order of the shop, minus one)
    const first = await env.DB.prepare("SELECT MIN(sort_order) m FROM products").first();
    await env.DB.prepare(`INSERT INTO products (id, name, category, subcategory, price, colors, sizes, description, badge, discount, images, sold_out, active, sort_order, created_at, is_spotlight, app_exclusive, source, pos_model)
        VALUES (?,?,?,?,?,?,?,?,?,?,?,0,?,?,?,0,0,'pos',?)`)
      .bind(id, row.name, row.category, row.subcategory, row.price, row.colors, row.sizes, row.description, row.badge, row.discount, row.images, row.active,
        Math.min(0, (first && Number(first.m)) || 0) - 1, now, posModel).run();
  }
  const v = Math.max(0, Math.round(Number(body.v) || 0));
  const s = await setStock(env, id, body.stock || {});
  if (v) await env.DB.prepare("UPDATE products SET pos_v = MAX(pos_v, ?) WHERE id = ?").bind(v, id).run();
  if (s.before === 0 && s.after > 0 && existing) await restockPush(env, id);

  // the old products this one takes over: off the site, their links lead here
  const replaced = [];
  for (const old of replaces) {
    if (old === id) continue;
    const r = await env.DB.prepare("UPDATE products SET active = 0, replaced_at = ?, replaced_by = ? WHERE id = ? AND source <> 'pos'").bind(now, id, old).run();
    if (r.meta && r.meta.changes) replaced.push(old);
  }
  if (row.active) pingIndexNow([`${SITE}/product/${id}`, `${SITE}/shop/${row.category}`, `${SITE}/sitemap.xml`, ...replaced.map((o) => `${SITE}/product/${o}`)]);
  return json({ ok: true, id, url: `${SITE}/product/${id}`, replaced, adopted, product: await productWithStock(env, id) });
}

/* GET /api/pos/products            every product the program published (to check and repair links)
   GET /api/pos/products?old=1       the products made before the program (old admin): photos to reuse, to hide */
export async function onRequestGet(context) {
  const denied = await guard(context); if (denied) return denied;
  const old = new URL(context.request.url).searchParams.get("old") === "1";
  const { results } = await context.env.DB.prepare(old
    ? "SELECT id, name, category, subcategory, price, colors, sizes, description, images, active, sold_out, replaced_by, created_at FROM products WHERE source <> 'pos' ORDER BY active DESC, sort_order ASC, created_at DESC"
    : "SELECT id, name, category, subcategory, price, colors, sizes, images, active, sold_out, pos_model, pos_v, created_at FROM products WHERE source = 'pos' ORDER BY created_at DESC").all();
  const rows = (results || []).map((r) => ({ ...r, images: parseImages(r.images), colors: String(r.colors || "").split(",").filter(Boolean), sizes: String(r.sizes || "").split(",").filter(Boolean) }));
  if (old) {
    // what is still on the shelf there (the old stock numbers), so the owner sees what the visitors see
    for (const r of rows) {
      const st = await context.env.DB.prepare("SELECT COALESCE(SUM(MAX(quantity - reserved, 0)),0) n, COUNT(*) c FROM variants WHERE product_id = ?").bind(r.id).first();
      r.available = st && st.c ? Number(st.n) : null;
    }
  }
  return json({ products: rows });
}
