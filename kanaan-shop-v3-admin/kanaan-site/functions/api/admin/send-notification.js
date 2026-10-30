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

  // 40 phones a call (a call may reach out ~50 times on the free plan): the page goes on with `after`
  const after = Math.max(0, Math.round(Number(body.after) || 0));
  const total = ((await env.DB.prepare("SELECT COUNT(*) n FROM push_tokens").first()) || {}).n || 0;
  if (!total) return json({ error: "ولا جهاز مسجّل للإشعارات لهلق." }, 400);
  const { results } = await env.DB.prepare("SELECT rowid AS rid, token FROM push_tokens WHERE rowid > ? ORDER BY rowid LIMIT 40").bind(after).all();
  const rows = results || [];
  if (!rows.length) return json({ ok: true, sent: 0, failed: 0, removed: 0, total, next: 0 });

  let result;
  try {
    result = await sendPushToTokens(env, rows.map((r) => r.token), { title, body: message, url });
  } catch (e) {
    return json({ error: String(e.message || e) }, 500);
  }

  if (result.invalidTokens.length > 0) {
    await env.DB.batch(result.invalidTokens.map((t) => env.DB.prepare("DELETE FROM push_tokens WHERE token = ?").bind(t)));
  }

  return json({ ok: true, sent: result.sent, failed: result.failed, removed: result.invalidTokens.length, total, next: rows.length === 40 ? rows[rows.length - 1].rid : 0 });
}
