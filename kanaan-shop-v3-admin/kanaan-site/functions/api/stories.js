import { json, rowToProduct, parseImages, rowToStorySlide, groupIntoRings } from "../_shared/util.js";

/* GET /api/stories
   ------------------------------------------------------------
   Returns every ring ready to show in "The Edit": Sale and New In are
   computed live from the products table (never stale, never need
   updating by hand); editorial and comparison rings come from the
   `stories` table, already filtered to active and not-expired.
   Empty rings are dropped entirely — no empty tiles on the homepage. */

const money = (n) => `$${Math.round(n)}`;

export async function onRequestGet(context) {
  const { env } = context;
  const rings = [];

  try {
    const { results } = await env.DB.prepare(
      "SELECT * FROM products WHERE active = 1 ORDER BY created_at DESC"
    ).all();
    const products = (results || []).map(rowToProduct);

    // ---- Auto: On Sale (deepest discount first) ----
    const onSale = products
      .filter((p) => p.discount > 0 && Math.round(p.price * (1 - p.discount / 100)) < p.price)
      .filter((p) => p.images.length > 0) // a full-screen story needs a real photo
      .sort((a, b) => b.discount - a.discount)
      .slice(0, 10);
    if (onSale.length > 0) {
      rings.push({
        id: "auto-sale",
        title: "On Sale",
        kind: "sale",
        slides: onSale.map((p) => {
          const price = Math.round(p.price * (1 - p.discount / 100));
          return {
            id: `sale-${p.id}`, kind: "image", image: p.images[0].url, imageB: "", labelA: "", labelB: "",
            caption: `${p.name} · ${money(price)} (was ${money(p.price)})`,
            ctaCategory: "", ctaSubcategory: "",
            tags: [{ productId: p.id, x: 50, y: 88 }],
          };
        }),
      });
    }

    // ---- Auto: New In (most recently added) ----
    const newIn = products.filter((p) => p.images.length > 0).slice(0, 8);
    if (newIn.length > 0) {
      rings.push({
        id: "auto-new",
        title: "New In",
        kind: "new",
        slides: newIn.map((p) => ({
          id: `new-${p.id}`, kind: "image", image: p.images[0].url, imageB: "", labelA: "", labelB: "",
          caption: `${p.name} · ${money(Math.round(p.price * (1 - (p.discount || 0) / 100)))}`,
          ctaCategory: "", ctaSubcategory: "",
          tags: [{ productId: p.id, x: 50, y: 88 }],
        })),
      });
    }
  } catch { /* products table issue shouldn't take down editorial rings below */ }

  // ---- Editorial + Compare rings from the stories table ----
  try {
    const now = Date.now();
    const { results } = await env.DB.prepare(
      "SELECT * FROM stories WHERE active = 1 AND (expires_at IS NULL OR expires_at > ?) ORDER BY created_at ASC, sort_order ASC"
    ).bind(now).all();
    const slides = (results || []).map(rowToStorySlide);
    for (const ring of groupIntoRings(slides)) {
      rings.push({
        id: ring.id,
        title: ring.title || "The Edit",
        kind: ring.kind, // 'editorial' | 'compare'
        slides: ring.slides.map((s) => ({
          id: s.id, kind: s.kind, image: s.image, imageB: s.imageB, labelA: s.labelA, labelB: s.labelB,
          caption: s.caption, ctaCategory: s.ctaCategory, ctaSubcategory: s.ctaSubcategory, tags: s.tags,
        })),
      });
    }
  } catch { /* if the stories table isn't migrated yet, auto rings still work */ }

  return json({ rings }, 200, { "Cache-Control": "no-store" });
}
