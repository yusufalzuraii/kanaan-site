/* ============================================================
   THE SHOP'S CUSTOMERS ON THE SITE (2.0)
   ------------------------------------------------------------
   WhatsAppProof   one WhatsApp message proves a number: the page shows
                   the message as it will look ("KANAAN 482913" to Kanaan
                   Shop), the shopper presses send in WhatsApp, the shop
                   computer reads it and the page goes on by itself (the
                   ticks turn teal). Nothing to type, no SMS.
   BackInStock     under a sold-out size: "Tell me when it's back" — the
                   shop's WhatsApp tells them, with the photo and the link.
   AccountPage     /account, "My Kanaan": their orders and where each one
                   is, what they bought in the shop in Saida (from their
                   file in Kanaan POS), the sizes they wait for.
   TrackPage       /order/<number>?t=… — the order's own page, linked from
                   every WhatsApp message about it.
   AccountLink     the little person in the header (from tablets up; on a
                   phone it is in the menu).
   useMemberSync   while signed in, the hearts and the bag reach the shop
                   (its program shows them in the customer's file).
   The server side: functions/_shared/members.js, /api/verify, /api/me,
   /api/track. The website only (the app keeps its own notifications).
   ============================================================ */
import React, { useCallback, useEffect, useRef, useState } from "react";
import { Bell, BellRing, Check, CheckCheck, ChevronRight, Clock3, Heart, LogOut, MessageCircle, Package, PackageCheck, ReceiptText, Store, Truck, X, Home as HomeIcon, ShoppingBag, LoaderCircle, Ban } from "lucide-react";
import { COLORS } from "../palette.js";

const API = "";
const colorName = (k) => (COLORS[k] && COLORS[k].label) || String(k || "").replace(/[-_]+/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
const prettyShop = (d) => { const s = String(d || ""); return s.startsWith("961") ? `+961 ${s.slice(3, s.length - 6)} ${s.slice(-6, -3)} ${s.slice(-3)}` : `+${s}`; };
const money = (n) => `$${Math.round(Number(n) || 0)}`;
const day = (ms) => (ms ? new Date(ms).toLocaleDateString("en-GB", { day: "numeric", month: "short" }) : "");
const dayYear = (ms) => (ms ? new Date(ms).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" }) : "");
const time = (ms) => (ms ? new Date(ms).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" }) : "");
const ymd = (s) => { const d = s ? new Date(`${String(s).slice(0, 10)}T12:00:00`) : null; return d && !isNaN(d) ? d.getTime() : 0; };
const reduced = () => typeof window !== "undefined" && window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;

/* ---------- who is signed in (one fetch for every part of the page) ---------- */
const me = { data: undefined, subs: new Set(), busy: null };
const tell = () => { for (const f of me.subs) f(me.data); };
export function loadMe(force = false) {
  if (me.busy && !force) return me.busy;
  me.busy = fetch(`${API}/api/me`, { credentials: "same-origin", cache: "no-store" })
    .then((r) => r.json()).then((d) => { me.data = d && typeof d === "object" ? d : { signedIn: false }; tell(); return me.data; })
    .catch(() => { if (me.data === undefined) { me.data = { signedIn: false, offline: true }; tell(); } return me.data; })
    .finally(() => { setTimeout(() => { me.busy = null; }, 50); });
  return me.busy;
}
/** undefined while loading, then { signedIn: false } or the shopper ({ signedIn, name, phone, orders, shop, asks }). */
export function useMe(enabled = true) {
  const [d, setD] = useState(me.data);
  useEffect(() => {
    if (!enabled) return undefined;
    me.subs.add(setD); if (me.data === undefined) loadMe(); else setD(me.data);
    return () => { me.subs.delete(setD); };
  }, [enabled]);
  return enabled ? d : undefined;
}

/* ============================================================
   ONE WHATSAPP MESSAGE PROVES THE NUMBER
   ============================================================ */
export function WhatsAppProof({ purpose, payload = null, onDone, title, lead }) {
  const [v, setV] = useState(null); // { code, token, url, number, expiresAt }
  const [state, setState] = useState("loading"); // loading | ready | waiting | done | expired | error
  const [err, setErr] = useState("");
  const [left, setLeft] = useState(0);
  const timer = useRef(null);
  const start = useCallback(async () => {
    setState("loading"); setErr("");
    try {
      const r = await fetch(`${API}/api/verify`, { method: "POST", credentials: "same-origin", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ purpose, payload }) });
      const d = await r.json().catch(() => ({}));
      if (!r.ok) { setErr(d.error || "Something went wrong — try again."); setState("error"); return; }
      setV(d); setState("ready");
    } catch { setErr("No connection — check the internet and try again."); setState("error"); }
  }, [purpose, JSON.stringify(payload)]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { start(); }, [start]);

  // asking how it went: every 2 s while waiting, and the moment they come back from WhatsApp
  useEffect(() => {
    if (!v || (state !== "ready" && state !== "waiting")) return undefined;
    let gone = false;
    const ask = async () => {
      if (gone || document.hidden) return;
      try {
        const r = await fetch(`${API}/api/verify?token=${encodeURIComponent(v.token)}`, { credentials: "same-origin", cache: "no-store" });
        const d = await r.json();
        if (gone) return;
        if (d.state === "verified") { setState("done"); await loadMe(true); if (onDone) setTimeout(() => onDone(d), reduced() ? 300 : 1100); }
        else if (d.state === "expired") setState("expired");
      } catch { /* next time */ }
    };
    timer.current = setInterval(ask, 2000);
    const back = () => { if (!document.hidden) ask(); };
    document.addEventListener("visibilitychange", back);
    window.addEventListener("focus", back);
    return () => { gone = true; clearInterval(timer.current); document.removeEventListener("visibilitychange", back); window.removeEventListener("focus", back); };
  }, [v, state]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    if (!v) return undefined;
    const tick = () => { const s = Math.max(0, Math.round((v.expiresAt - Date.now()) / 1000)); setLeft(s); if (!s && (state === "ready" || state === "waiting")) setState("expired"); };
    tick(); const t = setInterval(tick, 1000);
    return () => clearInterval(t);
  }, [v, state]);

  const sent = state === "waiting" || state === "done";
  return (
    <div className={`wp ${state === "done" ? "is-done" : ""}`} data-testid="wa-proof" data-state={state}>
      {title && <h2 className="wp-title font-display">{title}</h2>}
      {lead && <p className="wp-lead">{lead}</p>}
      <div className="wp-chat" aria-hidden={state === "loading" ? "true" : undefined}>
        <div className="wp-to">
          <span className="wp-avatar"><Store size={15} /></span>
          <span className="wp-who"><b>Kanaan Shop</b><small className="font-num">{v ? prettyShop(v.number) : " "}</small></span>
        </div>
        <div className="wp-thread">
          <div className={`wp-bubble ${sent ? "is-sent" : ""}`} data-testid="wa-proof-bubble">
            <span className="font-num">{v ? `KANAAN ${v.code}` : "KANAAN ······"}</span>
            <span className={`wp-ticks ${state === "done" ? "is-read" : ""}`}>{state === "done" ? <CheckCheck size={15} /> : sent ? <Check size={15} /> : <Clock3 size={13} />}</span>
          </div>
        </div>
      </div>
      {state === "error" ? (
        <div className="wp-foot"><p className="wp-err">{err}</p><button type="button" className="wp-btn is-ink tap-scale" onClick={start}>Try again</button></div>
      ) : state === "expired" ? (
        <div className="wp-foot"><p className="wp-err">That code ran out of time.</p><button type="button" className="wp-btn is-ink tap-scale" onClick={start} data-testid="wa-proof-again">Get a new one</button></div>
      ) : state === "done" ? (
        <div className="wp-foot"><p className="wp-ok" data-testid="wa-proof-done"><Check size={16} strokeWidth={2.6} /> That's you — thank you</p><p className="wp-note">Your number is proven.</p></div>
      ) : (
        <div className="wp-foot">
          <a className={`wp-btn tap-scale ${!v ? "is-off" : ""}`} href={v ? v.url : undefined} target="_blank" rel="noopener noreferrer" onClick={() => setState("waiting")} data-testid="wa-proof-send">
            <MessageCircle size={18} /> Send it on WhatsApp
          </a>
          <p className="wp-note" aria-live="polite">
            {state === "waiting"
              ? <><span className="wp-dots" aria-hidden="true"><i /><i /><i /></span> Waiting for your message · <span className="font-num">{Math.floor(left / 60)}:{String(left % 60).padStart(2, "0")}</span></>
              : <>WhatsApp opens with the message written — just press send.</>}
          </p>
          <p className="wp-help" aria-hidden={state !== "waiting"} style={{ visibility: state === "waiting" && v ? "visible" : "hidden" }}>Didn't open? Send <b className="font-num">KANAAN {v ? v.code : ""}</b> to <b className="font-num">{v ? prettyShop(v.number) : ""}</b> on WhatsApp.</p>
        </div>
      )}
    </div>
  );
}

