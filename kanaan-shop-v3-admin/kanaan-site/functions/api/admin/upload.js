import { json, isAuthed } from "../../_shared/util.js";

const EXT = { "image/jpeg": "jpg", "image/png": "png", "image/webp": "webp", "image/gif": "gif" };
const MAX_BYTES = 8 * 1024 * 1024; // 8 MB

/* POST /api/admin/upload  (multipart form-data)
     file  — the product photo (required)
     thumb — optional smaller version of the same photo

   The admin panel shrinks photos in the browser before sending them, so
   what arrives here is normally a few hundred KB rather than the 4–8 MB
   that comes off a phone camera. The 8 MB ceiling stays as a backstop
   for anything that bypasses that (an older browser where optimization
   failed, for instance).

   When a thumbnail is included it's stored beside the full image under
   the same name with "-thumb" appended, so the storefront can work out
   the thumbnail URL from the main one without needing to store both. */
export async function onRequestPost(context) {
  const { request, env } = context;
  if (!(await isAuthed(request, env))) return json({ error: "unauthorized" }, 401);
  if (!env.BUCKET) return json({ error: "Image storage not configured." }, 500);

  let form;
  try { form = await request.formData(); } catch { return json({ error: "bad form" }, 400); }

  const file = form.get("file");
  if (!file || typeof file === "string") return json({ error: "No file." }, 400);

  const type = file.type || "";
  const ext = EXT[type];
  if (!ext) return json({ error: "Only JPG, PNG, WEBP or GIF images are allowed." }, 400);

  // Check the declared size first — reading an oversized file into memory
  // just to measure it can exhaust the Worker's memory before we ever get
  // to reject it.
  if (typeof file.size === "number" && file.size > MAX_BYTES) {
    return json({ error: "Image is larger than 8 MB." }, 400);
  }

  const buf = await file.arrayBuffer();
  if (buf.byteLength > MAX_BYTES) return json({ error: "Image is larger than 8 MB." }, 400);

  const base = `products/${Date.now()}-${crypto.randomUUID().slice(0, 8)}`;
  const key = `${base}.${ext}`;
  await env.BUCKET.put(key, buf, { httpMetadata: { contentType: type } });

  // Thumbnail is a bonus — if it's missing or malformed, the full image
  // still works everywhere and the storefront just falls back to it.
  const thumb = form.get("thumb");
  if (thumb && typeof thumb !== "string") {
    const thumbType = thumb.type || "";
    const thumbExt = EXT[thumbType];
    const withinLimit = typeof thumb.size !== "number" || thumb.size <= MAX_BYTES;
    if (thumbExt && withinLimit) {
      try {
        const thumbBuf = await thumb.arrayBuffer();
        if (thumbBuf.byteLength <= MAX_BYTES) {
          await env.BUCKET.put(`${base}-thumb.${thumbExt}`, thumbBuf, {
            httpMetadata: { contentType: thumbType },
          });
        }
      } catch { /* keep the upload successful — the full image is what matters */ }
    }
  }

  return json({ ok: true, url: `/img/${key}` });
}
