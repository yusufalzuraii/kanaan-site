/* ============================================================
   THE APP, ON THE WEBSITE
   ------------------------------------------------------------
   AppBanner   the strip at the very top of the page on a phone that can
               install the app (Android today): the app's icon, its name,
               "Get the app". It sits in the page, above the header, and
               scrolls away with it (the header stays). Closed = quiet for
               30 days. Never in the app itself, at checkout or on an order.
   AppShelf    the app's place on the homepage, drawn like the app's own
               Google Play pictures: the shop's rail, a paper swing tag with
               the words, and a phone showing the app's real home screen.
               It knows the device: Android gets the Play button, an iPhone
               is told the truth (soon), a computer gets a QR code to scan.
   /app        (functions/app.js) one short link that sends each phone to
               its own store: the QR code and any post can use it.

   When the iPhone app is on the App Store: put its numeric id in
   IOS_APP_ID (here and in functions/app.js) and both pieces switch on
   for iPhones by themselves.
   ============================================================ */
import React, { useEffect, useRef, useState } from "react";
import { X, Play, ArrowUpRight } from "lucide-react";
import { isNativeApp } from "../native.js";
import { OpenNow } from "./SiteBits.jsx";
import APP_ICON from "../assets/app-icon.webp";
import APP_HOME from "../assets/app-home.webp";
import LOGO from "../assets/logo-compact.webp";

export const ANDROID_ID = "com.kanaanshop.app";
export const IOS_APP_ID = ""; // the App Store's number for the app, once it is there
export const APP_LINK = "https://kanaanshop.com/app";
/* where = banner | home: Google Play's console shows which of the two brought the installs */
export const playUrl = (where) => "https://play.google.com/store/apps/details?id=" + ANDROID_ID + "&referrer=" + encodeURIComponent("utm_source=kanaanshop.com&utm_medium=" + where);
export const appStoreUrl = () => "https://apps.apple.com/app/id" + IOS_APP_ID;

