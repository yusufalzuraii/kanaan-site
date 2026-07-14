import { json, isAuthed } from "../../_shared/util.js";

const EXT = { "image/jpeg": "jpg", "image/png": "png", "image/webp": "webp", "image/gif": "gif" };
const MAX_BYTES = 8 * 1024 * 1024; // 8 MB

// POST /api/admin/upload  (multipart form-data, field "file") -> { url }
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

  const buf = await file.arrayBuffer();
  if (buf.byteLength > MAX_BYTES) return json({ error: "Image is larger than 8 MB." }, 400);

  const key = `products/${Date.now()}-${crypto.randomUUID().slice(0, 8)}.${ext}`;
  await env.BUCKET.put(key, buf, { httpMetadata: { contentType: type } });

  return json({ ok: true, url: `/img/${key}` });
}
