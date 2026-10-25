const SITE = "https://kanaanshop.com";
import { json, pingIndexNow } from "../../../_shared/util.js";
import { guard } from "../../../_shared/pos.js";

/* POST /api/pos/products/hide
     { ids:[...] }      take these products off the site (they stay in the database, can come back)
     { legacy: true }   hide every product that was NOT published by the POS (the old ones, before the
                        POS was connected). Their links send visitors to their category page. */
export async function onRequestPost(context) {
  const denied = await guard(context); if (denied) return denied;
  const { request, env } = context;
  let body = {};
  try { body = await request.json(); } catch { return json({ error: "bad json" }, 400); }
  const now = Date.now();
  let changed = 0;
  if (body.legacy === true) {
    const r = await env.DB.prepare("UPDATE products SET active = 0, replaced_at = ? WHERE active = 1 AND source <> 'pos'").bind(now).run();
    changed = (r.meta && r.meta.changes) || 0;
  } else {
    const ids = (Array.isArray(body.ids) ? body.ids : []).map(String).slice(0, 200);
    for (const id of ids) {
      const r = await env.DB.prepare("UPDATE products SET active = 0 WHERE id = ?").bind(id).run();
      changed += (r.meta && r.meta.changes) || 0;
    }
  }
  if (changed) pingIndexNow([`${SITE}/shop`, `${SITE}/sitemap.xml`]);
  return json({ ok: true, hidden: changed });
}