/* ---------- a sheet from the bottom (the site's own) ---------- */
function Sheet({ label, onClose, children, testId }) {
  useEffect(() => {
    const prev = document.body.style.overflow; document.body.style.overflow = "hidden";
    const onKey = (e) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", onKey);
    return () => { document.body.style.overflow = prev; window.removeEventListener("keydown", onKey); };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps
  return (
    <div className="fixed inset-0 z-[75] flex items-end sm:items-center justify-center" role="dialog" aria-modal="true" aria-label={label} data-testid={testId}>
      <div className="pick-backdrop absolute inset-0" onClick={onClose} />
      <div className="pick-sheet mb-sheet relative w-full sm:max-w-md rounded-t-[28px] sm:rounded-[28px] px-5 pt-4" style={{ paddingBottom: "calc(22px + env(safe-area-inset-bottom, 0px))" }}>
        <button type="button" onClick={onClose} className="mb-close glass rounded-full p-2 tap-scale" aria-label="Close" data-testid="mb-close"><X size={16} /></button>
        {children}
      </div>
    </div>
  );
}

/* ============================================================
   "TELL ME WHEN IT'S BACK" — under a sold-out size
   ============================================================ */
export function BackInStock({ product, colorKey, size, photo, onClose }) {
  const who = useMe();
  const [state, setState] = useState("idle"); // idle | sending | done | error
  const [prove, setProve] = useState(false);
  const label = colorName(colorKey);
  const asked = who && who.signedIn && (who.asks || []).some((a) => a.productId === product.id && a.colorKey === colorKey && String(a.size) === String(size) && !a.back);
  const done = state === "done" || asked;
  useEffect(() => { setState("idle"); }, [product.id, colorKey, size]);
  const go = async () => {
    if (!who || !who.signedIn) { setProve(true); return; }
    setState("sending");
    try {
      const r = await fetch(`${API}/api/me/asks`, { method: "POST", credentials: "same-origin", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ productId: product.id, color: colorKey, size }) });
      if (r.status === 401) { setState("idle"); setProve(true); return; }
      if (!r.ok) throw new Error("x");
      setState("done"); loadMe(true);
    } catch { setState("error"); }
  };
  return (
    <div className={`bis ${done ? "is-done" : ""}`} data-testid="back-in-stock" role="status">
      <span className="bis-ic">{done ? <BellRing size={17} /> : <Bell size={17} />}</span>
      <div className="bis-txt">
        <b>{done ? `We'll WhatsApp you` : `${size} in ${label} is sold out`}</b>
        <span>{done ? <>The minute {size} in {label} is back{who && who.phone ? <> · <span className="bis-ph font-num">{who.phone}</span></> : null}</> : state === "error" ? "That didn't go through — try again." : "Want a message the minute it's back?"}</span>
      </div>
      {!done && <button type="button" className="bis-btn tap-scale" onClick={go} disabled={state === "sending"} data-testid="back-in-stock-ask">{state === "sending" ? <LoaderCircle size={15} className="mb-spin" /> : "Tell me"}</button>}
      {onClose && <button type="button" className="bis-x" onClick={onClose} aria-label="Close"><X size={14} /></button>}
      {prove && (
        <Sheet label="Tell me when it's back" onClose={() => setProve(false)} testId="back-in-stock-sheet">
          <div className="mb-piece">
            {photo ? <img src={photo} alt="" /> : <span className="mb-piece-ph"><Package size={18} /></span>}
            <div><b>{product.name}</b><span>{label} · Size <span className="font-num">{size}</span></span></div>
          </div>
          <WhatsAppProof purpose="notify" payload={{ productId: product.id, color: colorKey, size }} title="Tell me when it's back" lead="One WhatsApp to us and you're on the list. When it's back, you get a message with the photo and the link — nothing else." onDone={() => { setProve(false); setState("done"); }} />
        </Sheet>
      )}
    </div>
  );
}

