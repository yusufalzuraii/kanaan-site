/* ============================================================
   THE SHUTTER IS DOWN — the winter collection is going up
   ------------------------------------------------------------
   Until OPENS_AT the website shows the shop in Saida with its rolling
   shutter down. The shop is lit inside, and the time left shines
   through the shutter's little holes, like a sign made of light.
   At zero the shutter rolls up by itself, the shop shows through,
   and the site opens — for everyone, with nothing to redeploy.

   The small padlock on the shutter's bottom rail takes the staff
   code: the right one rolls the shutter up on that device and keeps
   it open there. ?shut shows this page again (to look at it).
   A curtain, not a safe: the site's code is public, so this hides the
   shop for a launch; it does not protect anything.

   Not shut: the shop's own phone app (/pos is a separate page), the
   old admin (/admin) and the Android / iPhone apps.
   ============================================================ */
import React, { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { isNativeApp } from "../native.js";

// the moment the doors open (Beirut time): exactly two days after the work was finished
export const OPENS_AT = Date.parse("2026-11-01T15:03:00+02:00");
const KEY = "kanaan-preview";
const WHATSAPP = "96181445681";
// the staff code, not written out as it is
const fits = (s) => { let x = 5381; for (const c of `kanaan:${s}`) x = ((x * 33) ^ c.charCodeAt(0)) >>> 0; return x === 2540877310; };

const reduced = () => { try { return window.matchMedia("(prefers-reduced-motion: reduce)").matches; } catch { return false; } };

/* Decides once, at the start: shut (this page), opening (the shutter going up over the site) or open. */
export function ShopGate({ children }) {
  const [state, setState] = useState(() => {
    try {
      if (isNativeApp) return "open";
      if (window.location.pathname.startsWith("/admin")) return "open";
      const forced = new URLSearchParams(window.location.search).has("shut");
      if (forced) return "shut";
      if (Date.now() >= OPENS_AT) return "open";
      if (localStorage.getItem(KEY) === "1") return "open";
    } catch { /* storage blocked: shut */ }
    return "shut";
  });
  const open = (staff) => {
    if (staff) { try { localStorage.setItem(KEY, "1"); } catch { /* this visit only */ } }
    try {
      const u = new URL(window.location.href);
      if (u.searchParams.has("shut")) { u.searchParams.delete("shut"); window.history.replaceState(window.history.state, "", u.pathname + u.search + u.hash); }
    } catch { /* fine */ }
    setState(reduced() ? "open" : "opening");
  };
  return (
    <>
      {state !== "shut" && children}
      {state !== "open" && <ShopShut opening={state === "opening"} onOpen={open} onGone={() => setState("open")} />}
    </>
  );
}

/* ---------- the time left, as lit holes: a 5 × 7 dot font ---------- */
const GLYPHS = {
  0: ["01110", "10001", "10011", "10101", "11001", "10001", "01110"],
  1: ["00100", "01100", "00100", "00100", "00100", "00100", "01110"],
  2: ["01110", "10001", "00001", "00010", "00100", "01000", "11111"],
  3: ["11111", "00010", "00100", "00010", "00001", "10001", "01110"],
  4: ["00010", "00110", "01010", "10010", "11111", "00010", "00010"],
  5: ["11111", "10000", "11110", "00001", "00001", "10001", "01110"],
  6: ["00110", "01000", "10000", "11110", "10001", "10001", "01110"],
  7: ["11111", "00001", "00010", "00100", "01000", "01000", "01000"],
  8: ["01110", "10001", "10001", "01110", "10001", "10001", "01110"],
  9: ["01110", "10001", "10001", "01111", "00001", "00010", "01100"],
  ":": ["0", "0", "1", "0", "1", "0", "0"],
};
const pad = (n) => String(n).padStart(2, "0");
function timeLeft(ms) {
  const s = Math.max(0, Math.floor(ms / 1000));
  return { h: Math.floor(s / 3600), m: Math.floor((s % 3600) / 60), s: s % 60 };
}
// which holes are lit: a set of "col,row" for the text, centred in cols × rows
function litHoles(text, cols, rows) {
  const width = [...text].reduce((a, ch) => a + (ch === ":" ? 1 : 5), 0) + text.length - 1;
  const x0 = Math.floor((cols - width) / 2);
  const y0 = Math.floor((rows - 7) * 0.42);
  const lit = new Set();
  let x = x0;
  for (const ch of text) {
    const g = GLYPHS[ch];
    g.forEach((line, r) => [...line].forEach((b, c) => { if (b === "1") lit.add(`${x + c},${y0 + r}`); }));
    x += g[0].length + 1;
  }
  return { lit, y0 };
}

function isNight(now = new Date()) {
  try {
    const h = Number(new Intl.DateTimeFormat("en-GB", { hour: "numeric", hourCycle: "h23", timeZone: "Asia/Beirut" }).format(now));
    return h >= 17 || h < 6;
  } catch { return false; }
}

/* The shutter, drawn: slats with their grooves, a perforation on a square grid, the time in lit holes. */
function drawShutter(canvas, w, h, text, night) {
  const dpr = Math.min(2.5, window.devicePixelRatio || 1);
  if (canvas.width !== Math.round(w * dpr) || canvas.height !== Math.round(h * dpr)) { canvas.width = Math.round(w * dpr); canvas.height = Math.round(h * dpr); }
  const g = canvas.getContext("2d");
  g.setTransform(dpr, 0, 0, dpr, 0, 0);
  const units = [...text].reduce((a, ch) => a + (ch === ":" ? 1 : 5), 0) + text.length - 1;
  const p = Math.max(6, Math.min(15, Math.floor(w / (units + 8)), Math.floor(h / 15))); // the holes' pitch
  const slat = p * 3;
  const cols = Math.floor(w / p), rows = Math.floor(h / p);
  const ox = (w - cols * p) / 2 + p / 2, oy = p / 2;
  // the slats
  const tone = night ? ["#565b66", "#41454e", "#30333a", "#1f2126", "#6c717c"] : ["#7b808a", "#646973", "#4f535c", "#3a3d44", "#9aa0aa"];
  for (let y = 0; y < h; y += slat) {
    const gr = g.createLinearGradient(0, y, 0, y + slat);
    gr.addColorStop(0, tone[0]); gr.addColorStop(0.45, tone[1]); gr.addColorStop(1, tone[2]);
    g.fillStyle = gr; g.fillRect(0, y, w, slat);
    g.fillStyle = tone[3]; g.fillRect(0, y + slat - 1.5, w, 1.5); // the groove
    g.fillStyle = tone[4]; g.fillRect(0, y, w, 1); // the light on the slat's edge
  }
  // light from inside, spilling round the time
  const { lit, y0 } = litHoles(text, cols, rows);
  const cy = oy + (y0 + 3) * p;
  const wash = g.createRadialGradient(w / 2, cy, p, w / 2, cy, Math.max(w, h) * 0.6);
  wash.addColorStop(0, night ? "rgba(255,138,70,0.30)" : "rgba(255,128,64,0.22)");
  wash.addColorStop(1, "rgba(255,120,60,0)");
  g.fillStyle = wash; g.fillRect(0, 0, w, h);
  // the holes
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const x = ox + c * p, y = oy + r * p;
      if (lit.has(`${c},${r}`)) continue;
      g.fillStyle = night ? "rgba(8,8,10,0.75)" : "rgba(18,19,23,0.6)";
      g.beginPath(); g.arc(x, y, p * 0.17, 0, Math.PI * 2); g.fill();
    }
  }
  // the lit ones: a warm glow through each hole
  g.save();
  g.shadowColor = night ? "rgba(255,130,60,0.95)" : "rgba(255,110,50,0.85)";
  g.shadowBlur = p * 1.1;
  for (const k of lit) {
    const [c, r] = k.split(",").map(Number);
    const x = ox + c * p, y = oy + r * p;
    g.fillStyle = "#FFE7C2";
    g.beginPath(); g.arc(x, y, p * 0.27, 0, Math.PI * 2); g.fill();
  }
  g.restore();
  g.fillStyle = "#FFFFFF";
  for (const k of lit) {
    const [c, r] = k.split(",").map(Number);
    g.beginPath(); g.arc(ox + c * p, oy + r * p, p * 0.12, 0, Math.PI * 2); g.fill();
  }
  return { below: oy + (y0 + 7) * p + p * 0.6, p };
}

