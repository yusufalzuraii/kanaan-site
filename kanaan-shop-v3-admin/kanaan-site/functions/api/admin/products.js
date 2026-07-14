import { json, isAuthed, rowToProduct, payloadToRow, slugify } from "../../_shared/util.js";

// GET /api/admin/products -> all products (including hidden) for management
export async function onRequestGet(context) {
  const { request, env } = context;
  if (!(await isAuthed(request, env))) return json({ error: "unauthorized" }, 401);
  const { results } = await env.DB.prepare(
    "SELECT * FROM products ORDER BY sort_order ASC, created_at DESC"
  ).all();
  return json({ products: (results || []).map(rowToProduct) });
}

// POST /api/admin/products  -> create a product
export async function onRequestPost(context) {
  const { request, env } = context;
  if (!(await isAuthed(request, env))) return json({ error: "unauthorized" }, 401);

  let body = {};
  try { body = await request.json(); } catch { return json({ error: "bad json" }, 400); }
  const row = payloadToRow(body);
  if (!row.name) return json({ error: "Name is required." }, 400);

  // unique slug id
  let base = slugify(row.name) || "product";
  let id = base;
  let n = 2;
  // check existing
  while (true) {
    const hit = await env.DB.prepare("SELECT id FROM products WHERE id = ?").bind(id).first();
    if (!hit) break;
    id = `${base}-${n++}`;
  }

  const now = Date.now();
  // put new items first by default
  await env.DB.prepare(
    `INSERT INTO products (id, name, category, price, colors, sizes, description, badge, discount, images, sold_out, active, sort_order, created_at)
     VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?)`
  ).bind(
    id, row.name, row.category, row.price, row.colors, row.sizes, row.description,
    row.badge, row.discount, row.images, row.sold_out, row.active, 0, now
  ).run();

  const created = await env.DB.prepare("SELECT * FROM products WHERE id = ?").bind(id).first();
  return json({ ok: true, product: rowToProduct(created) });
}
