import { json } from "../_shared/util.js";

/* GET /api/app-version — رقم آخر إصدار متوفر من تطبيق أندرويد.
   عام، بلا تسجيل دخول — التطبيق بيسأله كل ما يفتح ليعرف إذا فيه
   نسخة أحدث على Google Play. */
export async function onRequestGet(context) {
  const { env } = context;
  if (!env.DB) return json({ latest: 1 });

  const row = await env.DB.prepare("SELECT value FROM app_config WHERE key = 'latest_android_version'").first();
  const latest = row ? parseInt(row.value, 10) || 1 : 1;
  return json({ latest });
}