const QR = { n: 25, d: "M0 0h1v1h-1zM1 0h1v1h-1zM2 0h1v1h-1zM3 0h1v1h-1zM4 0h1v1h-1zM5 0h1v1h-1zM6 0h1v1h-1zM8 0h1v1h-1zM11 0h1v1h-1zM13 0h1v1h-1zM18 0h1v1h-1zM19 0h1v1h-1zM20 0h1v1h-1zM21 0h1v1h-1zM22 0h1v1h-1zM23 0h1v1h-1zM24 0h1v1h-1zM0 1h1v1h-1zM6 1h1v1h-1zM9 1h1v1h-1zM10 1h1v1h-1zM16 1h1v1h-1zM18 1h1v1h-1zM24 1h1v1h-1zM0 2h1v1h-1zM2 2h1v1h-1zM3 2h1v1h-1zM4 2h1v1h-1zM6 2h1v1h-1zM8 2h1v1h-1zM11 2h1v1h-1zM12 2h1v1h-1zM13 2h1v1h-1zM14 2h1v1h-1zM18 2h1v1h-1zM20 2h1v1h-1zM21 2h1v1h-1zM22 2h1v1h-1zM24 2h1v1h-1zM0 3h1v1h-1zM2 3h1v1h-1zM3 3h1v1h-1zM4 3h1v1h-1zM6 3h1v1h-1zM9 3h1v1h-1zM10 3h1v1h-1zM12 3h1v1h-1zM13 3h1v1h-1zM15 3h1v1h-1zM18 3h1v1h-1zM20 3h1v1h-1zM21 3h1v1h-1zM22 3h1v1h-1zM24 3h1v1h-1zM0 4h1v1h-1zM2 4h1v1h-1zM3 4h1v1h-1zM4 4h1v1h-1zM6 4h1v1h-1zM9 4h1v1h-1zM11 4h1v1h-1zM14 4h1v1h-1zM18 4h1v1h-1zM20 4h1v1h-1zM21 4h1v1h-1zM22 4h1v1h-1zM24 4h1v1h-1zM0 5h1v1h-1zM6 5h1v1h-1zM8 5h1v1h-1zM11 5h1v1h-1zM13 5h1v1h-1zM14 5h1v1h-1zM18 5h1v1h-1zM24 5h1v1h-1zM0 6h1v1h-1zM1 6h1v1h-1zM2 6h1v1h-1zM3 6h1v1h-1zM4 6h1v1h-1zM5 6h1v1h-1zM6 6h1v1h-1zM8 6h1v1h-1zM10 6h1v1h-1zM12 6h1v1h-1zM14 6h1v1h-1zM16 6h1v1h-1zM18 6h1v1h-1zM19 6h1v1h-1zM20 6h1v1h-1zM21 6h1v1h-1zM22 6h1v1h-1zM23 6h1v1h-1zM24 6h1v1h-1zM9 7h1v1h-1zM0 8h1v1h-1zM2 8h1v1h-1zM6 8h1v1h-1zM7 8h1v1h-1zM9 8h1v1h-1zM11 8h1v1h-1zM12 8h1v1h-1zM16 8h1v1h-1zM19 8h1v1h-1zM22 8h1v1h-1zM24 8h1v1h-1zM1 9h1v1h-1zM4 9h1v1h-1zM5 9h1v1h-1zM7 9h1v1h-1zM9 9h1v1h-1zM12 9h1v1h-1zM15 9h1v1h-1zM16 9h1v1h-1zM18 9h1v1h-1zM19 9h1v1h-1zM21 9h1v1h-1zM23 9h1v1h-1zM24 9h1v1h-1zM1 10h1v1h-1zM3 10h1v1h-1zM5 10h1v1h-1zM6 10h1v1h-1zM7 10h1v1h-1zM9 10h1v1h-1zM11 10h1v1h-1zM14 10h1v1h-1zM15 10h1v1h-1zM17 10h1v1h-1zM18 10h1v1h-1zM21 10h1v1h-1zM22 10h1v1h-1zM24 10h1v1h-1zM0 11h1v1h-1zM3 11h1v1h-1zM4 11h1v1h-1zM5 11h1v1h-1zM8 11h1v1h-1zM9 11h1v1h-1zM11 11h1v1h-1zM12 11h1v1h-1zM14 11h1v1h-1zM15 11h1v1h-1zM17 11h1v1h-1zM20 11h1v1h-1zM21 11h1v1h-1zM1 12h1v1h-1zM2 12h1v1h-1zM3 12h1v1h-1zM6 12h1v1h-1zM7 12h1v1h-1zM8 12h1v1h-1zM10 12h1v1h-1zM12 12h1v1h-1zM15 12h1v1h-1zM18 12h1v1h-1zM19 12h1v1h-1zM24 12h1v1h-1zM2 13h1v1h-1zM9 13h1v1h-1zM13 13h1v1h-1zM15 13h1v1h-1zM16 13h1v1h-1zM18 13h1v1h-1zM19 13h1v1h-1zM23 13h1v1h-1zM24 13h1v1h-1zM0 14h1v1h-1zM1 14h1v1h-1zM3 14h1v1h-1zM6 14h1v1h-1zM7 14h1v1h-1zM11 14h1v1h-1zM12 14h1v1h-1zM15 14h1v1h-1zM16 14h1v1h-1zM21 14h1v1h-1zM22 14h1v1h-1zM24 14h1v1h-1zM2 15h1v1h-1zM4 15h1v1h-1zM7 15h1v1h-1zM14 15h1v1h-1zM15 15h1v1h-1zM16 15h1v1h-1zM18 15h1v1h-1zM19 15h1v1h-1zM20 15h1v1h-1zM21 15h1v1h-1zM0 16h1v1h-1zM1 16h1v1h-1zM4 16h1v1h-1zM6 16h1v1h-1zM8 16h1v1h-1zM11 16h1v1h-1zM16 16h1v1h-1zM17 16h1v1h-1zM18 16h1v1h-1zM19 16h1v1h-1zM20 16h1v1h-1zM23 16h1v1h-1zM8 17h1v1h-1zM9 17h1v1h-1zM10 17h1v1h-1zM11 17h1v1h-1zM12 17h1v1h-1zM13 17h1v1h-1zM16 17h1v1h-1zM20 17h1v1h-1zM24 17h1v1h-1zM0 18h1v1h-1zM1 18h1v1h-1zM2 18h1v1h-1zM3 18h1v1h-1zM4 18h1v1h-1zM5 18h1v1h-1zM6 18h1v1h-1zM8 18h1v1h-1zM11 18h1v1h-1zM12 18h1v1h-1zM13 18h1v1h-1zM16 18h1v1h-1zM18 18h1v1h-1zM20 18h1v1h-1zM24 18h1v1h-1zM0 19h1v1h-1zM6 19h1v1h-1zM9 19h1v1h-1zM10 19h1v1h-1zM14 19h1v1h-1zM15 19h1v1h-1zM16 19h1v1h-1zM20 19h1v1h-1zM24 19h1v1h-1zM0 20h1v1h-1zM2 20h1v1h-1zM3 20h1v1h-1zM4 20h1v1h-1zM6 20h1v1h-1zM9 20h1v1h-1zM11 20h1v1h-1zM14 20h1v1h-1zM15 20h1v1h-1zM16 20h1v1h-1zM17 20h1v1h-1zM18 20h1v1h-1zM19 20h1v1h-1zM20 20h1v1h-1zM23 20h1v1h-1zM0 21h1v1h-1zM2 21h1v1h-1zM3 21h1v1h-1zM4 21h1v1h-1zM6 21h1v1h-1zM10 21h1v1h-1zM11 21h1v1h-1zM12 21h1v1h-1zM13 21h1v1h-1zM15 21h1v1h-1zM17 21h1v1h-1zM20 21h1v1h-1zM22 21h1v1h-1zM23 21h1v1h-1zM0 22h1v1h-1zM2 22h1v1h-1zM3 22h1v1h-1zM4 22h1v1h-1zM6 22h1v1h-1zM8 22h1v1h-1zM10 22h1v1h-1zM11 22h1v1h-1zM15 22h1v1h-1zM16 22h1v1h-1zM17 22h1v1h-1zM19 22h1v1h-1zM20 22h1v1h-1zM21 22h1v1h-1zM23 22h1v1h-1zM24 22h1v1h-1zM0 23h1v1h-1zM6 23h1v1h-1zM14 23h1v1h-1zM16 23h1v1h-1zM19 23h1v1h-1zM20 23h1v1h-1zM0 24h1v1h-1zM1 24h1v1h-1zM2 24h1v1h-1zM3 24h1v1h-1zM4 24h1v1h-1zM5 24h1v1h-1zM6 24h1v1h-1zM8 24h1v1h-1zM10 24h1v1h-1zM11 24h1v1h-1zM12 24h1v1h-1zM16 24h1v1h-1zM18 24h1v1h-1zM21 24h1v1h-1zM24 24h1v1h-1z" };
const CLOSED_KEY = "kanaan-app-banner-closed";
const QUIET_MS = 30 * 24 * 3600 * 1000;

