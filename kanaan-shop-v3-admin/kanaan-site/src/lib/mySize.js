/* ============================================================
   THE SHOPPER'S OWN SIZES — kept on this device, nothing leaves it
   ------------------------------------------------------------
   One size per way of sizing: tops and everything sized S–XXL,
   waists (28–38), feet (40–45). Learnt from what goes into the bag,
   never chosen for the shopper: the product page marks it ("you
   usually take L"), the shop can show only what's left in it.
   ============================================================ */
import { useEffect, useState } from "react";

const KEY = "kanaan-my-size";
const FEET = /shoe|slipper|sandal|sneaker|boot|loafer|صباب|حذ/i;
const ONE = /^(one ?size|os|free ?size|standard|universal|o\/s)$/i;

let mine = null;
const subs = new Set();

function read() {
  if (mine) return mine;
  try {
    const v = JSON.parse(localStorage.getItem(KEY) || "{}");
    mine = v && typeof v === "object" && !Array.isArray(v) ? v : {};
  } catch {
    mine = {};
  }
  return mine;
}

/* "2XL" and "XXL" are the same size; "m" is "M". */
export function sizeNorm(size) {
  let s = String(size == null ? "" : size).trim().toUpperCase().replace(/\s+/g, "");
  const n = s.match(/^(\d)XL$/);
  if (n) s = `${"X".repeat(Number(n[1]))}L`;
  return s;
}

/* Which way a piece is sized: "feet", "waist", "top" — or null for one size. */
export function sizeKind(product, size) {
  const s = String(size == null ? "" : size).trim();
  if (!s || ONE.test(s)) return null;
  if (FEET.test(String((product && product.category) || ""))) return "feet";
  if (/^\d{2}(\.5)?$/.test(s)) return "waist";
  return "top";
}

/* Called when a piece goes into the bag. */
export function rememberSize(product, size) {
  const kind = sizeKind(product, size);
  if (!kind) return;
  const next = { ...read(), [kind]: String(size).trim() };
  mine = next;
  try { localStorage.setItem(KEY, JSON.stringify(next)); } catch { /* private mode: kept for this visit */ }
  subs.forEach((fn) => fn(next));
}

/* The shopper's size for this piece, spelt the way the piece spells it — or null. */
export function mySizeFor(product, sizes = read()) {
  if (!product || !Array.isArray(product.sizes)) return null;
  for (const s of product.sizes) {
    const kind = sizeKind(product, s);
    if (kind && sizes[kind] && sizeNorm(sizes[kind]) === sizeNorm(s)) return s;
  }
  return null;
}

export function useMySizes() {
  const [v, set] = useState(read);
  useEffect(() => {
    subs.add(set);
    set(read());
    return () => { subs.delete(set); };
  }, []);
  return v;
}

/* Sizes in the order people read them: XS S M L XL XXL…, then numbers, then the rest. */
const LETTERS = ["XXS", "XS", "S", "M", "L", "XL", "XXL", "XXXL", "XXXXL"];
export function sizeOrder(a, b) {
  const A = sizeNorm(a), B = sizeNorm(b);
  const ia = LETTERS.indexOf(A), ib = LETTERS.indexOf(B);
  if (ia >= 0 || ib >= 0) return (ia < 0 ? 99 : ia) - (ib < 0 ? 99 : ib);
  const na = parseFloat(A), nb = parseFloat(B);
  if (!Number.isNaN(na) || !Number.isNaN(nb)) return (Number.isNaN(na) ? 1e9 : na) - (Number.isNaN(nb) ? 1e9 : nb);
  return A.localeCompare(B);
}
