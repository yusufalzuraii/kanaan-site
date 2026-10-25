import { json, deleteUploadedImage } from "../../_shared/util.js";
import { guard } from "../../_shared/pos.js";

/* POST /api/pos/images  (multipart: file, thumb?)
   A product photo from the program (computer or phone). The program shrinks it before sending (about 1600 px,
   a few hundred KB) and adds a small thumbnail; both are stored side by side like the old admin does, so the
   storefront finds "-thumb" by itself.
   DELETE /api/pos/images?url=/img/products/… removes one the program uploaded and no longer uses. */
const EXT = { "image/jpeg": "jpg", "image/png": "png", "image/webp": "webp" };
const MAX = 8 * 1024 * 1024;

export async function onRequestPost(context) {
  const denied = await guard(context); if (denied) return denied;
  const { request, env } = context;
  if (!env.BUCKET) return json({ error: "Image storage not configured." }, 500);
  let form;
  try { form = await request.formData(); } catch { return json({ error: "bad form" }, 400); }
  const file = form.get("file");
  if (!file || typeof file === "string") return json({ error: "No file." }, 400);
  const ext = EXT[file.type || ""];
  if (!ext) return json({ error: "Only JPG, PNG or WEBP photos." }, 400);
  if (typeof file.size === "number" && file.size > MAX) return json({ error: "Photo is larger than 8 MB." }, 400);
  const buf = await file.arrayBuffer();
  if (buf.byteLength > MAX) return json({ error: "Photo is larger than 8 MB." }, 400);
  const base = `products/pos-${Date.now()}-${crypto.randomUUID().slice(0, 8)}`;
  await env.BUCKET.put(`${base}.${ext}`, buf, { httpMetadata: { contentType: file.type } });
  const thumb = form.get("thumb");
  if (thumb && typeof thumb !== "string" && EXT[thumb.type || ""]) {
    try { const t = await thumb.arrayBuffer(); if (t.byteLength <= MAX) await env.BUCKET.put(`${base}-thumb.${EXT[thumb.type]}`, t, { httpMetadata: { contentType: thumb.type } }); } catch { /* the full photo is what matters */ }
  }
  return json({ ok: true, url: `/img/${base}.${ext}` });
}

export async function onRequestDelete(context) {
  const denied = await guard(context); if (denied) return denied;
  const url = new URL(context.request.url).searchParams.get("url") || "";
  if (!/^\/img\/products\/pos-[\w.-]+$/.test(url)) return json({ error: "Only photos uploaded by the program can be removed here." }, 400);
  // never remove a photo a product still shows
  const used = await context.env.DB.prepare("SELECT id FROM products WHERE images LIKE ? LIMIT 1").bind(`%${url}%`).first();
  if (used) return json({ ok: true, kept: true });
  try { await deleteUploadedImage(context.env, url); } catch { /* best effort */ }
  return json({ ok: true });
}
