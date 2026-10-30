/* ============================================================
   THE WEBSITE'S SETTINGS — set from Kanaan POS (Website → Site)
   ------------------------------------------------------------
   The bar at the top of every page, delivery (the fee, free from an
   amount), the exchange window, the shop's opening hours. They come
   with the products (/api/products → settings) and are kept for the
   next visit, so the page never waits for them.
   ============================================================ */
import { useEffect, useState } from "react";

const KEY = "kanaan-site";
export const DEFAULT_SETTINGS = { announce: null, deliveryFee: 5, freeOver: 0, exchangeDays: 3, hours: null };

function load() {
  try {
    const s = JSON.parse(localStorage.getItem(KEY) || "null");
    return s && typeof s === "object" ? { ...DEFAULT_SETTINGS, ...s } : DEFAULT_SETTINGS;
  } catch {
    return DEFAULT_SETTINGS;
  }
}

let current = typeof window === "undefined" ? DEFAULT_SETTINGS : load();
const subs = new Set();

export function applySettings(s) {
  if (!s || typeof s !== "object") return;
  current = { ...DEFAULT_SETTINGS, ...s };
  try { localStorage.setItem(KEY, JSON.stringify(current)); } catch { /* private mode */ }
  subs.forEach((fn) => fn(current));
}

export const getSettings = () => current;

export function useSiteSettings() {
  const [s, set] = useState(current);
  useEffect(() => {
    subs.add(set);
    set(current);
    return () => { subs.delete(set); };
  }, []);
  return s;
}

/** What delivery costs for this many dollars of pieces. */
export function deliveryFor(s, subtotal) {
  return s.freeOver > 0 && subtotal >= s.freeOver ? 0 : s.deliveryFee;
}
