import { json, isAuthed, rowToProduct, payloadToRow } from "../../../_shared/util.js";

// PUT /api/admin/products/:id  -> update
export async function onRequestPut(context) {
  const { request, env, params } = context;
  if (!(await isAuthed(request, env))) return json({ error: "unauthorized" }, 401);
  const id = params.id;

  const existing = await env.DB.prepare("SELECT id FROM products WHERE id = ?").bind(id).first();
  if (!existing) return json({ error: "not found" }, 404);

  let body = {};
  try { body = await request.json(); } catch { return json({ error: "bad json" }, 400); }
  const row = payloadToRow(body);
  if (!row.name) return json({ error: "Name is required." }, 400);

  await env.DB.prepare(
    `UPDATE products SET name=?, category=?, price=?, colors=?, sizes=?, description=?,
       badge=?, discount=?, images=?, sold_out=?, active=? WHERE id=?`
  ).bind(
    row.name, row.category, row.price, row.colors, row.sizes, row.description,
    row.badge, row.discount, row.images, row.sold_out, row.active, id
  ).run();

  const updated = await env.DB.prepare("SELECT * FROM products WHERE id = ?").bind(id).first();
  return json({ ok: true, product: rowToProduct(updated) });
}

// DELETE /api/admin/products/:id
export async function onRequestDelete(context) {
  const { request, env, params } = context;
  if (!(await isAuthed(request, env))) return json({ error: "unauthorized" }, 401);
  const id = params.id;

  // best-effort: remove this product's uploaded images from R2
  try {
    const row = await env.DB.prepare("SELECT images FROM products WHERE id = ?").bind(id).first();
    if (row && row.images && env.BUCKET) {
      for (const p of String(row.images).split(",").map((s) => s.trim()).filter(Boolean)) {
        if (p.startsWith("/img/")) {
          try { await env.BUCKET.delete(p.slice(5)); } catch { /* ignore */ }
        }
      }
    }
  } catch { /* ignore */ }

  await env.DB.prepare("DELETE FROM products WHERE id = ?").bind(id).run();
  return json({ ok: true });
}
