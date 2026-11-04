/* ============================================================
   SMALL PIECES OF THE SHOP, SET FROM KANAAN POS
   ------------------------------------------------------------
   AnnounceBar        the line at the top of every page (the owner writes
                      it on his phone: Website → Site → Bar at the top); while
                      the welcome offer is on, it takes turns with it
   WelcomeNote        "10% off your first order", on a piece / in the bag
   FreeDeliveryMeter  "Add $12 more for free delivery" in the cart, when
                      the shop offers free delivery from an amount
   OpenNow            "Open now · until 10 pm", in Saida's own time
   ============================================================ */
import React, { useEffect, useState } from "react";
import { ArrowUpRight, Gift, Truck, X } from "lucide-react";
import { useSiteSettings, welcomeNow, welcomeWords } from "../lib/siteSettings.js";
import { openLine } from "../lib/hours.js";

const CLOSED_KEY = "kanaan-bar-closed";
const CLOSED_W = "kanaan-welcome-closed";
const read = (k) => { try { return localStorage.getItem(k) || ""; } catch { return ""; } };

/** The bar floats just above the header (both stay at the top); while it
    shows, --announce-h tells the rest of the page how much taller the
    header is (the 3D homepage tucks under the header). */
export function AnnounceBar({ navigate }) {
  const site = useSiteSettings();
  const { announce } = site;
  const w = welcomeNow(site);
  const [closed, setClosed] = useState(() => read(CLOSED_KEY));
  const [closedW, setClosedW] = useState(() => read(CLOSED_W));
  const [turn, setTurn] = useState(0);
  const msgs = [];
  if (announce && announce.text && closed !== (announce.id || announce.text)) msgs.push({ kind: "shop", text: announce.text, link: announce.link, tone: announce.tone, id: announce.id || announce.text });
  const wid = w ? `${w.pct}|${w.min}|${w.text}` : "";
  if (w && w.bar && closedW !== wid) msgs.push({ kind: "welcome", text: welcomeWords(w), link: "/shop", tone: "welcome", id: wid });
  const show = msgs.length > 0;
  // two messages take turns, every 6 seconds
  useEffect(() => {
    if (msgs.length < 2) return undefined;
    const t = setInterval(() => setTurn((n) => n + 1), 6000);
    return () => clearInterval(t);
  }, [msgs.length]);
  useEffect(() => {
    const root = document.documentElement;
    if (show) root.style.setProperty("--announce-h", "40px"); else root.style.removeProperty("--announce-h");
    return () => root.style.removeProperty("--announce-h");
  }, [show]);
  if (!show) return null;
  const m = msgs[turn % msgs.length];
  const close = (e) => {
    e.stopPropagation();
    try { localStorage.setItem(m.kind === "welcome" ? CLOSED_W : CLOSED_KEY, m.id); } catch { /* private mode */ }
    if (m.kind === "welcome") setClosedW(m.id); else setClosed(m.id);
  };
  const tone = m.tone === "welcome" ? "ab-welcome" : m.tone === "teal" ? "ab-teal" : m.tone === "ink" ? "ab-ink" : "ab-coral";
  const go = () => { if (m.link && navigate) navigate(m.link); };
  const inner = <>{m.kind === "welcome" && <Gift className="w-3.5 h-3.5 flex-shrink-0" aria-hidden="true" />}<span key={m.id} className="ab-turn">{m.text}</span>{m.link ? <ArrowUpRight className="w-3.5 h-3.5 flex-shrink-0" aria-hidden="true" /> : null}</>;
  return (
    <div className={`announce-bar ${tone}`} role="region" aria-label="From the shop" data-bar={m.kind}>
      {m.link ? <button type="button" className="ab-text" onClick={go}>{inner}</button> : <p className="ab-text">{inner}</p>}
      <button type="button" className="ab-close" onClick={close} aria-label="Close the message"><X className="w-3.5 h-3.5" /></button>
    </div>
  );
}

/** The welcome offer where it counts: on a piece it is on, in the bag (with the amount it comes to). */
export function WelcomeNote({ amount = null, short = 0, money, className = "" }) {
  const w = welcomeNow(useSiteSettings());
  if (!w) return null;
  return (
    <p className={`welcome-note ${className}`} data-testid="welcome-note">
      <Gift className="w-3.5 h-3.5 flex-shrink-0" aria-hidden="true" />
      <span>
        {short > 0
          ? <>Add <b className="font-num">{money(short)}</b> more for <b className="font-num">{w.pct}%</b> off your first order</>
          : amount != null
            ? <>First order? <b className="font-num">{w.pct}%</b> off: <b className="font-num">−{money(amount)}</b> at checkout</>
            : <><b className="font-num">{w.pct}%</b> off on your first order — taken off at checkout</>}
      </span>
    </p>
  );
}

/** Progress to free delivery, or the good news. Nothing when the shop
    doesn't offer it. */
