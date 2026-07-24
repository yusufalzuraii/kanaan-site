import { json } from "../_shared/util.js";

/* POST /api/log-error
   ------------------------------------------------------------
   بينادى تلقائياً من الـ Error Boundary بالموقع/التطبيق لما يصير
   خطأ برمجي غير متوقع. عام (بلا تسجيل دخول) — أي زبون ممكن يواجه
   خطأ. بنحدد طول كل حقل حتى ما حدا يقدر يبعت بيانات ضخمة عشوائية.
   ============================================================ */
export async function onRequestPost(context) {
  const { request, env } = context;
  if (!env.DB) return json({ error: "Database not configured." }, 500);

  let body = {};
  try { body = await request.json(); } catch { return json({ error: "bad json" }, 400); }

  const id = crypto.randomUUID();
  const message = String(body.message || "").slice(0, 500);
  const stack = String(body.stack || "").slice(0, 2000);
  const componentStack = String(body.componentStack || "").slice(0, 2000);
  const url = String(body.url || "").slice(0, 500);
  const platform = String(body.platform || "").slice(0, 20);

  try {
    await env.DB.prepare(
      `INSERT INTO error_logs (id, message, stack, component_stack, url, platform, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?)`
    ).bind(id, message, stack, componentStack, url, platform, Date.now()).run();
  } catch { /* لو حتى تسجيل الخطأ فشل، ما لازم نرجّع خطأ للمستخدم */ }

  return json({ ok: true });
}