/* ============================================================
   MY KANAAN — /account
   ============================================================ */
const STAGES = [
  { key: "received", word: "Received", Icon: ReceiptText },
  { key: "confirmed", word: "Confirmed", Icon: PackageCheck },
  { key: "shipped", word: "On its way", Icon: Truck },
  { key: "delivered", word: "Delivered", Icon: HomeIcon },
];
const stageWord = (s) => (s === "cancelled" ? "Cancelled" : (STAGES.find((x) => x.key === s) || STAGES[0]).word);
const orderLink = (o) => `/order/${o.id}?t=${encodeURIComponent(o.track || "")}`;

export function AccountPage({ navigate }) {
  const who = useMe();
  const [bye, setBye] = useState(false);
  useEffect(() => { document.title = "My Kanaan — Kanaan Shop"; loadMe(true); }, []);
  const go = (to) => (e) => { if (e) e.preventDefault(); if (navigate) navigate(to); else window.location.href = to; };
  if (who === undefined) return <div className="mk" data-testid="account"><div className="mk-wait"><i /><i /><i /></div></div>;
  if (!who.signedIn) {
    return (
      <div className="mk" data-testid="account">
        <header className="mk-hero is-guest">
          <p className="mk-eyebrow">Kanaan Shop · Saida</p>
          <h1 className="font-display">My Kanaan</h1>
          <p className="mk-lead">Your orders and where each one is, what you bought at the shop, the sizes you're waiting for — on one page. No password: your WhatsApp is the key.</p>
        </header>
        <div className="mk-card mk-signin" data-testid="account-signin">
          <WhatsAppProof purpose="login" title="Sign in with one WhatsApp" lead="We read the message and this page opens by itself. We only use your number for your orders." />
        </div>
        <ul className="mk-why">
          <li><Truck size={16} /> Follow every order to your door</li>
          <li><Store size={16} /> The pieces you bought in Saida, in one place</li>
          <li><BellRing size={16} /> A WhatsApp when your size is back</li>
        </ul>
      </div>
    );
  }
  const signOut = async () => { await fetch(`${API}/api/me`, { method: "DELETE", credentials: "same-origin" }).catch(() => {}); await loadMe(true); setBye(false); };
  const shop = who.shop;
  const asks = (who.asks || []);
  return (
    <div className="mk" data-testid="account">
      <header className="mk-hero">
        <p className="mk-eyebrow">My Kanaan</p>
        <h1 className="font-display" data-testid="account-hello">{who.name ? `Hi ${who.name.split(" ")[0]}` : "Hi there"}</h1>
        <p className="mk-lead"><span className="font-num">{who.phone}</span>{shop && shop.since ? <> · with us since {dayYear(ymd(shop.since))}</> : null}</p>
      </header>

      <section className="mk-sec" data-testid="account-orders">
        <h2 className="font-display">Your orders</h2>
        {who.orders.length === 0 ? (
          <p className="mk-empty">No orders on the website yet. <a href="/shop" onClick={go("/shop")}>Have a look at the shop</a></p>
        ) : (
          <div className="mk-orders">
            {who.orders.map((o) => (
              <a key={o.id} className="mk-order tap-scale" href={orderLink(o)} onClick={go(orderLink(o))} data-testid={`account-order-${o.id}`}>
                <span className="mk-thumbs">{o.items.slice(0, 3).map((i, n) => (i.image ? <img key={n} src={i.image} alt="" /> : <span key={n} className="mk-thumb-ph"><Package size={14} /></span>))}</span>
                <span className="mk-o-mid">
                  <b className="font-num">#{o.id}</b>
                  <small>{day(o.at)} · {o.pieces} {o.pieces === 1 ? "piece" : "pieces"} · <span className="font-num">{money(o.total)}</span></small>
                </span>
                <span className={`mk-stage is-${o.stage}`}>{stageWord(o.stage)}</span>
                <ChevronRight size={16} className="mk-chev" />
              </a>
            ))}
          </div>
        )}
      </section>

      {asks.length > 0 && (
        <section className="mk-sec" data-testid="account-asks">
          <h2 className="font-display">Waiting for your size</h2>
          <div className="mk-asks">
            {asks.map((a) => <AskRow key={a.id} a={a} go={go} />)}
          </div>
        </section>
      )}

      <section className="mk-sec" data-testid="account-shop">
        <h2 className="font-display">From the shop in Saida</h2>
        {shop && shop.pieces && shop.pieces.length ? (
          <>
            <p className="mk-sub"><span className="font-num">{shop.visits}</span> {shop.visits === 1 ? "visit" : "visits"}{shop.last ? <> · last on {dayYear(ymd(shop.last))}</> : null}</p>
            <div className="mk-pieces">
              {shop.pieces.map((p, i) => {
                const inner = <>{p.image ? <img src={p.image} alt="" /> : <span className="mk-piece-ph"><ShoppingBag size={16} /></span>}<span><b>{p.name}</b><small>{[p.color, p.size && `Size ${p.size}`, p.at && day(ymd(p.at))].filter(Boolean).join(" · ")}</small></span></>;
                return p.productId
                  ? <a key={i} className="mk-piece tap-scale" href={`/product/${p.productId}`} onClick={go(`/product/${p.productId}`)}>{inner}</a>
                  : <div key={i} className="mk-piece">{inner}</div>;
              })}
            </div>
          </>
        ) : (
          <p className="mk-empty">When you buy at the shop with this number, your pieces show here.</p>
        )}
      </section>

      <div className="mk-out">
        {!bye ? (
          <button type="button" className="mk-out-btn tap-scale" onClick={() => setBye(true)} data-testid="account-signout"><LogOut size={15} /> Sign out on this device</button>
        ) : (
          <div className="mk-out-ask" data-testid="account-signout-ask">
            <span>Sign out here? Your orders stay — one WhatsApp brings you back.</span>
            <button type="button" className="mk-out-btn" onClick={() => setBye(false)}>Stay</button>
            <button type="button" className="mk-out-btn is-ink" onClick={signOut} data-testid="account-signout-yes">Sign out</button>
          </div>
        )}
      </div>
    </div>
  );
}

