import { json, rateLimit, tooManyRequests } from "../../_shared/util.js";

/* POST /api/restock/subscribe
   ------------------------------------------------------------
   بينادى من صفحة منتج نافد الكمية بالتطبيق — المستخدم بضغط
   "Notify me"، ومنسجّل ربط بين توكن جهازو والمنتج. لما يرجع
   يتوفر، بنبعتلو إشعار ومنمسح الاشتراك (استخدام مرة وحدة).
   ============================================================ */
export async function onRequestPost(context) {
  const { request, env } = context;
  if (!env.DB) return json({ error: "Database not configured." }, 500);

  /* Public endpoint that writes to the database, so it needs a ceiling.
     20 an hour covers browsing several sold-out pieces in one sitting. */
  const limit = await rateLimit(request, env, "restock", 20, 60 * 60 * 1000);
  if (!limit.allowed) return tooManyRequests(limit.retryAfter);

  let body = {};
  try { body = await request.json(); } catch { return json({ error: "bad json" }, 400); }

  const productId = String(body.productId || "").trim();
  const token = String(body.token || "").trim();
  if (!productId || !token || token.length > 500) {
    return json({ error: "Missing product or device token." }, 400);
  }

  const id = crypto.randomUUID();
  await env.DB.prepare(
    `INSERT INTO restock_subscriptions (id, product_id, token, created_at)
     VALUES (?, ?, ?, ?)
     ON CONFLICT(product_id, token) DO NOTHING`
  ).bind(id, productId, token, Date.now()).run();

  return json({ ok: true });
}
