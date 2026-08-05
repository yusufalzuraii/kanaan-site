// GET /img/<key> — stream a product image from R2.

export async function onRequestGet(context) {
  const { env, params } = context;
  if (!env.BUCKET) return new Response("Not configured", { status: 500 });

  const key = Array.isArray(params.path) ? params.path.join("/") : String(params.path || "");
  if (!key) return new Response("Not found", { status: 404 });

  let obj = await env.BUCKET.get(key);

  /* Fall back to the full image when a thumbnail is missing.
     ------------------------------------------------------------
     Every photo uploaded before the thumbnail feature existed has no
     "-thumb" file in storage — the site correctly requests one anyway
     (it doesn't know a product's history), gets a 404, and the browser
     falls back to the full image. That's a real, working fallback, but
     it costs a whole failed round trip first and shows up as a 404 in
     the console on every single view of an older product.

     Resolving it here instead means the visitor never sees the failed
     request at all: this key is requested once, and — since the miss
     only ever means "this is an old photo" — the full image comes back
     with a normal 200. */
  if (!obj && /-thumb\.[a-z0-9]+$/i.test(key)) {
    const fullKey = key.replace(/-thumb(\.[a-z0-9]+)$/i, "$1");
    if (fullKey !== key) obj = await env.BUCKET.get(fullKey);
  }

  if (!obj) return new Response("Not found", { status: 404 });

  const headers = new Headers();
  headers.set("Content-Type", (obj.httpMetadata && obj.httpMetadata.contentType) || "image/jpeg");
  headers.set("Cache-Control", "public, max-age=31536000, immutable");
  if (obj.httpEtag) headers.set("ETag", obj.httpEtag);
  return new Response(obj.body, { headers });
}
