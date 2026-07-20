import { json } from "../_shared/util.js";

/* POST /api/push/register
   ------------------------------------------------------------
   بينادى هالمسار من التطبيق (أندرويد/آيفون) بس، مرة عند أول فتح
   بعد ما المستخدم يوافق على الإشعارات، ومرة كل ما التطبيق يفتح
   من جديد (احتياطاً، بما إنو توكن الجهاز ممكن يتغيّر). عام —
   ما بيحتاج تسجيل دخول، لأنو أي زبون بيقدر يوافق على الإشعارات.
   ============================================================ */
export async function onRequestPost(context) {
  const { request, env } = context;
  if (!env.DB) return json({ error: "Database not configured." }, 500);

  let body = {};
  try { body = await request.json(); } catch { return json({ error: "bad json" }, 400); }

  const token = String(body.token || "").trim();
  const platform = String(body.platform || "android").trim().slice(0, 20) || "android";
  if (!token || token.length > 500) return json({ error: "Missing or invalid token." }, 400);

  const now = Date.now();
  await env.DB.prepare(
    `INSERT INTO push_tokens (token, platform, created_at, updated_at)
     VALUES (?, ?, ?, ?)
     ON CONFLICT(token) DO UPDATE SET updated_at = excluded.updated_at, platform = excluded.platform`
  ).bind(token, platform, now, now).run();

  return json({ ok: true });
}
