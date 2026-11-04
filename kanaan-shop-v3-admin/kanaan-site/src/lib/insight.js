/* What a visit does, for the shop's own program (Kanaan POS → Website → Visitors).

   Anonymous: the visitor is a random number kept on this device (nothing personal: no name, no phone, no
   cookies). A visit ends after 30 minutes without anything happening. The steps are sent together, a batch at a
   time (sooner for the bag and the order, so the shop sees them live), and never slow the page or break it.
   The shop's own phones (they opened Kanaan POS here) are not counted. */

const VKEY = "kanaan-vid";
const SKEY = "kanaan-visit";
const STAFF = "kanaan-staff";
const IDLE = 30 * 60000;
const URGENT = new Set(["add", "remove", "qty", "like", "unlike", "checkout", "order", "cart_open", "wa", "promo"]);
const MAX_BATCHES = 150;

const store = {
  get(k) { try { return localStorage.getItem(k); } catch { return null; } },
  set(k, v) { try { localStorage.setItem(k, v); } catch { /* private mode: this visit only */ } },
};
const rid = () => {
  let s = "";
  try { const a = new Uint8Array(12); crypto.getRandomValues(a); s = [...a].map((b) => b.toString(36).padStart(2, "0")).join(""); } catch { /* old browser */ }
  return (s || (Math.random().toString(36).slice(2) + Date.now().toString(36))).replace(/[^a-z0-9]/g, "").slice(0, 20).padEnd(10, "0");
};

let cfg = null; // { base, app }
let off = false;
let me = null; // { vid, nv }
let visit = null; // { sid, b, at, nv, sent }
let queue = [];
let cartSnap; // the bag now, to send with the next batch (undefined: nothing new)
let timer = null; let due = 0;
let lastSend = 0;
let inflight = null; // a batch that failed to send, sent again first
// the page being looked at: its time (only while the page is on screen and someone is using it) and how far down
let page = null; // { p, id, ms, scroll }
let lastInput = 0; let tickAt = 0;

function isStaff() {
  try {
    const q = new URLSearchParams(window.location.search).get("kanaan-staff");
    if (q === "1") store.set(STAFF, "1");
    if (q === "0") { try { localStorage.removeItem(STAFF); } catch { /* fine */ } }
  } catch { /* fine */ }
  return store.get(STAFF) === "1";
}

function ensureVisit(now) {
  if (!me) {
    let vid = store.get(VKEY);
    let nv = 0;
    if (!vid || !/^[a-z0-9]{8,32}$/.test(vid)) { vid = rid(); nv = 1; store.set(VKEY, vid); }
    me = { vid, nv };
  }
  if (!visit) { try { visit = JSON.parse(store.get(SKEY) || "null"); } catch { visit = null; } }
  if (!visit || !visit.sid || now - (visit.at || 0) > IDLE) {
    visit = { sid: rid(), b: 0, at: now, nv: me.nv, sent: 0 };
    me.nv = 0;
  }
  visit.at = now;
  store.set(SKEY, JSON.stringify(visit));
}

function schedule(ms) {
  const at = Date.now() + ms;
  if (timer && due <= at) return;
  if (timer) clearTimeout(timer);
  due = at;
  timer = setTimeout(() => { timer = null; flush(false); }, ms);
}

function payload(now) {
  const evs = queue.splice(0, 60);
  visit.b += 1;
  const body = { v: me.vid, s: visit.sid, b: visit.b, nv: visit.nv ? 1 : 0, now, e: evs };
  if (visit.b === 1) {
    let ref = ""; let utm = "";
    try { ref = document.referrer || ""; const q = new URLSearchParams(window.location.search); utm = q.get("utm_source") || q.get("ref") || q.get("src") || ""; } catch { /* fine */ }
    body.info = { landing: window.location.pathname + window.location.search, ref, utm, w: window.innerWidth || 0, lang: (navigator.language || "").slice(0, 12), app: cfg.app ? 1 : 0 };
  }
  if (cartSnap !== undefined) { body.cart = cartSnap; cartSnap = undefined; }
  store.set(SKEY, JSON.stringify(visit));
  return body;
}

function send(body, leaving) {
  const url = `${cfg.base}/api/ev`;
  const text = JSON.stringify(body);
  try {
    if (leaving && !cfg.app && navigator.sendBeacon && navigator.sendBeacon(url, new Blob([text], { type: "text/plain" }))) return;
    fetch(url, { method: "POST", body: text, keepalive: text.length < 60000, headers: { "Content-Type": "text/plain" } })
      .then((r) => { if (!r.ok && r.status >= 500) inflight = body; })
      .catch(() => { inflight = body; }); // offline for a moment: sent again with the next batch (the same number: counted once)
  } catch { /* never break the shop */ }
}

/** Send what is waiting (leaving: the page is going away or out of sight). */
export function flush(leaving) {
  if (off || !cfg) return;
  if (timer) { clearTimeout(timer); timer = null; }
  if (inflight) { const again = inflight; inflight = null; send(again, leaving); }
  if (!queue.length && cartSnap === undefined) return;
  if (!visit || visit.sent >= MAX_BATCHES) { queue = []; return; }
  const now = Date.now();
  ensureVisit(now);
  visit.sent += 1;
  lastSend = now;
  send(payload(now), leaving);
  if (queue.length) schedule(4000);
}

