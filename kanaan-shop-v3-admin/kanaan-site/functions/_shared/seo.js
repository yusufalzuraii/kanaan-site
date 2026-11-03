/* What the server-rendered pages share for search engines: how many
   pieces each category (and fit) has online right now, and the links
   between the listings. A category with nothing online is left out of the
   links and the sitemap: an empty page in Google is worse than none. */
import { loadCategories } from "./site.js";
import { parseImages } from "./util.js";
import { absoluteUrl } from "./ssr.js";

const ONLINE = "active = 1 AND app_exclusive = 0";

/** { counts: { [cat]: n }, subCounts: { "cat/sub": n }, total, onSale } — pieces online and not sold out */
export async function catalogCounts(env) {
  const out = { counts: {}, subCounts: {}, total: 0, onSale: 0 };
  try {
    const rows = (await env.DB.prepare(`SELECT category, subcategory, badge, COUNT(*) AS n FROM products WHERE ${ONLINE} AND sold_out = 0 GROUP BY category, subcategory, badge`).all()).results || [];
    for (const r of rows) {
      const n = Number(r.n) || 0;
      out.counts[r.category] = (out.counts[r.category] || 0) + n;
      if (r.subcategory) out.subCounts[`${r.category}/${r.subcategory}`] = (out.subCounts[`${r.category}/${r.subcategory}`] || 0) + n;
      if (r.badge === "sale") out.onSale += n;
      out.total += n;
    }
  } catch { /* no numbers: the links just go without them */ }
  return out;
}

/** The shop's categories that have pieces online, as links (most-stocked order is the owner's own order). */
export function categoryLinks(cats, counts, origin) {
  return cats.list
    .filter((c) => c.active && counts.counts[c.id] > 0)
    .map((c) => ({ id: c.id, href: `${origin}/shop/${c.id}`, label: c.label, count: counts.counts[c.id] }));
}

/** A category's fits that have pieces online, as links. */
export function subLinks(cats, counts, category, origin) {
  return (cats.subs[category] || [])
    .filter((s) => counts.subCounts[`${category}/${s.id}`] > 0)
    .map((s) => ({ id: s.id, href: `${origin}/shop/${category}/${s.id}`, label: s.label, count: counts.subCounts[`${category}/${s.id}`] }));
}

/** "jeans, jackets, sweatshirts and hoodies" — the biggest categories, for a description */
export function categoryWords(links, n = 5) {
  const words = [...links].sort((a, b) => b.count - a.count).slice(0, n).map((l) => l.label.toLowerCase());
  return words.length <= 1 ? words.join("") : `${words.slice(0, -1).join(", ")} and ${words[words.length - 1]}`;
}

/** Rows → the cards a listing shows (price after any sale, absolute photo) */
export function cardsFrom(rows, origin) {
  return rows.map((r) => {
    const price = Math.round(Number(r.price) || 0);
    const discount = r.badge === "sale" ? Number(r.discount) || 0 : 0;
    const img = parseImages(r.images)[0]?.url || "";
    return { id: r.id, name: r.name, price, discount, finalPrice: discount > 0 ? Math.round(price * (1 - discount / 100)) : price, image: absoluteUrl(origin, img) };
  });
}

/** An ItemList of a listing's pieces */
export function itemList(name, cards, origin) {
  return {
    "@context": "https://schema.org",
    "@type": "ItemList",
    name,
    numberOfItems: cards.length,
    itemListElement: cards.slice(0, 24).map((p, i) => ({
      "@type": "ListItem",
      position: i + 1,
      url: `${origin}/product/${p.id}`,
      name: p.name,
      image: p.image || undefined,
    })),
  };
}

export { loadCategories, ONLINE };
