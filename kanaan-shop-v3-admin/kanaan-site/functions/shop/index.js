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
    res = await next();
  } catch {
    return new Response("Not found", { status: 404 });
  }

  const ct = res.headers.get("Content-Type") || "";
  if (!ct.includes("text/html")) return res;

  let count = 0;
  try {
    const row = await env.DB.prepare("SELECT COUNT(*) AS n FROM products WHERE active = 1 AND sold_out = 0").first();
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
  headers.set("Cache-Control", "public, max-age=300");
  return new Response(html, { status: 200, headers });
}