function push(k, d = {}) {
  if (off || !cfg) return;
  const now = Date.now();
  ensureVisit(now);
  const e = { t: now, k, p: (page && page.p) || (window.location.pathname + window.location.search) };
  if (d.id) e.id = String(d.id); if (d.c) e.c = String(d.c); if (d.s) e.s = String(d.s);
  if (d.q != null) e.q = Math.round(Number(d.q) || 0); if (d.v != null) e.v = Math.round(Number(d.v) || 0); if (d.x != null && d.x !== "") e.x = String(d.x).slice(0, 80);
  queue.push(e);
  if (queue.length >= 50) { flush(false); return; }
  const first = visit.b === 0 && visit.sent === 0;
  if (first) schedule(2500);
  else if (URGENT.has(k)) schedule(Math.max(1200, lastSend + 5000 - now));
  else schedule(25000);
}

/** The time on the page so far (and how far down it went) as one step; the count starts again. */
function closeTime() {
  if (!page) return;
  tick();
  if (page.ms >= 800) push("time", { id: page.id, v: page.ms, q: page.scroll });
  page.ms = 0;
}
function tick() {
  const now = Date.now();
  const dt = Math.min(now - tickAt, 5000);
  tickAt = now;
  if (!page || document.visibilityState === "hidden") return;
  if (now - lastInput < 45000) page.ms += dt;
}
function onScroll() {
  lastInput = Date.now();
  if (!page) return;
  try {
    const h = document.documentElement.scrollHeight - window.innerHeight;
    const pct = h > 40 ? Math.round(((window.scrollY || 0) / h) * 100) : 100;
    if (pct > page.scroll) page.scroll = Math.min(100, pct);
  } catch { /* fine */ }
}

/** Start counting (once, when the shop opens). */
export function startInsight({ base = "", app = false } = {}) {
  if (cfg) return;
  cfg = { base, app };
  try {
    const path = window.location.pathname;
    if (isStaff() || path.startsWith("/admin") || path.startsWith("/pos") || navigator.webdriver && !window.__kanaanInsightTest) { off = true; return; }
  } catch { off = true; return; }
  lastInput = tickAt = Date.now();
  const input = () => { lastInput = Date.now(); };
  for (const ev of ["pointerdown", "keydown", "touchstart", "wheel"]) window.addEventListener(ev, input, { passive: true });
  let moved = 0;
  window.addEventListener("mousemove", () => { const n = Date.now(); if (n - moved > 2000) { moved = n; lastInput = n; } }, { passive: true });
  window.addEventListener("scroll", onScroll, { passive: true });
  setInterval(tick, 1000);
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "hidden") { closeTime(); flush(true); } else { tickAt = Date.now(); lastInput = Date.now(); }
  });
  window.addEventListener("pagehide", () => { closeTime(); flush(true); });
  // WhatsApp taps anywhere in the shop (the help button, the footer, ask about a piece, the order)
  document.addEventListener("click", (e) => {
    const a = e.target && e.target.closest ? e.target.closest('a[href*="wa.me"], a[href*="whatsapp"]') : null;
    if (a) push("wa", { x: a.getAttribute("data-wa") || (page && page.p && page.p.startsWith("/product/") ? "piece" : page && page.p === "/checkout" ? "order" : "help"), id: page && page.id });
  }, true);
}

/** A page seen (path; id: the piece on a product page). The time on the one before is closed first. */
export function insightView(path, id = "") {
  if (off || !cfg) return;
  if (page && page.p === path) return;
  closeTime();
  page = { p: path, id: id || "", ms: 0, scroll: 0 };
  lastInput = Date.now();
  push("view", { id });
  setTimeout(onScroll, 400);
}
/** The piece on a product page is known only once the catalog has loaded. */
export function insightPiece(id) { if (page && !page.id) page.id = id || ""; }

/** One step: k = add | remove | qty | like | unlike | color | size_open | size | guide | photo | search | filter | share | checkout | order | promo …
 *  d = { id: piece, c: colour, s: size, q: quantity / change, v: value (whole $ / results / ms), x: a word } */
export function insight(k, d) { push(k, d); }

/** The bag as it is now: [{ productId, colorKey, size, qty, price }] — the shop sees open bags live. */
export function insightCart(items) {
  if (off || !cfg) return;
  const snap = (items || []).map((i) => [i.productId, i.colorKey || "", i.size || "", Number(i.qty) || 1, Math.round(Number(i.price) || 0)]);
  const key = JSON.stringify(snap);
  if (key === insightCart.last) return;
  const first = insightCart.last === undefined;
  insightCart.last = key;
  if (first && !snap.length) return; // an empty bag at the start says nothing
  cartSnap = snap;
  ensureVisit(Date.now());
  schedule(first ? 2500 : Math.max(1200, lastSend + 5000 - Date.now()));
}
