import { json } from "../../../_shared/util.js";
import { guard } from "../../../_shared/pos.js";

/* POST /api/pos/products/flags — { id, spotlight?, appOnly? } for a product the program published:
   spotlight = first on the app's home; appOnly = sold only in the app (hidden from the website, its search and
   Google). Publishing again keeps both. */
export async function onRequestPost(context) {
  const denied = await guard(context); if (denied) return denied;
  const { request, env } = context;
  let body = {};
  try { body = await request.json(); } catch { return json({ error: "bad json" }, 400); }
  const id = String(body.id || "").slice(0, 120);
  const p = await env.DB.prepare("SELECT id FROM products WHERE id = ? AND source = 'pos'").bind(id).first();
  if (!p) return json({ error: "Not a product published from Kanaan" }, 404);
  const sets = []; const binds = [];
  if ("spotlight" in body) { sets.push("is_spotlight = ?"); binds.push(body.spotlight ? 1 : 0); }
  if ("appOnly" in body) { sets.push("app_exclusive = ?"); binds.push(body.appOnly ? 1 : 0); }
  if (!sets.length) return json({ error: "Nothing to change" }, 400);
  await env.DB.prepare(`UPDATE products SET ${sets.join(", ")} WHERE id = ?`).bind(...binds, id).run();
  const row = await env.DB.prepare("SELECT id, is_spotlight, app_exclusive FROM products WHERE id = ?").bind(id).first();
  return json({ ok: true, product: row });
}