/** android | ios | desktop. "?appbanner=android" (or ios, desktop) shows how another device sees
    the page, for this tab only: the owner checks the Android strip from his iPhone with it. */
export function devicePlatform() {
  if (typeof navigator === "undefined") return "desktop";
  try {
    const q = new URLSearchParams(window.location.search).get("appbanner");
    if (q) sessionStorage.setItem("kanaan-appbanner", q);
    const forced = sessionStorage.getItem("kanaan-appbanner");
    if (forced === "android" || forced === "ios" || forced === "desktop") return forced;
  } catch { /* private mode */ }
  const ua = navigator.userAgent || "";
  if (/Android/i.test(ua)) return "android";
  if (/iPhone|iPad|iPod/i.test(ua) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1)) return "ios";
  return "desktop";
}
const isForced = () => { try { return !!sessionStorage.getItem("kanaan-appbanner"); } catch { return false; } };
const closedLately = () => { try { const t = Number(localStorage.getItem(CLOSED_KEY) || 0); return t > 0 && Date.now() - t < QUIET_MS; } catch { return false; } };
const storeFor = (os, where) => (os === "ios" ? appStoreUrl() : playUrl(where));
const hasStore = (os) => os === "android" || (os === "ios" && !!IOS_APP_ID);

/** The strip at the top. "path" is the page's address: it keeps out of the way of buying. */
export function AppBanner({ path = "/" }) {
  const [os] = useState(devicePlatform);
  const [closed, setClosed] = useState(() => !isForced() && closedLately());
  const busy = /^\/(checkout|order|admin|account|review|lab|applab)/.test(path);
  if (isNativeApp || !hasStore(os) || closed || busy) return null;
  const quiet = () => { try { localStorage.setItem(CLOSED_KEY, String(Date.now())); } catch { /* private mode */ } };
  const close = () => { quiet(); setClosed(true); };
  return (
    <aside className="app-banner" aria-label="The Kanaan Shop app" data-testid="app-banner" data-os={os}>
      <button type="button" className="apb-x" onClick={close} aria-label="Close"><X className="w-4 h-4" aria-hidden="true" /></button>
      <img className="apb-icon" src={APP_ICON} alt="" width="44" height="44" />
      <p className="apb-words">
        <b>Kanaan Shop</b>
        <span>{os === "ios" ? "Free on the App Store" : "Free on Google Play"}</span>
      </p>
      <a className="apb-get tap-scale" href={storeFor(os, "banner")} target="_blank" rel="noopener noreferrer" onClick={quiet} data-testid="app-banner-get">Get the app</a>
    </aside>
  );
}

