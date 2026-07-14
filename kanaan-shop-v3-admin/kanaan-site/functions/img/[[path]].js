// GET /img/<key> — stream a product image from R2.
export async function onRequestGet(context) {
  const { env, params } = context;
  if (!env.BUCKET) return new Response("Not configured", { status: 500 });

  const key = Array.isArray(params.path) ? params.path.join("/") : String(params.path || "");
  if (!key) return new Response("Not found", { status: 404 });

  const obj = await env.BUCKET.get(key);
  if (!obj) return new Response("Not found", { status: 404 });

  const headers = new Headers();
  headers.set("Content-Type", (obj.httpMetadata && obj.httpMetadata.contentType) || "image/jpeg");
  headers.set("Cache-Control", "public, max-age=31536000, immutable");
  if (obj.httpEtag) headers.set("ETag", obj.httpEtag);
  return new Response(obj.body, { headers });
}
