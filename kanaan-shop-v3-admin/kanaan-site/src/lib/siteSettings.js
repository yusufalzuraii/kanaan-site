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
export const DEFAULT_SETTINGS = { announce: null, deliveryFee: 5, freeOver: 0, exchangeDays: 3, hours: null, welcome: null };

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

/* ---------- the welcome offer: N% off a first website order ----------
   Worked out by the server when the order is placed (by phone number); the
   pages say it while it is on, and stop saying it on a device that ordered. */
const ORDERED = "kanaan-ordered";
export function orderedHere() { try { return localStorage.getItem(ORDERED) === "1"; } catch { return false; } }
export function markOrdered() {
  try { localStorage.setItem(ORDERED, "1"); } catch { /* private mode */ }
  current = { ...current };
  subs.forEach((fn) => fn(current));
}
/** The welcome offer when it is on now (and this device hasn't ordered yet, unless `any`), else null. */
export function welcomeNow(s, { any = false, now = Date.now() } = {}) {
  const w = s && s.welcome;
  if (!w || !(w.pct > 0) || (w.until && w.until <= now)) return null;
  if (!any && orderedHere()) return null;
  return w;
}
/** Is this piece one the welcome offer is on (pieces with their own offer are left out, unless the shop said so)? */
export const welcomeFits = (w, onSale) => !!w && (w.sale || !onSale);
/** The same sum as the server: pct of the pieces it is on, to the nearest dollar, from the minimum. lines: [{ price, qty, onSale }] */
export function welcomeOn(w, lines) {
  if (!w) return null;
  const subtotal = lines.reduce((a, l) => a + l.price * l.qty, 0);
  if (w.min && subtotal < w.min) return { pct: w.pct, discount: 0, short: w.min - subtotal };
  const eligible = lines.reduce((a, l) => a + (welcomeFits(w, l.onSale) ? l.price * l.qty : 0), 0);
  const discount = Math.round((eligible * w.pct) / 100);
  return { pct: w.pct, discount, eligible, short: 0 };
}
/** The offer in a few words, the shop's own when it wrote some. */
export function welcomeWords(w) {
  if (!w) return "";
  if (w.text) return w.text;
  return `${w.pct}% off your first order${w.min ? ` from $${w.min}` : ""} — taken off at checkout`;
}