function AskRow({ a, go }) {
  const [gone, setGone] = useState(false);
  const [ask, setAsk] = useState(false);
  if (gone) return null;
  const drop = async () => { setGone(true); await fetch(`${API}/api/me/asks?id=${encodeURIComponent(a.id)}`, { method: "DELETE", credentials: "same-origin" }).catch(() => {}); loadMe(true); };
  return (
    <div className={`mk-ask ${a.back ? "is-back" : ""}`} data-testid={`account-ask-${a.size}`}>
      <a href={`/product/${a.productId}`} onClick={go(`/product/${a.productId}`)} className="mk-ask-main">
        {a.image ? <img src={a.image} alt="" /> : <span className="mk-piece-ph"><Package size={16} /></span>}
        <span><b>{a.name}</b><small>{colorName(a.colorKey)} · Size <span className="font-num">{a.size}</span></small></span>
      </a>
      {a.back ? <span className="mk-stage is-delivered">It's back</span> : <span className="mk-stage is-wait"><Bell size={12} /> Waiting</span>}
      {!ask ? (
        <button type="button" className="mk-ask-x" onClick={() => setAsk(true)} aria-label="Take it off the list"><X size={14} /></button>
      ) : (
        <span className="mk-ask-sure"><button type="button" onClick={() => setAsk(false)}>Keep</button><button type="button" className="is-ink" onClick={drop}>Remove</button></span>
      )}
    </div>
  );
}

/* ============================================================
   THE ORDER'S OWN PAGE — /order/<number>?t=…
   ============================================================ */
export function TrackPage({ id, t, navigate }) {
  const [o, setO] = useState(null);
  const load = useCallback(() => fetch(`${API}/api/track?id=${encodeURIComponent(id)}&t=${encodeURIComponent(t || "")}`, { cache: "no-store" })
    .then(async (r) => { const d = await r.json().catch(() => ({})); setO(r.ok ? d : { error: d.error || "We couldn't find this order." }); })
    .catch(() => setO((x) => x || { error: "No connection — check the internet and open the link again.", offline: true })), [id, t]);
  useEffect(() => { document.title = `Order #${id} — Kanaan Shop`; load(); const k = setInterval(load, 60000); return () => clearInterval(k); }, [load, id]);
  const go = (to) => (e) => { if (e) e.preventDefault(); if (navigate) navigate(to); else window.location.href = to; };
  if (!o) return <div className="mk" data-testid="track"><div className="mk-wait"><i /><i /><i /></div></div>;
  if (o.error) {
    return (
      <div className="mk" data-testid="track">
        <div className="mk-card mk-oops" data-testid="track-error">
          <span className="mk-oops-ic"><Package size={22} /></span>
          <h1 className="font-display">{o.offline ? "No connection" : "We couldn't find this order"}</h1>
          <p>{o.error}</p>
          <a className="wp-btn is-ink tap-scale" href="/account" onClick={go("/account")}>Go to My Kanaan</a>
        </div>
      </div>
    );
  }
  const cancelled = o.stage === "cancelled";
  const at = STAGES.findIndex((s) => s.key === o.stage);
  const big = cancelled ? "Cancelled" : o.stage === "delivered" ? "Delivered" : o.stage === "shipped" ? "On its way to you" : o.stage === "confirmed" ? "Confirmed — we're getting it ready" : "We got your order";
  const line = cancelled ? "This order didn't go ahead. Message us and we'll find you another size or colour." : o.stage === "delivered" ? "Enjoy your pieces — the right size or not, tell us on WhatsApp." : o.stage === "shipped" ? "The driver calls before arriving. Pay in cash at your door." : o.stage === "confirmed" ? "It leaves with the driver soon — we'll message you on WhatsApp." : "We'll confirm it on WhatsApp very soon.";
  const ask = `https://wa.me/${o.shop}?text=${encodeURIComponent(`Hi Kanaan Shop, about my order #${o.id}`)}`;
  return (
    <div className="mk" data-testid="track">
      <header className="mk-hero">
        <p className="mk-eyebrow">Order <span className="font-num">#{o.id}</span>{o.name ? ` · ${o.name}` : ""}</p>
        <h1 className="font-display" data-testid="track-stage">{big}</h1>
        <p className="mk-lead">{line}</p>
      </header>
      <ol className={`trk ${cancelled ? "is-cancelled" : ""}`} data-testid="track-steps">
        {STAGES.map((s, i) => {
          const when = o.at[s.key];
          const state = cancelled ? (when ? "done" : "off") : i < at || o.stage === "delivered" ? "done" : i === at ? "now" : "next";
          return (
            <li key={s.key} className={`trk-step is-${state}`} data-testid={`track-${s.key}`} data-state={state}>
              <span className="trk-dot"><s.Icon size={16} /></span>
              <span className="trk-txt"><b>{s.word}</b><small className="font-num">{when ? `${day(when)} · ${time(when)}` : state === "next" ? " " : ""}</small></span>
            </li>
          );
        })}
        {cancelled && (
          <li className="trk-step is-stop" data-testid="track-cancelled">
            <span className="trk-dot"><Ban size={16} /></span>
            <span className="trk-txt"><b>Cancelled</b><small className="font-num">{o.at.cancelled ? `${day(o.at.cancelled)} · ${time(o.at.cancelled)}` : ""}</small></span>
          </li>
        )}
      </ol>
      <section className="mk-card trk-items">
        {o.items.map((i, n) => (
          <a key={n} className="trk-item" href={`/product/${i.productId}`} onClick={go(`/product/${i.productId}`)}>
            {i.image ? <img src={i.image} alt="" /> : <span className="mk-piece-ph"><Package size={16} /></span>}
            <span className="trk-item-mid"><b>{i.name}</b><small>{[i.color, i.size && `Size ${i.size}`, i.qty > 1 && `× ${i.qty}`].filter(Boolean).join(" · ")}</small></span>
            <span className="font-num trk-price">{money(i.price * i.qty)}</span>
          </a>
        ))}
        <div className="trk-sum">
          <span>Pieces</span><span className="font-num">{money(o.subtotal)}</span>
          {o.discount > 0 && <><span>First order</span><span className="font-num" style={{ color: "var(--teal-text)" }}>−{money(o.discount)}</span></>}
          <span>Delivery{o.area ? ` · ${o.area}` : ""}</span><span className="font-num">{o.delivery ? money(o.delivery) : "Free"}</span>
          <b>{cancelled ? "Total" : o.stage === "delivered" ? "Paid at the door" : "To pay at the door"}</b><b className="font-num">{money(o.total)}</b>
        </div>
      </section>
      <div className="trk-acts">
        <a className="wp-btn tap-scale" href={ask} target="_blank" rel="noopener noreferrer"><MessageCircle size={18} /> Ask about this order</a>
        <a className="mk-out-btn tap-scale" href="/account" onClick={go("/account")}><Heart size={15} /> My Kanaan</a>
      </div>
    </div>
  );
}

/* ---------- the header's little person (from tablets up) ---------- */
export function AccountLink({ navigate, className = "" }) {
  const who = useMe();
  const on = who && who.signedIn;
  return (
    <button type="button" onClick={() => navigate("/account")} className={`relative p-2 tap-scale hover:text-coral transition-colors ${className}`} aria-label={on ? "My Kanaan" : "Sign in — My Kanaan"} data-testid="account-link">
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><circle cx="12" cy="8" r="4" /><path d="M4 21c1.6-3.6 4.5-5.4 8-5.4s6.4 1.8 8 5.4" /></svg>
      {on && <span className="mk-on-dot" aria-hidden="true" />}
    </button>
  );
}

/** While signed in: the hearts and the bag reach the shop's customer file (a moment after each change). */
export function useMemberSync(likes, cart, enabled = true) {
  const who = useMe(enabled);
  const on = !!(who && who.signedIn);
  const last = useRef("");
  useEffect(() => {
    if (!on) return undefined;
    const body = JSON.stringify({ likes: (likes || []).slice(0, 60), bag: (cart || []).slice(0, 30).map((i) => ({ productId: i.productId, colorKey: i.colorKey, size: i.size, qty: i.qty })) });
    if (body === last.current) return undefined;
    const t = setTimeout(() => {
      last.current = body;
      fetch(`${API}/api/me`, { method: "PUT", credentials: "same-origin", headers: { "Content-Type": "application/json" }, body }).catch(() => { last.current = ""; });
    }, 1500);
    return () => clearTimeout(t);
  }, [on, JSON.stringify(likes || []), JSON.stringify((cart || []).map((i) => [i.productId, i.colorKey, i.size, i.qty]))]); // eslint-disable-line react-hooks/exhaustive-deps
}

export const MEMBERS_CSS = `
.wp { display: flex; flex-direction: column; gap: 14px; }
.wp-title { font-size: 21px; font-weight: 700; line-height: 1.2; margin: 0; padding-right: 36px; text-wrap: balance; }
.wp-lead { margin: -6px 0 0; font-size: 14px; line-height: 1.55; color: var(--fg-muted); }
.wp-chat { border-radius: 22px; background: var(--bg); border: 1px solid var(--border); overflow: hidden; }
.wp-to { display: flex; align-items: center; gap: 10px; padding: 10px 14px; border-bottom: 1px solid var(--border); background: var(--bg-soft); }
.wp-avatar { width: 30px; height: 30px; border-radius: 999px; display: grid; place-items: center; color: #fff; background: var(--coral); flex-shrink: 0; }
.wp-who { display: flex; flex-direction: column; line-height: 1.2; min-width: 0; }
.wp-who b { font-size: 13.5px; }
.wp-who small { font-size: 12px; color: var(--fg-muted); }
.wp-thread { padding: 18px 14px 16px; display: flex; justify-content: flex-end; min-height: 76px; background-image: radial-gradient(color-mix(in srgb, var(--fg) 6%, transparent) 1px, transparent 1px); background-size: 14px 14px; }
.wp-bubble { display: inline-flex; align-items: flex-end; gap: 10px; padding: 10px 12px 9px 14px; border-radius: 18px 18px 6px 18px; background: color-mix(in srgb, var(--teal) 20%, var(--bg-soft)); border: 1px solid color-mix(in srgb, var(--teal) 32%, transparent); font-size: 17px; letter-spacing: .06em; font-weight: 600; transition: transform .35s cubic-bezier(.16,1,.3,1); }
.wp-bubble.is-sent { transform: translateY(-2px); }
.wp-ticks { display: inline-flex; color: var(--fg-muted); width: 16px; justify-content: center; }
.wp-ticks.is-read { color: var(--teal-text); }
.wp-foot { display: flex; flex-direction: column; gap: 10px; align-items: stretch; min-height: 148px; }
.wp-btn { display: inline-flex; align-items: center; justify-content: center; gap: 8px; min-height: 50px; padding: 0 22px; border-radius: 999px; font-weight: 600; font-size: 15px; background: var(--teal); color: #062420; text-decoration: none; border: 0; cursor: pointer; }
.wp-btn.is-ink { background: var(--fg); color: var(--bg); }
.wp-btn.is-off { opacity: .55; pointer-events: none; }
.wp-note { margin: 0; text-align: center; font-size: 13px; line-height: 1.5; color: var(--fg-muted); min-height: 40px; display: flex; align-items: center; justify-content: center; gap: 6px; }
.wp-help { margin: -4px 0 0; text-align: center; font-size: 12.5px; color: var(--fg-muted); line-height: 1.5; min-height: 38px; }
.wp-err { margin: 0; text-align: center; font-size: 13.5px; color: var(--coral-text); }
.wp-ok { margin: 0; display: flex; align-items: center; justify-content: center; gap: 6px; min-height: 50px; border-radius: 999px; font-weight: 600; color: var(--teal-text); background: color-mix(in srgb, var(--teal) 14%, transparent); }
.wp-dots { display: inline-flex; gap: 3px; }
.wp-dots i { width: 5px; height: 5px; border-radius: 9px; background: var(--teal); animation: wpDot 1.2s ease-in-out infinite; }
.wp-dots i:nth-child(2) { animation-delay: .15s; } .wp-dots i:nth-child(3) { animation-delay: .3s; }
@keyframes wpDot { 0%, 80%, 100% { opacity: .25; transform: translateY(0); } 40% { opacity: 1; transform: translateY(-2px); } }

.mb-sheet { max-height: 92vh; overflow-y: auto; }
.mb-close { position: absolute; top: 14px; right: 14px; z-index: 2; }
.mb-piece { display: flex; align-items: center; gap: 12px; margin: 0 44px 16px 0; }
.mb-piece img, .mb-piece-ph { width: 48px; height: 60px; border-radius: 14px; object-fit: cover; background: var(--field-bg); flex-shrink: 0; display: grid; place-items: center; color: var(--fg-muted); }
.mb-piece div { display: flex; flex-direction: column; min-width: 0; }
.mb-piece b { font-size: 14.5px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.mb-piece span { font-size: 13px; color: var(--fg-muted); }
.mb-spin { animation: mbSpin 1s linear infinite; }
@keyframes mbSpin { to { transform: rotate(360deg); } }

.bis { position: relative; display: grid; grid-template-columns: 36px minmax(0, 1fr) auto; align-items: center; gap: 12px; margin-top: 12px; padding: 12px 14px; border-radius: 20px; background: var(--bg-soft); border: 1px solid var(--border); }
.bis.is-done { border-color: color-mix(in srgb, var(--teal) 40%, transparent); background: color-mix(in srgb, var(--teal) 9%, var(--bg-soft)); }
.bis-ic { width: 36px; height: 36px; border-radius: 999px; display: grid; place-items: center; color: var(--coral-text); background: color-mix(in srgb, var(--coral) 12%, transparent); }
.bis.is-done .bis-ic { color: var(--teal-text); background: color-mix(in srgb, var(--teal) 16%, transparent); }
.bis-txt { display: flex; flex-direction: column; min-width: 0; line-height: 1.35; }
.bis-txt b { font-size: 14px; }
.bis-txt > span { font-size: 12.5px; color: var(--fg-muted); }
.bis-ph { white-space: nowrap; }
.bis-btn { height: 38px; min-width: 84px; padding: 0 16px; border-radius: 999px; background: var(--fg); color: var(--bg); font-weight: 600; font-size: 13.5px; display: inline-flex; align-items: center; justify-content: center; }
.bis-x { position: absolute; top: -8px; right: -8px; width: 24px; height: 24px; border-radius: 999px; display: grid; place-items: center; background: var(--bg-soft); border: 1px solid var(--border); color: var(--fg-muted); }
.bis.is-done { grid-template-columns: 36px minmax(0, 1fr); }

.mk { max-width: 720px; margin: 0 auto; padding: 28px 16px 120px; display: flex; flex-direction: column; gap: 22px; }
.mk-hero { padding: 6px 2px 0; }
.mk-eyebrow { margin: 0 0 6px; font-size: 13px; color: var(--fg-muted); font-weight: 500; }
.mk-hero h1 { margin: 0; font-size: clamp(28px, 7vw, 40px); font-weight: 700; line-height: 1.08; letter-spacing: -.01em; text-wrap: balance; }
.mk-lead { margin: 10px 0 0; font-size: 15px; line-height: 1.6; color: var(--fg-muted); max-width: 56ch; }
.mk-card { border-radius: 26px; padding: 20px; background: var(--bg-soft); border: 1px solid var(--border); }
.mk-signin { padding: 20px 18px; }
.mk-why { list-style: none; margin: 0; padding: 0 4px; display: flex; flex-direction: column; gap: 10px; font-size: 14px; }
.mk-why li { display: flex; align-items: center; gap: 10px; }
.mk-why svg { color: var(--teal-text); flex-shrink: 0; }
.mk-sec h2 { margin: 0 0 12px; font-size: 18px; font-weight: 600; }
.mk-sub { margin: -6px 0 12px; font-size: 13.5px; color: var(--fg-muted); }
.mk-empty { margin: 0; padding: 16px 18px; border-radius: 20px; border: 1px dashed var(--border); font-size: 14px; color: var(--fg-muted); }
.mk-empty a { color: var(--coral-text); font-weight: 500; }
.mk-orders, .mk-asks, .mk-pieces { display: flex; flex-direction: column; gap: 8px; }
.mk-order { display: grid; grid-template-columns: auto minmax(0, 1fr) auto 16px; align-items: center; gap: 12px; padding: 10px 12px 10px 10px; border-radius: 22px; background: var(--bg-soft); border: 1px solid var(--border); color: inherit; text-decoration: none; }
.mk-thumbs { display: flex; }
.mk-thumbs img, .mk-thumb-ph { width: 40px; height: 50px; border-radius: 12px; object-fit: cover; background: var(--field-bg); border: 2px solid var(--bg-soft); display: grid; place-items: center; color: var(--fg-muted); }
.mk-thumbs > * + * { margin-left: -16px; }
.mk-o-mid { display: flex; flex-direction: column; min-width: 0; line-height: 1.3; }
.mk-o-mid b { font-size: 15px; }
.mk-o-mid small { font-size: 12.5px; color: var(--fg-muted); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.mk-stage { display: inline-flex; align-items: center; gap: 4px; height: 26px; padding: 0 10px; border-radius: 999px; font-size: 12px; font-weight: 600; white-space: nowrap; background: var(--field-bg); color: var(--fg-muted); border: 1px solid var(--border); }
.mk-stage.is-confirmed, .mk-stage.is-received { color: var(--fg); }
.mk-stage.is-shipped { color: var(--coral-text); background: color-mix(in srgb, var(--coral) 10%, transparent); border-color: color-mix(in srgb, var(--coral) 30%, transparent); }
.mk-stage.is-delivered { color: var(--teal-text); background: color-mix(in srgb, var(--teal) 12%, transparent); border-color: color-mix(in srgb, var(--teal) 34%, transparent); }
.mk-stage.is-cancelled { text-decoration: line-through; }
.mk-stage.is-wait { color: var(--fg-muted); }
.mk-chev { color: var(--fg-muted); }
.mk-ask { display: grid; grid-template-columns: minmax(0, 1fr) auto auto; align-items: center; gap: 10px; padding: 8px 10px 8px 8px; border-radius: 20px; background: var(--bg-soft); border: 1px solid var(--border); }
.mk-ask-main { display: flex; align-items: center; gap: 12px; min-width: 0; color: inherit; text-decoration: none; }
.mk-ask-main img, .mk-piece img, .mk-piece-ph { width: 44px; height: 54px; border-radius: 12px; object-fit: cover; background: var(--field-bg); flex-shrink: 0; display: grid; place-items: center; color: var(--fg-muted); }
.mk-ask-main > span, .mk-piece > span { display: flex; flex-direction: column; min-width: 0; line-height: 1.35; }
.mk-ask-main b, .mk-piece b { font-size: 14px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.mk-ask-main small, .mk-piece small { font-size: 12.5px; color: var(--fg-muted); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.mk-ask-x { width: 30px; height: 30px; border-radius: 999px; display: grid; place-items: center; color: var(--fg-muted); border: 1px solid var(--border); }
.mk-ask-sure { display: inline-flex; gap: 6px; }
.mk-ask-sure button { height: 30px; padding: 0 12px; border-radius: 999px; font-size: 12.5px; font-weight: 600; border: 1px solid var(--border); }
.mk-ask-sure .is-ink { background: var(--fg); color: var(--bg); border-color: var(--fg); }
@media (max-width: 420px) { .mk-ask { grid-template-columns: minmax(0, 1fr) auto; } .mk-ask .mk-stage { display: none; } .mk-ask.is-back .mk-stage { display: inline-flex; } .mk-ask.is-back .mk-ask-x { display: none; } }
.mk-piece { display: flex; align-items: center; gap: 12px; padding: 8px 12px 8px 8px; border-radius: 20px; background: var(--bg-soft); border: 1px solid var(--border); color: inherit; text-decoration: none; min-width: 0; }
.mk-out { display: flex; justify-content: center; padding-top: 6px; }
.mk-out-btn { display: inline-flex; align-items: center; justify-content: center; gap: 8px; min-height: 42px; padding: 0 18px; border-radius: 999px; border: 1px solid var(--border); font-size: 14px; font-weight: 500; color: var(--fg); background: transparent; text-decoration: none; }
.mk-out-btn.is-ink { background: var(--fg); color: var(--bg); border-color: var(--fg); }
.mk-out-ask { display: flex; flex-wrap: wrap; align-items: center; justify-content: center; gap: 8px; text-align: center; font-size: 13.5px; color: var(--fg-muted); }
.mk-out-ask > span { flex-basis: 100%; }
.mk-on-dot { position: absolute; top: 6px; right: 6px; width: 8px; height: 8px; border-radius: 9px; background: var(--teal); box-shadow: 0 0 0 2px var(--bg-soft); }
.mk-wait { display: flex; gap: 6px; justify-content: center; padding: 80px 0; }
.mk-wait i { width: 8px; height: 8px; border-radius: 9px; background: var(--fg-muted); animation: wpDot 1.2s ease-in-out infinite; }
.mk-wait i:nth-child(2) { animation-delay: .15s; } .mk-wait i:nth-child(3) { animation-delay: .3s; }
.mk-oops { display: flex; flex-direction: column; align-items: center; text-align: center; gap: 10px; padding: 32px 22px; }
.mk-oops-ic { width: 52px; height: 52px; border-radius: 999px; display: grid; place-items: center; color: var(--coral-text); background: color-mix(in srgb, var(--coral) 12%, transparent); }
.mk-oops h1 { margin: 4px 0 0; font-size: 22px; font-weight: 700; }
.mk-oops p { margin: 0 0 8px; color: var(--fg-muted); font-size: 14.5px; line-height: 1.55; max-width: 40ch; }

.trk { list-style: none; margin: 0; padding: 18px 16px; border-radius: 26px; background: var(--bg-soft); border: 1px solid var(--border); display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 4px; position: relative; }
.trk.is-cancelled { grid-template-columns: repeat(5, minmax(0, 1fr)); }
.trk-step { display: flex; flex-direction: column; align-items: center; text-align: center; gap: 8px; position: relative; min-width: 0; }
.trk-step + .trk-step::before { content: ""; position: absolute; top: 19px; right: calc(50% + 24px); left: calc(-50% + 24px); height: 3px; border-radius: 3px; background: var(--border); }
.trk-step.is-done::before, .trk-step.is-now::before { background: var(--teal); }
.trk-dot { width: 40px; height: 40px; border-radius: 999px; display: grid; place-items: center; background: var(--field-bg); color: var(--fg-muted); border: 1px solid var(--border); position: relative; z-index: 1; }
.trk-step.is-done .trk-dot { background: var(--teal); color: #062420; border-color: transparent; }
.trk-step.is-now .trk-dot { background: var(--coral); color: #fff; border-color: transparent; box-shadow: 0 0 0 6px color-mix(in srgb, var(--coral) 18%, transparent); animation: trkNow 2.4s ease-in-out infinite; }
.trk-step.is-stop .trk-dot { background: var(--fg); color: var(--bg); border-color: transparent; }
.trk-step.is-off { opacity: .45; }
@keyframes trkNow { 50% { box-shadow: 0 0 0 10px color-mix(in srgb, var(--coral) 6%, transparent); } }
.trk-txt { display: flex; flex-direction: column; line-height: 1.25; min-width: 0; }
.trk-txt b { font-size: 12.5px; font-weight: 600; }
.trk-txt small { font-size: 11px; color: var(--fg-muted); min-height: 14px; white-space: nowrap; }
.trk-items { display: flex; flex-direction: column; gap: 10px; padding: 14px; }
.trk-item { display: grid; grid-template-columns: 44px minmax(0, 1fr) auto; align-items: center; gap: 12px; color: inherit; text-decoration: none; }
.trk-item img { width: 44px; height: 54px; border-radius: 12px; object-fit: cover; background: var(--field-bg); }
.trk-item-mid { display: flex; flex-direction: column; min-width: 0; line-height: 1.35; }
.trk-item-mid b { font-size: 14px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.trk-item-mid small { font-size: 12.5px; color: var(--fg-muted); }
.trk-price { font-size: 14.5px; }
.trk-sum { display: grid; grid-template-columns: minmax(0, 1fr) auto; gap: 6px 12px; padding-top: 12px; margin-top: 2px; border-top: 1px solid var(--border); font-size: 13.5px; color: var(--fg-muted); }
.trk-sum b { color: var(--fg); font-size: 15px; padding-top: 4px; }
.trk-acts { display: flex; flex-wrap: wrap; gap: 10px; }
.trk-acts .wp-btn { flex: 1 1 220px; }
.trk-acts .mk-out-btn { flex: 0 1 auto; min-height: 50px; }
@media (max-width: 380px) { .trk { padding: 16px 8px; } .trk-dot { width: 36px; height: 36px; } .trk-step + .trk-step::before { top: 17px; right: calc(50% + 22px); left: calc(-50% + 22px); } .trk-txt b { font-size: 11.5px; } }
@media (prefers-reduced-motion: reduce) { .wp-dots i, .mk-wait i, .trk-step.is-now .trk-dot, .mb-spin { animation: none !important; } .wp-bubble { transition: none; } }
`;
