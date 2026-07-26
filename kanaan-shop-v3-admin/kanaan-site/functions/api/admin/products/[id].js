const SITE = "https://kanaanshop.com";
import { json, isAuthed, rowToProduct, payloadToRow, saveVariants, parseImages , deleteUploadedImage , pingIndexNow } from "../../../_shared/util.js";
import { sendPushToTokens } from "../../../_shared/fcm.js";

// PUT /api/admin/products/:id  -> update
export async function onRequestPut(context) {
  const { request, env, params } = context;
  if (!(await isAuthed(request, env))) return json({ error: "unauthorized" }, 401);
  const id = params.id;

  const existing = await env.DB.prepare("SELECT id, sold_out, name FROM products WHERE id = ?").bind(id).first();
  if (!existing) return json({ error: "not found" }, 404);

  let body = {};
  try { body = await request.json(); } catch { return json({ error: "bad json" }, 400); }
  const row = payloadToRow(body);
  if (!row.name) return json({ error: "Name is required." }, 400);

  await env.DB.prepare(
    `UPDATE products SET name=?, category=?, subcategory=?, price=?, colors=?, sizes=?, description=?,
       badge=?, discount=?, images=?, sold_out=?, active=?, is_spotlight=?, app_exclusive=? WHERE id=?`
  ).bind(
    row.name, row.category, row.subcategory, row.price, row.colors, row.sizes, row.description,
    row.badge, row.discount, row.images, row.sold_out, row.active, row.is_spotlight, row.app_exclusive, id
  ).run();

  const updated = await env.DB.prepare("SELECT * FROM products WHERE id = ?").bind(id).first();
  pingIndexNow([`${SITE}/product/${id}`, `${SITE}/shop/${row.category}`, `${SITE}/sitemap.xml`]);
  try { await saveVariants(env, id, body.variants); } catch { /* stock optional */ }

  // "نبّهني لما يرجع متوفر" — لو المنتج كان نافد وهلق صار متوفر،
  // بنبعت إشعار لكل يلي اشتركوا، وبعدين بنمسح اشتراكاتهم (مرة وحدة).
  if (existing.sold_out === 1 && row.sold_out === 0) {
    try {
      const { results } = await env.DB.prepare(
        "SELECT token FROM restock_subscriptions WHERE product_id = ?"
      ).bind(id).all();
      const tokens = (results || []).map((r) => r.token);
      if (tokens.length > 0) {
        await sendPushToTokens(env, tokens, {
          title: "Back in stock 🎉",
          body: `${row.name} is back — grab it before it's gone again.`,
          url: "/shop",
        });
        await env.DB.prepare("DELETE FROM restock_subscriptions WHERE product_id = ?").bind(id).run();
      }
    } catch { /* الإشعار مش أساسي — ما لازم يوقف حفظ المنتج */ }
  }

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
      for (const img of parseImages(row.images)) {
        await deleteUploadedImage(env, img.url);
      }
    }
  } catch { /* ignore */ }

  try { await env.DB.prepare("DELETE FROM variants WHERE product_id = ?").bind(id).run(); } catch { /* ignore */ }
  await env.DB.prepare("DELETE FROM products WHERE id = ?").bind(id).run();

  // Ping on delete too, so the removed page drops out of results
  // quickly instead of lingering as a dead link.
  pingIndexNow([`${SITE}/product/${id}`, `${SITE}/shop`, `${SITE}/sitemap.xml`]);

  return json({ ok: true });
}