function ShopShut({ opening, onOpen, onGone }) {
  const [now, setNow] = useState(() => Date.now());
  const [night] = useState(() => isNight());
  const [asking, setAsking] = useState(false);
  const [code, setCode] = useState("");
  const [wrong, setWrong] = useState(0);
  const [labelsAt, setLabelsAt] = useState(null);
  const shutter = useRef(null);
  const canvas = useRef(null);
  const input = useRef(null);
  const left = timeLeft(OPENS_AT - now);
  const text = `${pad(left.h)}:${pad(left.m)}:${pad(left.s)}`;

  // the page under it stays still
  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    document.title = "Kanaan Shop — the winter collection is going up";
    return () => { document.body.style.overflow = prev; };
  }, []);
  // every second; at zero the shutter goes up by itself
  useEffect(() => {
    if (opening) return undefined;
    const t = setInterval(() => {
      const n = Date.now();
      setNow(n);
      if (n >= OPENS_AT) onOpen(false);
    }, 1000);
    return () => clearInterval(t);
  }, [opening]); // eslint-disable-line react-hooks/exhaustive-deps
  // draw (and redraw when the shutter changes size)
  useEffect(() => {
    const el = shutter.current, cv = canvas.current;
    if (!el || !cv) return undefined;
    const paint = () => {
      const r = el.getBoundingClientRect();
      if (r.width < 10 || r.height < 10) return;
      const d = drawShutter(cv, r.width, r.height, text, night);
      setLabelsAt((v) => (v && v.below === d.below && v.p === d.p ? v : d));
    };
    paint();
    const ro = new ResizeObserver(paint);
    ro.observe(el);
    return () => ro.disconnect();
  }, [text, night]);
  // going up: the shutter rolls into its box, the shop shows, then the site
  useEffect(() => {
    if (!opening) return undefined;
    const t = setTimeout(onGone, 3100);
    return () => clearTimeout(t);
  }, [opening]); // eslint-disable-line react-hooks/exhaustive-deps

  const ask = () => { setAsking(true); setCode(""); setTimeout(() => input.current && input.current.focus(), 60); };
  const typed = (v) => {
    const d = v.replace(/\D/g, "").slice(0, 4);
    setCode(d);
    if (d.length === 4) {
      if (fits(d)) { try { navigator.vibrate && navigator.vibrate(18); } catch { /* fine */ } setAsking(false); input.current && input.current.blur(); onOpen(true); }
      else { setWrong((n) => n + 1); try { navigator.vibrate && navigator.vibrate([30, 40, 30]); } catch { /* fine */ } setTimeout(() => setCode(""), 420); }
    }
  };

  const opensOn = (() => {
    try {
      return new Intl.DateTimeFormat("en-GB", { weekday: "long", day: "numeric", month: "long", hour: "numeric", minute: "2-digit", hour12: true, timeZone: "Asia/Beirut" }).format(new Date(OPENS_AT)).replace(" at ", ", ");
    } catch { return ""; }
  })();

  return createPortal(
    <div className={`ss ${night ? "is-night" : "is-day"} ${opening ? "is-opening" : ""}`} role="main" aria-label="Kanaan Shop is opening soon" data-testid="shop-shut">
      <style>{SHOP_SHUT_CSS}</style>
      <div className="ss-building" aria-hidden="true"><i /><i /><i /></div>
      <div className="ss-front">
        <div className="ss-fascia"><img src="/logo-full.png" alt="Kanaan Shop — men's fashion wear" /></div>
        <div className="ss-canopy" aria-hidden="true">{Array.from({ length: 13 }, (_, i) => <i key={i} />)}</div>
        <div className="ss-door">
          <div className="ss-inside" aria-hidden="true" />
          <div className="ss-shutter" ref={shutter}>
            <canvas ref={canvas} aria-hidden="true" />
            <p className="ss-in" style={labelsAt ? { top: Math.max(26, labelsAt.below - labelsAt.p * 8.2 - 22) } : undefined}>Opening in</p>
            <p className="ss-units" style={labelsAt ? { top: labelsAt.below + Math.max(2, labelsAt.p * 0.3) } : undefined} aria-hidden="true"><span>hours</span><span>minutes</span><span>seconds</span></p>
            <span className="sr-only" aria-live="polite">{`${left.h} hours and ${left.m} minutes left`}</span>
            <div className="ss-rail">
              <button type="button" className="ss-lock" onClick={ask} aria-label="Staff code" data-testid="shop-shut-lock">
                <svg viewBox="0 0 24 30" width="16" height="20" aria-hidden="true"><path d="M7 13V9a5 5 0 0 1 10 0v4" fill="none" stroke="currentColor" strokeWidth="2.4" /><rect x="3.5" y="13" width="17" height="14" rx="3" fill="currentColor" /><circle cx="12" cy="19.5" r="1.8" fill="rgba(255,255,255,.55)" /></svg>
              </button>
            </div>
          </div>
          <div className="ss-box" aria-hidden="true" />
        </div>
      </div>
      <div className="ss-street">
        <h1>The winter collection is going up.</h1>
        <p>The shutter rolls up on <b>{opensOn}</b>. Until then, ask us anything on WhatsApp or drop by the shop in Saida.</p>
        <div className="ss-actions">
          <a className="ss-btn is-primary" href={`https://wa.me/${WHATSAPP}?text=${encodeURIComponent("Hi Kanaan! I'd like to hear first when the winter collection is online.")}`} target="_blank" rel="noopener noreferrer">Tell me first on WhatsApp</a>
          <a className="ss-btn" href="https://instagram.com/kanaan.shop" target="_blank" rel="noopener noreferrer">Instagram</a>
        </div>
      </div>

      {asking && (
        <div className="ss-ask" onClick={() => setAsking(false)}>
          <div className="ss-ask-card" onClick={(e) => e.stopPropagation()} role="dialog" aria-modal="true" aria-label="Staff code">
            <p>Staff code</p>
            <label key={wrong} className={`ss-pins ${wrong ? "is-wrong" : ""}`}>
              {[0, 1, 2, 3].map((i) => <i key={i} className={code.length > i ? "on" : ""} />)}
              <input ref={input} value={code} onChange={(e) => typed(e.target.value)} inputMode="numeric" pattern="[0-9]*" autoComplete="off" maxLength={4} aria-label="Staff code" data-testid="shop-shut-code" />
            </label>
          </div>
        </div>
      )}
    </div>,
    document.body
  );
}

