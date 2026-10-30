/* ============================================================
   THE WEBSITE'S SETTINGS — set from Kanaan POS (Website → Site)
   ------------------------------------------------------------
   The bar at the top of every page, delivery (the fee, free delivery
   from an amount), the exchange window the site promises, and the
   shop's opening hours ("Open now · until 10 pm"). One JSON row in
   app_config ('site_settings'); the storefront gets the public part
   with the products (one request, always in step).
   ============================================================ */

export const DEFAULTS = { announce: null, deliveryFee: 5, freeOver: 0, exchangeDays: 3, hours: null };
const TONES = ["coral", "teal", "ink"];
const int = (v, lo, hi, d) => { const n = Math.round(Number(v)); return Number.isFinite(n) ? Math.min(hi, Math.max(lo, n)) : d; };
const TIME = /^([01]\d|2[0-3]):[0-5]\d$/;

/** A link the bar or a notification may open: a page of this site, or nothing. */
export function cleanLink(v) {
  const s = String(v || "").trim().slice(0, 200);
  if (!s) return "";
  if (/^\/(?!\/)[A-Za-z0-9\-._~/?=&%]*$/.test(s)) return s;
  return "";
}

/** Whatever was sent → a valid settings object (unknown keys dropped, numbers in range). */
export function clean(input) {
  const s = { ...DEFAULTS, ...(input && typeof input === "object" ? input : {}) };
  let announce = null;
  if (s.announce && typeof s.announce === "object") {
    const text = String(s.announce.text || "").replace(/\s+/g, " ").trim().slice(0, 90);
    if (text) {
      announce = {
        on: !!s.announce.on,
        text,
        link: cleanLink(s.announce.link),
        tone: TONES.includes(s.announce.tone) ? s.announce.tone : "coral",
        until: Math.max(0, Math.round(Number(s.announce.until) || 0)),
        id: String(s.announce.id || "").slice(0, 24),
      };
    }
  }
  let hours = null;
  if (s.hours && Array.isArray(s.hours.days) && s.hours.days.length === 7) {
    const days = s.hours.days.map((d) => (Array.isArray(d) && TIME.test(String(d[0])) && TIME.test(String(d[1])) && d[0] < d[1] ? [String(d[0]), String(d[1])] : null));
    if (days.some(Boolean)) hours = { days };
  }
  return {
    announce,
    deliveryFee: int(s.deliveryFee, 0, 50, DEFAULTS.deliveryFee),
    freeOver: int(s.freeOver, 0, 2000, 0),
    exchangeDays: int(s.exchangeDays, 0, 60, DEFAULTS.exchangeDays),
    hours,
  };
}

export async function loadSettings(env) {
  let row = null;
  try { row = await env.DB.prepare("SELECT value FROM app_config WHERE key = 'site_settings'").first(); } catch { row = null; }
  let s = {};
  try { s = row ? JSON.parse(row.value) : {}; } catch { s = {}; }
  return clean(s);
}

export async function saveSettings(env, patch) {
  const cur = await loadSettings(env);
  const next = { ...cur };
  for (const k of ["deliveryFee", "freeOver", "exchangeDays", "hours"]) if (patch && k in patch) next[k] = patch[k];
  if (patch && "announce" in patch) {
    const a = patch.announce;
    // a new message (other words) gets a new id: shoppers who closed the old one see it
    const sameWords = a && cur.announce && String(a.text || "").trim() === cur.announce.text;
    next.announce = a ? { ...a, id: sameWords ? cur.announce.id : Date.now().toString(36) } : null;
  }
  const out = clean(next);
  await env.DB.prepare("INSERT INTO app_config (key, value) VALUES ('site_settings', ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value").bind(JSON.stringify(out)).run();
  return out;
}

/** What every visitor gets: the bar only while it is on and not past its end. */
export function publicSettings(s, now = Date.now()) {
  const a = s.announce;
  const announce = a && a.on && a.text && (!a.until || a.until > now) ? { text: a.text, link: a.link, tone: a.tone, id: a.id } : null;
  return { announce, deliveryFee: s.deliveryFee, freeOver: s.freeOver, exchangeDays: s.exchangeDays, hours: s.hours };
}

/** The delivery an order pays, by these settings. */
export function deliveryFor(s, subtotal) {
  return s.freeOver > 0 && subtotal >= s.freeOver ? 0 : s.deliveryFee;
}
