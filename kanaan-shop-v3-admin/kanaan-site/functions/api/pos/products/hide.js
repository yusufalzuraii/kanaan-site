const SITE = "https://kanaanshop.com";
import { json, pingIndexNow } from "../../../_shared/util.js";
import { guard } from "../../../_shared/pos.js";

/* POST /api/pos/products/hide
     { ids:[...] }               take these products off the site (they stay in the database, can come back)
     { ids:[...], show: true }   put them back on the site
     { legacy: true }            hide every product that was NOT published by the program (the old ones). Their
                                 links send visitors to their category page (or to the product that replaced them). */
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
    const show = body.show === true;
    for (const id of ids) {
      const r = show
        ? await env.DB.prepare("UPDATE products SET active = 1, replaced_at = 0, replaced_by = '' WHERE id = ?").bind(id).run()
        : await env.DB.prepare("UPDATE products SET active = 0, replaced_at = CASE WHEN source <> 'pos' THEN ? ELSE replaced_at END WHERE id = ?").bind(now, id).run();
      changed += (r.meta && r.meta.changes) || 0;
    }
  }
  if (changed) pingIndexNow([`${SITE}/shop`, `${SITE}/sitemap.xml`]);
  return json({ ok: true, changed, hidden: changed });
}
