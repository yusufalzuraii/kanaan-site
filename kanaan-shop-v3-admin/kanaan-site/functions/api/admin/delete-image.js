import { json, isAuthed } from "../../_shared/util.js";

/* POST /api/admin/delete-image  { url }
   Removes one uploaded image from R2. Used when the shop owner removes a
   photo in the admin form, so images they discarded don't sit in storage
   forever eating their free quota. */
export async function onRequestPost(context) {
  const { request, env } = context;
  if (!(await isAuthed(request, env))) return json({ error: "unauthorized" }, 401);
  if (!env.BUCKET) return json({ error: "Image storage not configured." }, 500);

  let body = {};
  try { body = await request.json(); } catch { return json({ error: "bad json" }, 400); }

  const url = String(body.url || "").trim();
  // Only ever touch our own uploaded images.
  if (!url.startsWith("/img/")) return json({ ok: true, skipped: true });

  try {
    await env.BUCKET.delete(url.slice(5));
  } catch { /* already gone — fine */ }

  return json({ ok: true });
}
