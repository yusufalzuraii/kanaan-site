import { json, isAuthed } from "../../_shared/util.js";
import { sendPushToTokens } from "../../_shared/fcm.js";

/* POST /api/admin/send-notification
   ------------------------------------------------------------
   بينادى من لوحة /admin بس. بيبعت إشعار لكل الأجهزة المسجّلة
   (كل زبون فاتح التطبيق ووافق على الإشعارات)، وبينضف أي توكن
   جهاز صار غير صالح (تطبيق انحذف) تلقائياً بعد الإرسال.
   ============================================================ */
export async function onRequestPost(context) {
  const { request, env } = context;
  if (!(await isAuthed(request, env))) return json({ error: "Unauthorized" }, 401);
  if (!env.DB) return json({ error: "Database not configured." }, 500);

  let body = {};
  try { body = await request.json(); } catch { return json({ error: "bad json" }, 400); }

  const title = String(body.title || "").trim().slice(0, 120);
  const message = String(body.body || "").trim().slice(0, 300);
  const url = body.url ? String(body.url).trim().slice(0, 300) : null;
  if (!title || !message) return json({ error: "العنوان والنص مطلوبين." }, 400);

  const { results } = await env.DB.prepare("SELECT token FROM push_tokens").all();
  const tokens = (results || []).map((r) => r.token);
  if (tokens.length === 0) return json({ error: "ولا جهاز مسجّل للإشعارات لهلق." }, 400);

  let result;
  try {
    result = await sendPushToTokens(env, tokens, { title, body: message, url });
  } catch (e) {
    return json({ error: String(e.message || e) }, 500);
  }

  if (result.invalidTokens.length > 0) {
    for (const t of result.invalidTokens) {
      await env.DB.prepare("DELETE FROM push_tokens WHERE token = ?").bind(t).run();
    }
  }

  return json({ ok: true, sent: result.sent, failed: result.failed, removed: result.invalidTokens.length, total: tokens.length });
}
