/* ============================================================
   COMPLETE THE LOOK — what to wear a piece with
   ------------------------------------------------------------
   A tee goes with jeans and shoes, jeans with a shirt and shoes, a
   jacket over both. Every piece gets a family from its category (the
   owner's categories in Kanaan POS, matched by their words) or, when
   the category says nothing (an "Old Money" edit), from its name.
   For each family that completes it, the best piece still in stock:
   one that shares a colour or is a colour that goes with anything,
   then the shop's own order. Same answer every time — nothing random.
   ============================================================ */

const FAMILIES = [
  ["outer", /jacket|coat|puffer|parka|bomber|blazer|gilet|overshirt|cardigan|جاك|معطف/i],
  ["feet", /shoe|sneaker|boot|loafer|slipper|sandal|صباب|حذ/i],
  ["bottom", /jean|pant|trouser|chino|cargo|jogger|\bshorts\b|denim|بنطل|بناطل|شورت/i],
  ["set", /\bsets?\b|tracksuit|co-?ord/i],
  ["extra", /accessor|belt|\bcap\b|\bhat\b|\bbag\b|wallet|sock|watch|scarf|underwear|boxer|sunglass/i],
  ["top", /shirt|\btee\b|polo|knit|sweater|pullover|jumper|hood|sweat|tank|\btop\b|كنز|قميص|تيشيرت|هود/i],
];

const GOES_WITH = {
  top: ["bottom", "feet", "outer"],
  outer: ["top", "bottom", "feet"],
  bottom: ["top", "feet", "outer"],
  feet: ["bottom", "top", "outer"],
  set: ["feet", "extra", "outer"],
  extra: ["top", "bottom", "feet"],
};

// colours that sit with anything
const NEUTRAL = /black|white|grey|gray|charcoal|navy|beige|cream|ecru|stone|sand|khaki|denim|indigo|camel|taupe|off-?white/i;

function familyOf(product, categoryLabel) {
  const cat = `${product.category || ""} ${categoryLabel || ""}`;
  for (const [f, re] of FAMILIES) if (re.test(cat)) return f;
  const name = String(product.name || "");
  for (const [f, re] of FAMILIES) if (re.test(name)) return f;
  return null;
}

/* product: the piece being looked at; products: the shop, in its own order;
   labelOf(categoryId) → the category's name; inStock(p) → true when it can be bought. */
export function completeTheLook(product, products, labelOf, inStock, max = 3) {
  const fam = familyOf(product, labelOf(product.category));
  if (!fam) return [];
  const wanted = GOES_WITH[fam] || [];
  const mine = new Set((product.colors || []).map((c) => String(c).toLowerCase()));
  const byFamily = {};
  products.forEach((p, i) => {
    if (p.id === product.id || !inStock(p)) return;
    const f = familyOf(p, labelOf(p.category));
    if (!f || f === fam || !wanted.includes(f)) return;
    const colors = (p.colors || []).map((c) => String(c).toLowerCase());
    const shared = colors.some((c) => mine.has(c));
    const neutral = colors.some((c) => NEUTRAL.test(c));
    const sameEdit = p.category === product.category ? 1 : 0; // e.g. two Old Money pieces
    const score = sameEdit * 4 + (shared ? 3 : 0) + (neutral ? 2 : 0) - i / 1000;
    (byFamily[f] = byFamily[f] || []).push({ p, score });
  });
  for (const f of Object.keys(byFamily)) byFamily[f].sort((a, b) => b.score - a.score);
  // one from each family that completes it, then the next best of each
  const out = [];
  for (let round = 0; out.length < max && round < 3; round++) {
    for (const f of wanted) {
      const pick = byFamily[f] && byFamily[f][round];
      if (pick && out.length < max) out.push(pick.p);
    }
  }
  return out;
}