function useSeen(ref) {
  const [seen, setSeen] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!el || typeof IntersectionObserver === "undefined") { setSeen(true); return undefined; }
    const io = new IntersectionObserver((es) => { if (es.some((e) => e.isIntersecting)) { setSeen(true); io.disconnect(); } }, { threshold: 0.25 });
    io.observe(el);
    return () => io.disconnect();
  }, [ref]);
  return seen;
}

/** A store button: two lines, as store buttons read. Words only, no store's logo. */
function StoreButton({ os, where }) {
  return (
    <a className="apx-store tap-scale" href={storeFor(os, where)} target="_blank" rel="noopener noreferrer" data-testid="app-store-btn">
      <Play className="apx-store-ic" aria-hidden="true" />
      <span><small>{os === "ios" ? "Download on the" : "Get it on"}</small><b>{os === "ios" ? "App Store" : "Google Play"}</b></span>
    </a>
  );
}

/** The app's place on the homepage. */
export function AppShelf({ appExclusiveCount = 0 }) {
  const [os] = useState(devicePlatform);
  const ref = useRef(null);
  const seen = useSeen(ref);
  // kanaanshop.com/app sends an iPhone here while its app isn't out yet
  useEffect(() => {
    if (typeof window === "undefined" || window.location.hash !== "#app") return undefined;
    const t = setTimeout(() => { if (ref.current) ref.current.scrollIntoView({ block: "center" }); }, 700);
    return () => clearTimeout(t);
  }, []);
  if (isNativeApp) return null;
  const rows = [
    ["Your size comes back", "you hear first"],
    ["Bag and saved pieces", "one tap away"],
    appExclusiveCount > 0 ? ["Pieces only in the app", appExclusiveCount + " now"] : ["New pieces", "the day they land"],
  ];
  const iosWaiting = os === "ios" && !IOS_APP_ID;
  return (
    <section id="app" className="max-w-6xl mx-auto px-4 sm:px-6 pb-20" aria-labelledby="apx-title">
      <div ref={ref} className={"apx" + (seen ? " is-seen" : "")} data-os={os} data-testid="app-shelf">
        <span className="apx-post" aria-hidden="true" />
        <span className="apx-rail" aria-hidden="true" />
        <div className="apx-hang">
          <i className="apx-string" aria-hidden="true" />
          <div className="apx-tag">
            <i className="apx-eye" aria-hidden="true" />
            <p className="apx-id">
              <img src={APP_ICON} alt="" width="40" height="40" loading="lazy" />
              <span><b>Kanaan Shop</b><small>{iosWaiting ? "Free · on Android now" : "Free · the shop's own app"}</small></span>
            </p>
            <h2 id="apx-title" className="apx-title">The shop, kept on your phone.</h2>
            <dl className="apx-rows">
              {rows.map(([a, b]) => (
                <div key={a}><dt>{a}</dt><i aria-hidden="true" /><dd>{b}</dd></div>
              ))}
            </dl>
            {os === "desktop" ? (
              <div className="apx-cta apx-cta-desk">
                <span className="apx-qr">
                  <svg viewBox={"-2 -2 " + (QR.n + 4) + " " + (QR.n + 4)} width="104" height="104" role="img" aria-label="QR code: kanaanshop.com/app" shapeRendering="crispEdges"><rect x="-2" y="-2" width={QR.n + 4} height={QR.n + 4} fill="#fff" /><path d={QR.d} fill="#14141A" /></svg>
                </span>
                <span className="apx-scan">
                  <b>Point your phone's camera here.</b>
                  <small>It opens the app's page in your phone's store.</small>
                  <StoreButton os="android" where="home" />
                </span>
              </div>
            ) : iosWaiting ? (
              <div className="apx-cta">
                <p className="apx-soon"><i aria-hidden="true" /><span><b>The iPhone app is on its way.</b><small>Until then the site on your iPhone does it all.</small></span></p>
                <a className="apx-link" href={playUrl("home")} target="_blank" rel="noopener noreferrer">On Android? It's on Google Play <ArrowUpRight className="w-3.5 h-3.5" aria-hidden="true" /></a>
              </div>
            ) : (
              <div className="apx-cta">
                <StoreButton os={os} where="home" />
                {os === "android" && !IOS_APP_ID ? <small className="apx-also">iPhone: on its way</small> : null}
              </div>
            )}
            <p className="apx-foot" aria-hidden="true"><span>KANAAN</span><span>kanaanshop.com/app</span></p>
          </div>
        </div>
        <div className="apx-stage" aria-hidden="true">
          <div className="apx-phone">
            <div className="apx-screen">
              <div className="apx-bar"><img src={LOGO} alt="" width="640" height="118" /><OpenNow className="apx-open" /></div>
              <img className="apx-shot" src={APP_HOME} alt="" width="520" height="947" loading="lazy" decoding="async" />
            </div>
          </div>
          <span className="apx-sticker"><b>{iosWaiting ? "Android" : "Free"}</b><b>{iosWaiting ? "first" : "to get"}</b></span>
        </div>
      </div>
    </section>
  );
}

