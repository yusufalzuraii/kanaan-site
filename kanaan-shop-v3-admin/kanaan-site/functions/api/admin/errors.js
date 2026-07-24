import { json, isAuthed } from "../../_shared/util.js";

/* GET /api/admin/errors — آخر 30 خطأ مسجّل، الأحدث أول. أدمن بس. */
export async function onRequestGet(context) {
  const { request, env } = context;
  if (!(await isAuthed(request, env))) return json({ error: "Unauthorized" }, 401);
  if (!env.DB) return json({ error: "Database not configured." }, 500);

  const { results } = await env.DB.prepare(
    "SELECT id, message, stack, component_stack, url, platform, created_at FROM error_logs ORDER BY created_at DESC LIMIT 30"
  ).all();

  return json({ errors: results || [] });
}
