const SITE = "https://kanaanshop.com";
import { json, isAuthed, rowToProduct, payloadToRow, slugify, saveVariants, loadVariantsForProducts , pingIndexNow } from "../../_shared/util.js";

// GET /api/admin/products -> all products (including hidden), with stock
export async function onRequestGet(context) {
  const { request, env } = context;
  if (!(await isAuthed(request, env))) return json({ error: "unauthorized" }, 401);
  const { results } = await env.DB.prepare(
    "SELECT * FROM products ORDER BY sort_order ASC, created_at DESC"
  ).all();
  const products = (results || []).map(rowToProduct);

  // One query for every product's stock, rather than one query each.
  let byProduct = {};
  try {
    byProduct = await loadVariantsForProducts(env, products.map((p) => p.id));
  } catch { /* stock is optional — the list still renders without it */ }

  for (const p of products) {
    const v = byProduct[p.id];
    p.variants = v ? v.stock : {};
    p.reserved = v ? v.reserved : {};
  }
  return json({ products });
}

// POST /api/admin/products -> create a product
export async function onRequestPost(context) {
  const { request, env } = context;
  if (!(await isAuthed(request, env))) return json({ error: "unauthorized" }, 401);

  let body = {};
  try { body = await request.json(); } catch { return json({ error: "bad json" }, 400); }
  const row = payloadToRow(body);
  if (!row.name) return json({ error: "Name is required." }, 400);

  let base = slugify(row.name) || "product";
  let id = base;
  let n = 2;
  while (true) {
    const hit = await env.DB.prepare("SELECT id FROM products WHERE id = ?").bind(id).first();
    if (!hit) break;
    id = `${base}-${n++}`;
  }

  const now = Date.now();
  await env.DB.prepare(
    `INSERT INTO products (id, name, category, subcategory, price, colors, sizes, description, badge, discount, images, sold_out, active, sort_order, created_at, is_spotlight, app_exclusive)
     VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`
  ).bind(
    id, row.name, row.category, row.subcategory, row.price, row.colors, row.sizes, row.description,
    row.badge, row.discount, row.images, row.sold_out, row.active, 0, now, row.is_spotlight, row.app_exclusive
  ).run();

  try { await saveVariants(env, id, body.variants); } catch { /* stock optional */ }

  const created = await env.DB.prepare("SELECT * FROM products WHERE id = ?").bind(id).first();

  // Tell the search engines straight away rather than waiting for them
  // to notice on their next crawl. Includes the pages this product now
  // appears on, since their listings changed too.
  pingIndexNow([
    `${SITE}/product/${id}`,
    `${SITE}/shop/${row.category}`,
    `${SITE}/shop`,
    `${SITE}/sitemap.xml`,
  ]);

  return json({ ok: true, product: rowToProduct(created) });
}