/* No back-ticks inside this block. */
export const APP_PROMO_CSS = `
.app-banner { display: flex; align-items: center; gap: 10px; margin: 10px 12px 0; padding: 8px 10px 8px 4px; border-radius: 18px; background: var(--bg-soft); border: 1px solid var(--border); box-shadow: 0 6px 20px rgba(20,20,26,.06); }
@media (min-width: 640px) { .app-banner { max-width: 72rem; margin: 12px auto 0; width: calc(100% - 48px); } }
.app-banner .apb-x { width: 32px; height: 44px; display: grid; place-items: center; color: var(--fg-muted); flex-shrink: 0; border-radius: 12px; }
.app-banner .apb-icon { width: 44px; height: 44px; border-radius: 11px; flex-shrink: 0; box-shadow: 0 2px 8px rgba(255,69,34,.28); }
.app-banner .apb-words { flex: 1; min-width: 0; display: flex; flex-direction: column; line-height: 1.25; }
.app-banner .apb-words b { font-family: 'Space Grotesk', sans-serif; font-weight: 700; font-size: 15px; color: var(--fg); }
.app-banner .apb-words span { font-family: 'Inter', sans-serif; font-size: 12px; color: var(--fg-muted); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.app-banner .apb-get { flex-shrink: 0; height: 36px; padding: 0 15px; display: inline-flex; align-items: center; border-radius: 999px; background: var(--fg); color: var(--bg); font-family: 'Inter', sans-serif; font-weight: 600; font-size: 13.5px; }

.apx { --paper: #F7F4EE; --ink: #14141A; --wall: color-mix(in srgb, var(--fg) 7%, var(--bg)); --steel: #1B1B21; position: relative; overflow: hidden; border-radius: 28px; background: linear-gradient(180deg, color-mix(in srgb, var(--bg-soft) 55%, var(--wall)) 0%, var(--wall) 100%); border: 1px solid var(--border); padding: 0 18px; display: grid; grid-template-columns: minmax(0, 1fr); justify-items: center; }
[data-theme="dark"] .apx { --steel: #C9C9D1; }
.apx-rail { position: absolute; left: 0; right: 0; top: 30px; height: 6px; background: var(--steel); }
.apx-post { position: absolute; left: 50%; top: 0; width: 8px; height: 34px; margin-left: -4px; background: var(--steel); }
.apx-hang { position: relative; z-index: 2; width: 100%; max-width: 400px; padding-top: 36px; transform-origin: 50% 33px; transform: rotate(-1.2deg); filter: drop-shadow(0 14px 22px rgba(20,20,26,.16)); }
.apx.is-seen .apx-hang { animation: apxSwing 1.5s cubic-bezier(.3,.6,.3,1) both; }
@keyframes apxSwing { 0% { transform: rotate(-5deg); } 35% { transform: rotate(2deg); } 65% { transform: rotate(-2deg); } 100% { transform: rotate(-1.2deg); } }
.apx-string { display: block; width: 1.5px; height: 40px; margin: 0 auto -9px; background: var(--steel); opacity: .8; }
.apx-tag { position: relative; background: var(--paper); color: var(--ink); padding: 34px 22px 16px; clip-path: polygon(16px 0, calc(100% - 16px) 0, 100% 16px, 100% 100%, 0 100%, 0 16px); border-radius: 0 0 10px 10px; }
.apx-eye { position: absolute; left: 50%; top: 10px; width: 12px; height: 12px; margin-left: -6px; border-radius: 50%; background: var(--wall); box-shadow: 0 0 0 2px #B9B6AE; }
.apx-id { display: flex; align-items: center; gap: 10px; }
.apx-id img { width: 40px; height: 40px; border-radius: 10px; }
.apx-id span { display: flex; flex-direction: column; line-height: 1.25; }
.apx-id b { font-family: 'Space Grotesk', sans-serif; font-weight: 700; font-size: 15px; }
.apx-id small { font-family: 'Inter', sans-serif; font-size: 12px; color: rgba(20,20,26,.62); }
.apx-title { font-family: 'Space Grotesk', sans-serif; font-weight: 700; font-size: 30px; line-height: 1.05; letter-spacing: -.02em; margin: 18px 0 16px; max-width: 11em; }
.apx-rows > div { display: flex; align-items: baseline; gap: 8px; padding: 9px 0; border-top: 1px solid rgba(20,20,26,.1); font-size: 14px; }
.apx-rows > div:last-child { border-bottom: 1px solid rgba(20,20,26,.1); }
.apx-rows dt { font-family: 'Inter', sans-serif; font-weight: 500; }
.apx-rows i { flex: 1; min-width: 12px; border-bottom: 1.5px dotted rgba(20,20,26,.28); transform: translateY(-3px); }
.apx-rows dd { font-family: 'Space Grotesk', sans-serif; font-weight: 600; white-space: nowrap; }
.apx-cta { display: flex; flex-wrap: wrap; align-items: center; gap: 12px 14px; margin-top: 18px; }
.apx-store { display: inline-flex; align-items: center; gap: 10px; height: 52px; padding: 0 20px 0 16px; border-radius: 14px; background: var(--ink); color: #fff; }
.apx-store-ic { width: 20px; height: 20px; fill: currentColor; }
.apx-store span { display: flex; flex-direction: column; line-height: 1.1; text-align: left; }
.apx-store small { font-family: 'Inter', sans-serif; font-size: 11px; opacity: .78; }
.apx-store b { font-family: 'Space Grotesk', sans-serif; font-weight: 600; font-size: 18px; letter-spacing: -.01em; }
.apx-also { font-family: 'Inter', sans-serif; font-size: 12.5px; color: rgba(20,20,26,.62); }
.apx-soon { display: flex; align-items: flex-start; gap: 10px; width: 100%; }
.apx-soon > i { width: 9px; height: 9px; margin-top: 6px; border-radius: 50%; background: #FF4522; flex-shrink: 0; }
.apx-soon span { display: flex; flex-direction: column; gap: 2px; }
.apx-soon b { font-family: 'Space Grotesk', sans-serif; font-weight: 700; font-size: 17px; }
.apx-soon small { font-family: 'Inter', sans-serif; font-size: 13px; color: rgba(20,20,26,.62); }
.apx-link { display: inline-flex; align-items: center; gap: 4px; min-height: 44px; font-family: 'Inter', sans-serif; font-weight: 600; font-size: 13.5px; color: var(--ink); text-decoration: underline; text-underline-offset: 3px; }
.apx-cta-desk { flex-wrap: nowrap; align-items: stretch; }
.apx-qr { flex-shrink: 0; padding: 6px; background: #fff; border-radius: 12px; border: 1px solid rgba(20,20,26,.1); line-height: 0; }
.apx-scan { display: flex; flex-direction: column; align-items: flex-start; gap: 3px; }
.apx-scan > b { font-family: 'Space Grotesk', sans-serif; font-weight: 600; font-size: 15px; }
.apx-scan > small { font-family: 'Inter', sans-serif; font-size: 12.5px; color: rgba(20,20,26,.62); }
.apx-scan .apx-store { margin-top: auto; height: 46px; }
.apx-scan .apx-store b { font-size: 16px; }
.apx-foot { display: flex; justify-content: space-between; margin-top: 18px; font-family: 'Space Grotesk', sans-serif; font-size: 10.5px; color: rgba(20,20,26,.55); }
.apx-foot span:first-child { letter-spacing: .32em; font-weight: 700; color: var(--ink); }

.apx-stage { position: relative; z-index: 1; width: 236px; height: 300px; margin-top: 30px; }
.apx-phone { --fg: #14141A; --fg-muted: rgba(20,20,26,.62); --logo-filter: none; width: 236px; padding: 7px; border-radius: 36px; background: #14141A; box-shadow: 0 24px 40px rgba(20,20,26,.22), inset 0 0 0 1.5px #3A3A44; }
.apx-screen { border-radius: 29px; overflow: hidden; background: #F2F2F4; }
.apx-bar { display: flex; align-items: center; justify-content: space-between; padding: 20px 11px 8px; }
.apx-bar img { height: 11px; width: auto; }
.apx-bar .apx-open { font-size: 7.5px; gap: 4px; }
.apx-bar .apx-open i { width: 4.5px; height: 4.5px; animation: none; box-shadow: none; }
.apx-shot { display: block; width: 100%; height: auto; }
.apx-sticker { position: absolute; left: -34px; top: 96px; width: 78px; height: 78px; border-radius: 50%; display: flex; flex-direction: column; align-items: center; justify-content: center; background: #FF4522; color: #fff; transform: rotate(-12deg); outline: 1.5px dashed rgba(255,255,255,.85); outline-offset: -6px; font-family: 'Space Grotesk', sans-serif; font-weight: 700; font-size: 14px; line-height: 1.05; box-shadow: 0 8px 18px rgba(255,69,34,.3); }

@media (min-width: 860px) {
  .apx { grid-template-columns: minmax(0, 1fr) 320px; padding: 0 56px 0 64px; align-items: start; justify-items: start; min-height: 520px; }
  .apx-post { left: 30%; }
  .apx-hang { max-width: 440px; padding-bottom: 56px; }
  .apx-tag { padding: 38px 28px 18px; }
  .apx-title { font-size: 38px; }
  .apx-stage { justify-self: center; align-self: end; width: 264px; height: 440px; margin-top: 70px; }
  .apx-phone { width: 264px; }
  .apx-bar { padding: 22px 12px 9px; }
  .apx-bar img { height: 12.5px; }
  .apx-bar .apx-open { font-size: 8.5px; }
  .apx-sticker { width: 88px; height: 88px; font-size: 15.5px; left: -42px; top: 120px; }
}
@media (prefers-reduced-motion: reduce) { .apx.is-seen .apx-hang { animation: none; } }
`;
