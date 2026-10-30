/* GET /shop — the "all products" listing. */

const esc = (s) =>
  String(s == null ? "" : s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");

export async function onRequestGet(context) {
  const { env, next } = context;

  let res;
  try {
    res = await next(fresh(context.request));
  } catch {
    return new Response("Not found", { status: 404 });
  }

  const ct = res.headers.get("Content-Type") || "";
  if (!ct.includes("text/html")) return res;

  let count = 0;
  try {
    const row = await env.DB.prepare("SELECT COUNT(*) AS n FROM products WHERE active = 1 AND app_exclusive = 0 AND sold_out = 0").first();
    count = Number(row?.n) || 0;
  } catch { /* description still works without the count */ }

  const title = "Shop — Kanaan Shop";
  const descText = count > 0
    ? `Browse all ${count} pieces at Kanaan Shop — T-Shirts, Shirts, Jeans, Pants, Shorts, Sets, Underwear, Shoes and more. Delivery all over Lebanon, cash on delivery.`
    : "Browse the full Kanaan Shop catalogue. Delivery all over Lebanon, cash on delivery.";
  const url = "https://kanaanshop.com/shop";

  const tags = `
    <title>${esc(title)}</title>
    <meta name="description" content="${esc(descText)}" />
    <link rel="canonical" href="${url}" />
    <meta property="og:type" content="website" />
    <meta property="og:site_name" content="Kanaan Shop" />
    <meta property="og:title" content="${esc(title)}" />
    <meta property="og:description" content="${esc(descText)}" />
    <meta property="og:url" content="${url}" />
    <meta name="twitter:card" content="summary" />
    <meta name="twitter:title" content="${esc(title)}" />
    <meta name="twitter:description" content="${esc(descText)}" />
  `;

  let html = await res.text();
  html = html
    .replace(/<title>[\s\S]*?<\/title>/i, "")
    .replace(/<meta\s+name="description"[^>]*>/gi, "")
    .replace(/<link\s+rel="canonical"[^>]*>/gi, "")
    .replace(/<meta\s+property="og:[^"]*"[^>]*>/gi, "")
    .replace(/<meta\s+name="twitter:[^"]*"[^>]*>/gi, "")
    .replace(/<\/head>/i, `${tags}\n  </head>`);

  const headers = new Headers(res.headers);
  // the page is re-checked every visit (like the shell, see public/_headers): a cached copy could point at the
  // previous deploy's files; and its own ETag (the shell's) must not answer "not changed" for a page that did
  headers.set("Cache-Control", "public, max-age=0, must-revalidate");
  headers.delete("ETag");
  headers.delete("Last-Modified");
  return new Response(html, { status: 200, headers });
}

/* The shell, asked plainly: without the browser's If-None-Match / If-Modified-Since (the shell's "not changed"
   would answer for this page, which did change). */
function fresh(request) {
  const h = new Headers(request.headers);
  h.delete("If-None-Match");
  h.delete("If-Modified-Since");
  return new Request(request.url, { method: "GET", headers: h });
}