const SHOP_SHUT_CSS = `
  .ss { position: fixed; inset: 0; z-index: 200; display: flex; flex-direction: column; overflow: hidden; font-family: 'Inter', sans-serif; --ink: #14141A; --wall: #E9E6E1; --sky: #F2F2F4; background: var(--sky); color: var(--ink); transition: opacity .7s ease .1s; }
  .ss.is-night { --wall: #2A2B30; --sky: #121318; color: #F5F5F7; }
  .ss.is-opening { animation: ssFade .7s ease 2.4s both; }
  @keyframes ssFade { to { opacity: 0; visibility: hidden; } }

  /* the floors above: the building and its windows */
  .ss-building { flex: 0 0 clamp(28px, 7vh, 96px); background: var(--wall); display: flex; justify-content: center; gap: clamp(26px, 9vw, 120px); align-items: flex-end; padding: 0 16px; }
  .ss-building i { width: clamp(54px, 16vw, 150px); height: 70%; border-radius: 4px 4px 0 0; background: linear-gradient(180deg, #8F949C, #5E636B); box-shadow: inset 0 0 0 3px rgba(255,255,255,.35); }
  .is-night .ss-building i { background: linear-gradient(180deg, #F3C77A, #C7853B); box-shadow: inset 0 0 0 3px rgba(0,0,0,.35), 0 0 22px rgba(243,199,122,.35); }
  .is-night .ss-building i:nth-child(2) { background: linear-gradient(180deg, #2F323A, #1C1E23); box-shadow: inset 0 0 0 3px rgba(0,0,0,.4); }

  .ss-front { flex: 1 1 auto; display: flex; flex-direction: column; width: 100%; max-width: 1040px; margin: 0 auto; min-height: 0; background: var(--wall); box-shadow: 0 0 0 100vmax var(--wall); clip-path: inset(0 -100vmax); }
  .ss-fascia { flex: 0 0 auto; background: #FBFBFA; display: grid; place-items: center; padding: clamp(14px, 3vh, 30px) 24px; box-shadow: 0 1px 0 rgba(0,0,0,.06), 0 10px 26px -18px rgba(0,0,0,.4); }
  .is-night .ss-fascia { background: #F3F1EC; box-shadow: 0 0 60px rgba(255,236,200,.18); }
  .ss-fascia img { width: min(78%, 400px); height: auto; display: block; }
  .ss-canopy { flex: 0 0 auto; position: relative; height: clamp(16px, 2.6vh, 26px); background: #17181C; display: flex; justify-content: space-around; align-items: flex-end; padding: 0 3%; }
  .ss-canopy i { width: 7px; height: 7px; border-radius: 50%; margin-bottom: -3px; background: #FFE7B8; box-shadow: 0 0 6px 2px rgba(255,214,140,.55); }
  .is-day .ss-canopy i { background: #F4EBD9; box-shadow: none; }

  /* the shop's opening: black frame, the shutter box on top, the shutter, the shop behind */
  .ss-door { position: relative; flex: 1 1 auto; min-height: 0; margin: 0 clamp(14px, 4vw, 48px); border: solid #17181C; border-width: 0 clamp(8px, 2vw, 14px); background: #17181C; overflow: hidden; }
  .ss-inside { position: absolute; inset: 0; background: url(/home/shop-inside.webp) center 40% / cover no-repeat; filter: saturate(1.05) brightness(1.04); }
  .ss-box { position: absolute; left: 0; right: 0; top: 0; height: clamp(14px, 2.2vh, 22px); background: linear-gradient(180deg, #2B2D33, #17181C); box-shadow: 0 6px 12px -6px rgba(0,0,0,.6); z-index: 3; }
  .ss-shutter { position: absolute; inset: 0; z-index: 2; transform: translateY(0); }
  .ss.is-opening .ss-shutter { transition: transform 2.3s cubic-bezier(.62,.02,.34,1) .15s; transform: translateY(-101%); }
  .ss-shutter canvas { position: absolute; inset: 0; width: 100%; height: 100%; display: block; }
  .ss-in, .ss-units { position: absolute; left: 0; right: 0; margin: 0; text-align: center; font-family: 'Space Grotesk', sans-serif; letter-spacing: .02em; pointer-events: none; }
  .ss-in { top: 30%; font-size: clamp(13px, 1.8vw, 17px); font-weight: 600; color: rgba(255,231,194,.92); text-shadow: 0 0 10px rgba(255,140,60,.55); }
  .is-night .ss-in { color: rgba(255,231,194,.9); text-shadow: 0 0 12px rgba(255,140,60,.6); }
  .ss-units { top: 52%; display: flex; justify-content: center; gap: clamp(26px, 8vw, 96px); font-size: 11px; font-weight: 500; color: rgba(255,236,210,.7); }
  .is-night .ss-units { color: rgba(255,231,194,.62); }
  .ss-rail { position: absolute; left: 0; right: 0; bottom: 0; height: 22px; background: linear-gradient(180deg, #3A3D44, #1D1F24); display: grid; place-items: center; }
  .ss-rail::before { content: ''; position: absolute; left: 50%; top: 6px; width: 64px; height: 4px; margin-left: -32px; border-radius: 3px; background: rgba(255,255,255,.18); }
  .ss-lock { position: relative; top: -12px; width: 30px; height: 34px; display: grid; place-items: center; color: #2A2C31; background: linear-gradient(180deg, #C9CCD2, #8E939B); border-radius: 7px; box-shadow: 0 3px 8px rgba(0,0,0,.35); opacity: .9; }
  .ss-lock:focus-visible { outline: 2px solid #FF4522; outline-offset: 2px; }

  /* the pavement: what is happening, and how to reach the shop */
  .ss-street { flex: 0 0 auto; padding: clamp(18px, 3vh, 30px) 16px calc(clamp(18px, 3vh, 34px) + env(safe-area-inset-bottom, 0px)); text-align: center; background: linear-gradient(180deg, #CFCBC4, #E4E1DC 18%); color: #14141A; }
  .is-night .ss-street { background: linear-gradient(180deg, #1A1B20, #24252B 18%); color: #F5F5F7; }
  .ss-street h1 { margin: 0 auto; max-width: 22ch; text-wrap: balance; font-family: 'Space Grotesk', sans-serif; font-weight: 700; font-size: clamp(24px, 4.2vw, 40px); line-height: 1.08; letter-spacing: -.02em; }
  .ss-street p { margin: 10px auto 0; max-width: 46ch; text-wrap: pretty; font-size: clamp(14px, 1.6vw, 16px); line-height: 1.5; opacity: .72; }
  .ss-street p b { font-weight: 600; opacity: 1; }
  .ss-actions { display: flex; justify-content: center; gap: 10px; margin-top: 16px; flex-wrap: wrap; }
  .ss-btn { display: inline-flex; align-items: center; height: 46px; padding: 0 20px; border-radius: 999px; font-weight: 500; font-size: 15px; background: rgba(255,255,255,.6); border: 1px solid rgba(255,255,255,.9); color: #14141A; backdrop-filter: blur(16px); -webkit-backdrop-filter: blur(16px); }
  .is-night .ss-btn { background: rgba(255,255,255,.08); border-color: rgba(255,255,255,.16); color: #F5F5F7; }
  .ss-btn.is-primary { background: #FF4522; border-color: rgba(255,255,255,.35); color: #fff; }
  .ss.is-opening .ss-street, .ss.is-opening .ss-fascia, .ss.is-opening .ss-canopy, .ss.is-opening .ss-building { transition: opacity .6s ease 1.6s; opacity: 0; }

  /* the staff code */
  .ss-ask { position: absolute; inset: 0; z-index: 5; background: rgba(10,10,14,.45); backdrop-filter: blur(4px); -webkit-backdrop-filter: blur(4px); display: grid; place-items: center; padding: 16px; animation: ssIn .25s ease both; }
  .ss-ask-card { width: min(300px, 100%); padding: 22px 20px 24px; border-radius: 26px; text-align: center; background: rgba(255,255,255,.88); border: 1px solid rgba(255,255,255,.95); box-shadow: 0 24px 60px rgba(0,0,0,.35); backdrop-filter: blur(24px); -webkit-backdrop-filter: blur(24px); color: #14141A; }
  .ss-ask-card p { margin: 0 0 14px; font-family: 'Space Grotesk', sans-serif; font-weight: 600; font-size: 15px; }
  .ss-pins { position: relative; display: flex; justify-content: center; gap: 14px; cursor: text; }
  .ss-pins i { width: 46px; height: 54px; border-radius: 14px; background: rgba(20,20,26,.06); border: 1px solid rgba(20,20,26,.1); position: relative; }
  .ss-pins i.on::after { content: ''; position: absolute; left: 50%; top: 50%; width: 12px; height: 12px; margin: -6px 0 0 -6px; border-radius: 50%; background: #14141A; animation: ssPop .2s ease both; }
  .ss-pins input { position: absolute; inset: 0; opacity: 0; font-size: 16px; }
  .ss-pins.is-wrong { animation: ssShake .42s ease; }
  @keyframes ssIn { from { opacity: 0; } }
  @keyframes ssPop { from { transform: scale(.3); } }
  @keyframes ssShake { 20% { transform: translateX(-9px); } 40% { transform: translateX(8px); } 60% { transform: translateX(-5px); } 80% { transform: translateX(3px); } }
  @media (prefers-reduced-motion: reduce) { .ss-ask, .ss-pins i.on::after, .ss-pins.is-wrong { animation: none; } }
  @media (min-width: 900px) { .ss-door { margin: 0 64px; } }
`;
