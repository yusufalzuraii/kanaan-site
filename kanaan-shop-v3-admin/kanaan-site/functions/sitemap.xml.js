/* GET /sitemap.xml
   ------------------------------------------------------------
   Replaces the old static file. A hand-written sitemap goes stale the
   moment a product is added or removed — this one is generated fresh
   from the live catalogue on every request, so it's never wrong and
   never needs updating by hand.

   Includes the <image:image> extension so product photos can be found
   through Google Image Search too, not just the page itself. */

import { CATEGORY_IDS, subcategoriesFor } from "./_shared/util.js";

const esc = (s) =>
  String(s == null ? "" : s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");

function isoDate(ms) {
  try { return new Date(ms).toISOString().slice(0, 10); } catch { return null; }
}

export async function onRequestGet(context) {
  const { env } = context;
  const origin = "https://kanaanshop.com";
  const urls = [];

  const add = (loc, opts = {}) => urls.push({ loc, ...opts });

  add(`${origin}/`, { priority: "1.0", changefreq: "daily" });
  add(`${origin}/shop`, { priority: "0.9", changefreq: "daily" });
  add(`${origin}/sale`, { priority: "0.8", changefreq: "daily" });

  for (const cat of CATEGORY_IDS) {
    add(`${origin}/shop/${cat}`, { priority: "0.7", changefreq: "daily" });
    for (const sub of subcategoriesFor(cat)) {
      add(`${origin}/shop/${cat}/${sub.id}`, { priority: "0.6", changefreq: "daily" });
    }
  }

  try {
    const { results } = await env.DB.prepare(
      "SELECT id, images, created_at FROM products WHERE active = 1"
    ).all();
    for (const row of results || []) {
      let images = [];
      try {
        const parsed = JSON.parse(row.images || "[]");
        images = Array.isArray(parsed)
          ? parsed.map((x) => (typeof x === "string" ? x : x.url)).filter(Boolean)
          : String(row.images || "").split(",").map((s) => s.trim()).filter(Boolean);
      } catch {
        images = String(row.images || "").split(",").map((s) => s.trim()).filter(Boolean);
      }
      const absImages = images.map((u) => (/^https?:\/\//i.test(u) ? u : `${origin}${u.startsWith("/") ? "" : "/"}${u}`));
      add(`${origin}/product/${row.id}`, {
        priority: "0.6",
        changefreq: "weekly",
        lastmod: isoDate(row.created_at),
        images: absImages,
      });
    }
  } catch { /* if the products table isn't reachable, the static routes above still work */ }

  const body = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:image="http://www.google.com/schemas/sitemap-image/1.1">
${urls.map((u) => {
  const parts = [`  <url>`, `    <loc>${esc(u.loc)}</loc>`];
  if (u.lastmod) parts.push(`    <lastmod>${u.lastmod}</lastmod>`);
  if (u.changefreq) parts.push(`    <changefreq>${u.changefreq}</changefreq>`);
  if (u.priority) parts.push(`    <priority>${u.priority}</priority>`);
  for (const img of u.images || []) {
    parts.push(`    <image:image><image:loc>${esc(img)}</image:loc></image:image>`);
  }
  parts.push(`  </url>`);
  return parts.join("\n");
}).join("\n")}
</urlset>`;

  return new Response(body, {
    headers: { "Content-Type": "application/xml; charset=utf-8", "Cache-Control": "public, max-age=1800" },
  });
}
