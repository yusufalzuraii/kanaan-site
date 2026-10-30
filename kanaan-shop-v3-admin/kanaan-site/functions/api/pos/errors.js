import { json } from "../../_shared/util.js";
import { guard } from "../../_shared/pos.js";

/* GET /api/pos/errors?limit=50 — the problems shoppers hit (reported by the site and the app by themselves),
   newest first. DELETE /api/pos/errors — clear the list. */
export async function onRequestGet(context) {
  const denied = await guard(context); if (denied) return denied;
  const { env, request } = context;
  const limit = Math.min(200, Math.max(1, Number(new URL(request.url).searchParams.get("limit")) || 50));
  const { results } = await env.DB.prepare("SELECT id, message, stack, component_stack, url, platform, created_at FROM error_logs ORDER BY created_at DESC LIMIT ?").bind(limit).all();
  return json({ errors: results || [] });
}

export async function onRequestDelete(context) {
  const denied = await guard(context); if (denied) return denied;
  const r = await context.env.DB.prepare("DELETE FROM error_logs").run();
  return json({ ok: true, removed: (r.meta && r.meta.changes) || 0 });
}
