import { json } from "../../_shared/util.js";
import { guard } from "../../_shared/pos.js";
import { loadCategories, saveCategories } from "../../_shared/site.js";

/* GET/PUT /api/pos/categories — the site's categories and fits, edited from the POS. */
export async function onRequestGet(context) {
  const denied = await guard(context); if (denied) return denied;
  return json({ categories: (await loadCategories(context.env)).list });
}
export async function onRequestPut(context) {
  const denied = await guard(context); if (denied) return denied;
  let body = {};
  try { body = await context.request.json(); } catch { return json({ error: "bad json" }, 400); }
  try { return json({ ok: true, categories: (await saveCategories(context.env, body.categories)).list }); } catch (e) { return json({ error: e.message }, 400); }
}