export function FreeDeliveryMeter({ subtotal, money }) {
  const { freeOver } = useSiteSettings();
  if (!freeOver || subtotal <= 0) return null;
  const left = Math.max(0, freeOver - subtotal);
  const pct = Math.min(100, (subtotal / freeOver) * 100);
  return (
    <div className={`free-meter ${left === 0 ? "is-free" : ""}`} aria-live="polite">
      <p className="font-body text-xs font-medium flex items-center gap-1.5">
        <Truck className="w-3.5 h-3.5 flex-shrink-0" aria-hidden="true" />
        <span>{left === 0 ? "Free delivery on this order" : <>Add <span className="font-num">{money(left)}</span> more for free delivery</>}</span>
      </p>
      <span className="free-meter-track" aria-hidden="true"><i style={{ width: `${pct}%` }} /></span>
    </div>
  );
}

/** "Open now · until 10 pm" — re-read every minute. */
export function OpenNow({ className = "" }) {
  const { hours } = useSiteSettings();
  const [, tick] = useState(0);
  useEffect(() => {
    if (!hours) return undefined;
    const t = setInterval(() => tick((n) => n + 1), 60000);
    return () => clearInterval(t);
  }, [hours]);
  const line = openLine(hours);
  if (!line) return null;
  return (
    <span className={`open-now ${line.open ? "is-open" : ""} ${className}`}>
      <i aria-hidden="true" />{line.text}
    </span>
  );
}

export const SITE_BITS_CSS = `
.announce-bar { display: flex; align-items: center; gap: 6px; height: 34px; max-width: 72rem; margin: 0 auto 6px; padding: 0 4px 0 14px; border-radius: 14px; font-family: 'Inter', sans-serif; font-size: 13.5px; font-weight: 600; box-shadow: var(--glass-shadow); animation: barIn .45s cubic-bezier(.2,.8,.2,1) both; }
@keyframes barIn { from { opacity: 0; transform: translateY(-8px); } }
.announce-bar.ab-coral { background: var(--coral); color: #fff; }
.announce-bar.ab-teal { background: var(--teal); color: #062420; }
.announce-bar.ab-ink { background: var(--fg); color: var(--bg); }
.announce-bar .ab-text { flex: 1; min-width: 0; display: flex; align-items: center; justify-content: center; gap: 6px; height: 100%; color: inherit; font: inherit; }
.announce-bar.ab-welcome { background: var(--teal); color: #062420; }
.announce-bar .ab-text span { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.announce-bar .ab-turn { animation: abTurn .5s cubic-bezier(.2,.8,.2,1) both; }
@keyframes abTurn { from { opacity: 0; transform: translateY(6px); } }
.welcome-note { display: flex; align-items: center; gap: 7px; font-family: 'Inter', sans-serif; font-size: 12.5px; line-height: 1.35; color: var(--teal-text, var(--fg)); background: color-mix(in srgb, var(--teal) 12%, transparent); border: 1px dashed color-mix(in srgb, var(--teal) 55%, transparent); border-radius: 14px; padding: 8px 11px; }
.welcome-note b { font-weight: 700; }
.announce-bar .ab-close { width: 30px; height: 30px; border-radius: 999px; display: grid; place-items: center; color: inherit; opacity: .8; flex-shrink: 0; }
.announce-bar .ab-close:hover { opacity: 1; background: rgba(255,255,255,.16); }
.free-meter { border-radius: 16px; padding: 10px 12px 12px; background: color-mix(in srgb, var(--teal) 12%, transparent); color: var(--fg); margin-bottom: 12px; }
.free-meter.is-free { background: color-mix(in srgb, var(--teal) 20%, transparent); }
.free-meter-track { display: block; height: 4px; border-radius: 999px; background: var(--border); margin-top: 8px; overflow: hidden; }
.free-meter-track i { display: block; height: 100%; border-radius: inherit; background: var(--teal); transition: width .5s cubic-bezier(.2,.8,.2,1); }
.open-now { display: inline-flex; align-items: center; gap: 8px; font-family: 'Inter', sans-serif; font-weight: 600; font-size: 13.5px; color: var(--fg-muted); }
.open-now i { width: 8px; height: 8px; border-radius: 50%; background: var(--fg-muted); flex-shrink: 0; }
.open-now.is-open { color: var(--fg); }
.open-now.is-open i { background: var(--teal); box-shadow: 0 0 0 0 color-mix(in srgb, var(--teal) 60%, transparent); animation: openPulse 2.4s ease-out infinite; }
@keyframes openPulse { 0% { box-shadow: 0 0 0 0 color-mix(in srgb, var(--teal) 55%, transparent); } 80%, 100% { box-shadow: 0 0 0 9px transparent; } }
@media (prefers-reduced-motion: reduce) { .open-now.is-open i, .announce-bar, .announce-bar .ab-turn { animation: none; } .free-meter-track i { transition: none; } }
`;
