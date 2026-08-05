// GET /img/<key> — stream a product image from R2.

export async function onRequestGet(context) {
  const { env, params } = context;
  if (!env.BUCKET) return new Response("Not configured", { status: 500 });

  const key = Array.isArray(params.path) ? params.path.join("/") : String(params.path || "");
  if (!key) return notFound();

  let obj = await env.BUCKET.get(key);

  /* Fall back to the full image when a thumbnail is missing.
     ------------------------------------------------------------
     Some photos never get a "-thumb" file: either they predate the
     thumbnail feature, or they were already small enough on upload that
     the optimizer intentionally left them untouched (see
     src/imageOptimizer.js — anything under ~120KB is skipped, since
     re-encoding a file that small risks losing more quality than it
     saves). Either way, the site correctly asks for a thumbnail without
     knowing in advance whether one exists.

     Resolving it here means that request never surfaces as a failure:
     it's answered with the full image and a normal 200, in one request. */
  if (!obj && /-thumb\.[a-z0-9]+$/i.test(key)) {
    const fullKey = key.replace(/-thumb(\.[a-z0-9]+)$/i, "$1");
    if (fullKey !== key) obj = await env.BUCKET.get(fullKey);
  }

  if (!obj) return notFound();

  const headers = new Headers();
  headers.set("Content-Type", (obj.httpMetadata && obj.httpMetadata.contentType) || "image/jpeg");
  headers.set("Cache-Control", "public, max-age=31536000, immutable");
  if (obj.httpEtag) headers.set("ETag", obj.httpEtag);
  return new Response(obj.body, { headers });
}

/* A 404 with no caching instructions can still end up cached at
   Cloudflare's edge based on status code and file extension alone —
   which is exactly what let an old "not found" respons survive past a
   fix that made the same request succeed. Every miss now says explicitly
   not to be stored anywhere, so a fix always takes effect on the very
   next request instead of waiting out a stale edge cache. */
function notFound() {
  return new Response("Not found", {
    status: 404,
    headers: { "Cache-Control": "no-store" },
  });
}
