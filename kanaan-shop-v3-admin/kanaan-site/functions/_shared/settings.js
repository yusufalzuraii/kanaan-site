/* ============================================================
   THE WEBSITE'S SETTINGS — set from Kanaan POS (Website → Site)
   ------------------------------------------------------------
   The bar at the top of every page, delivery (the fee, free delivery
   from an amount), the exchange window the site promises, and the
   shop's opening hours ("Open now · until 10 pm"), and the welcome offer
   (a first website order gets N% off — on by the shop's switch, with its
   own line in the bar and on the pages), and Whish Money at checkout (the shop's
   switch — it shows only once the keys are in Cloudflare too). One JSON row in
   app_config ('site_settings'); the storefront gets the public part
   with the products (one request, always in step).
   ============================================================ */

export const DEFAULTS = { announce: null, deliveryFee: 5, freeOver: 0, exchangeDays: 3, hours: null, welcome: null, shut: null, whish: null };
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
  // the welcome offer: N% off a first website order (by phone number), on the pieces without their own offer
  let welcome = null;
  if (s.welcome && typeof s.welcome === "object") {
    const w = s.welcome;
    welcome = {
      on: !!w.on,
      pct: int(w.pct, 1, 50, 10),
      min: int(w.min, 0, 5000, 0), // from an order of $min (0: any order)
      until: Math.max(0, Math.round(Number(w.until) || 0)), // ends by itself then (0: until it is switched off)
      sale: !!w.sale, // also on pieces that already have an offer
      bar: w.bar !== false, // said in the bar at the top of the site
      text: String(w.text || "").replace(/\s+/g, " ").trim().slice(0, 90), // the shop's own words for it (else the site's)
      since: Math.max(0, Math.round(Number(w.since) || 0)), // switched on at
    };
  }
  // the website shut by hand (Kanaan POS → Website → Site → The website): the shutter stays down until it is opened
  let shut = null;
  if (s.shut && typeof s.shut === "object" && s.shut.on) {
    const sh = s.shut;
    shut = {
      on: true,
      words: String(sh.words || "SOON").toUpperCase().replace(/[^A-Z ]/g, "").replace(/\s+/g, " ").trim().slice(0, 8) || "SOON", // lit in the shutter's holes
      title: String(sh.title || "").replace(/\s+/g, " ").trim().slice(0, 60),
      text: String(sh.text || "").replace(/\s+/g, " ").trim().slice(0, 160),
      since: Math.max(0, Math.round(Number(sh.since) || 0)),
    };
  }
  // Whish Money at checkout (functions/_shared/whish.js): on by the shop's switch
  const whish = s.whish && typeof s.whish === "object" && s.whish.on ? { on: true, since: Math.max(0, Math.round(Number(s.whish.since) || 0)) } : null;
  return {
    announce,
    welcome,
    shut,
    whish,
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
  if (patch && "shut" in patch) {
    const sh = patch.shut;
    next.shut = sh && sh.on ? { ...sh, since: cur.shut && cur.shut.on ? cur.shut.since : Date.now() } : null;
  }
  if (patch && "whish" in patch) {
    const w = patch.whish;
    next.whish = w && w.on ? { on: true, since: cur.whish && cur.whish.on ? cur.whish.since : Date.now() } : null;
  }
  if (patch && "welcome" in patch) {
    const w = patch.welcome;
    const wasOn = !!(cur.welcome && cur.welcome.on && (!cur.welcome.until || cur.welcome.until > Date.now()));
    next.welcome = w ? { ...w, since: w.on && !wasOn ? Date.now() : (cur.welcome && cur.welcome.since) || (w.on ? Date.now() : 0) } : null;
  }
  const out = clean(next);
  await env.DB.prepare("INSERT INTO app_config (key, value) VALUES ('site_settings', ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value").bind(JSON.stringify(out)).run();
  return out;
}

/** What every visitor gets: the bar only while it is on and not past its end. Whish at checkout: env (the keys) too. */
export function publicSettings(s, now = Date.now(), env = null) {
  const a = s.announce;
  const announce = a && a.on && a.text && (!a.until || a.until > now) ? { text: a.text, link: a.link, tone: a.tone, id: a.id } : null;
  const welcome = activeWelcome(s, now);
  return {
    announce, deliveryFee: s.deliveryFee, freeOver: s.freeOver, exchangeDays: s.exchangeDays, hours: s.hours,
    welcome: welcome ? { pct: welcome.pct, min: welcome.min, sale: welcome.sale, bar: welcome.bar, text: welcome.text, until: welcome.until } : null,
    shut: s.shut && s.shut.on ? { words: s.shut.words, title: s.shut.title, text: s.shut.text, since: s.shut.since } : null,
    whish: !!(s.whish && s.whish.on && env && env.WHISH_CHANNEL && env.WHISH_SECRET && env.WHISH_WEBSITE_URL),
  };
}

/** The welcome offer if it is on now (switched on, not past its end), else null. */
export function activeWelcome(s, now = Date.now()) {
  const w = s && s.welcome;
  return w && w.on && (!w.until || w.until > now) ? w : null;
}

/**
 * The welcome offer on these lines ([{ price, qty, onSale }], whole dollars): the pieces it is on, their amount,
 * and the discount — pct of that amount, to the nearest dollar — when the order reaches the minimum (by its
 * subtotal, before any discount). { pct, eligible, discount, lines: [indices] } or null when it does not apply.
 */
export function welcomeOn(w, lines) {
  if (!w) return null;
  const subtotal = lines.reduce((a, l) => a + l.price * l.qty, 0);
  if (w.min && subtotal < w.min) return null;
  const idx = lines.map((l, i) => (w.sale || !l.onSale ? i : -1)).filter((i) => i >= 0);
  const eligible = idx.reduce((a, i) => a + lines[i].price * lines[i].qty, 0);
  const discount = Math.round((eligible * w.pct) / 100);
  if (!(discount > 0)) return null;
  return { pct: w.pct, eligible, discount, lines: idx };
}

/** The delivery an order pays, by these settings. */
export function deliveryFor(s, subtotal) {
  return s.freeOver > 0 && subtotal >= s.freeOver ? 0 : s.deliveryFee;
}
