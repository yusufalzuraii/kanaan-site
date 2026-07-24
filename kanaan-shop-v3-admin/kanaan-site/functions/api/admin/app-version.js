import { json, isAuthed } from "../../_shared/util.js";

// GET /api/admin/app-version — القيمة الحالية
export async function onRequestGet(context) {
  const { request, env } = context;
  if (!(await isAuthed(request, env))) return json({ error: "unauthorized" }, 401);
  const row = await env.DB.prepare("SELECT value FROM app_config WHERE key = 'latest_android_version'").first();
  return json({ latest: row ? parseInt(row.value, 10) || 1 : 1 });
}

// POST /api/admin/app-version — تحديث القيمة
export async function onRequestPost(context) {
  const { request, env } = context;
  if (!(await isAuthed(request, env))) return json({ error: "unauthorized" }, 401);

  let body = {};
  try { body = await request.json(); } catch { return json({ error: "bad json" }, 400); }
  const latest = parseInt(body.latest, 10);
  if (!latest || latest < 1) return json({ error: "Invalid version number." }, 400);

  await env.DB.prepare(
    `INSERT INTO app_config (key, value) VALUES ('latest_android_version', ?)
     ON CONFLICT(key) DO UPDATE SET value = excluded.value`
  ).bind(String(latest)).run();

  return json({ ok: true, latest });
}
