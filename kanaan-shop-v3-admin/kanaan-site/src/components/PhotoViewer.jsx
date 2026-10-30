/* ============================================================
   THE PHOTOS, FULL SCREEN — to see the fabric, the stitching
   ------------------------------------------------------------
   Opens from the product photo. Pinch or double-tap to zoom (up to
   4×, around your fingers), drag to look around, swipe sideways for
   the next photo, swipe down (or back, Esc, ×) to close. On a
   computer: the wheel zooms where the pointer is, arrows change photo.
   The page itself can't be pinched (the site is an app-like page), so
   this is where people look closely.
   ============================================================ */
import React, { useEffect, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { X, ChevronLeft, ChevronRight } from "lucide-react";

const MAX = 4;
// a mouse or trackpad (the wheel zooms) rather than fingers
const HOVER = typeof window !== "undefined" && !!window.matchMedia && window.matchMedia("(hover: hover) and (pointer: fine)").matches;
const clamp = (v, a, b) => Math.min(b, Math.max(a, v));

export default function PhotoViewer({ images, start = 0, name = "", onClose }) {
  const [i, setI] = useState(clamp(start, 0, images.length - 1));
  const [z, setZ] = useState({ s: 1, x: 0, y: 0 }); // the current photo: scale and offset (from the centre)
  const [slide, setSlide] = useState({ dx: 0, dy: 0 }); // a swipe in progress (not zoomed)
  const [live, setLive] = useState(false); // a finger is moving: no easing
  const [shown, setShown] = useState(false);
  const stage = useRef(null);
  const imgs = useRef([]);
  const pts = useRef(new Map());
  const g = useRef(null); // the gesture: { kind, ... }
  const tap = useRef({ t: 0, x: 0, y: 0 });
  const zr = useRef(z); zr.current = z;
  const ir = useRef(i); ir.current = i;
  const sr = useRef(slide); sr.current = slide;
  const kind = useRef("mouse"); // the last pointer: a touch double-tap is handled by hand, a mouse one by dblclick

  // the page under it stays still; the way back (Android's button, a swipe) closes the photos, not the page;
  // the keyboard lands on × and goes back to the photo it came from
  const closeBtn = useRef(null);
  useEffect(() => {
    const prev = document.body.style.overflow;
    const from = document.activeElement;
    document.body.style.overflow = "hidden";
    const onPop = () => onClose(true);
    window.addEventListener("popstate", onPop);
    const t = requestAnimationFrame(() => { setShown(true); closeBtn.current && closeBtn.current.focus({ preventScroll: true }); });
    return () => {
      document.body.style.overflow = prev; window.removeEventListener("popstate", onPop); cancelAnimationFrame(t);
      try { from && from.focus && from.focus({ preventScroll: true }); } catch { /* fine */ }
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const close = () => onClose(false);

  // keys: Esc closes, arrows change photo, + / − zoom
  useEffect(() => {
    const onKey = (e) => {
      if (e.key === "Tab") {
        const root = stage.current && stage.current.parentElement;
        const f = root ? [...root.querySelectorAll("button:not([disabled])")] : [];
        if (f.length) { const k = f.indexOf(document.activeElement); const n = e.shiftKey ? (k <= 0 ? f.length - 1 : k - 1) : (k === f.length - 1 ? 0 : k + 1); e.preventDefault(); f[n].focus(); }
        return;
      }
      if (e.key === "Escape") { e.stopPropagation(); close(); }
      else if (e.key === "ArrowRight") go(1);
      else if (e.key === "ArrowLeft") go(-1);
      else if (e.key === "+" || e.key === "=") zoomAt(0, 0, Math.min(MAX, zr.current.s * 1.5));
      else if (e.key === "-") zoomAt(0, 0, Math.max(1, zr.current.s / 1.5));
    };
    window.addEventListener("keydown", onKey, true);
    return () => window.removeEventListener("keydown", onKey, true);
  }); // eslint-disable-line react-hooks/exhaustive-deps

  const size = () => {
    const r = stage.current ? stage.current.getBoundingClientRect() : { width: innerWidth, height: innerHeight, left: 0, top: 0 };
    return r;
  };
  // how big the photo is drawn at 1× (it fits the screen)
  const fit = () => {
    const r = size();
    const im = imgs.current[ir.current];
    const iw = (im && im.naturalWidth) || 4, ih = (im && im.naturalHeight) || 5;
    const k = Math.min(r.width / iw, r.height / ih);
    return { w: iw * k, h: ih * k, W: r.width, H: r.height };
  };
  // keep the photo covering what it can: no empty band when it's bigger than the screen
  const bound = (s, x, y) => {
    const f = fit();
    const mx = Math.max(0, (f.w * s - f.W) / 2), my = Math.max(0, (f.h * s - f.H) / 2);
    return { s, x: clamp(x, -mx, mx), y: clamp(y, -my, my) };
  };
  // zoom to s, keeping the point (px, py) — measured from the screen's centre — where it is
  const zoomAt = (px, py, s) => {
    const c = zr.current;
    const k = s / c.s;
    setZ(s <= 1.001 ? { s: 1, x: 0, y: 0 } : bound(s, px - (px - c.x) * k, py - (py - c.y) * k));
  };
  const go = (d) => {
    const n = clamp(ir.current + d, 0, images.length - 1);
    if (n === ir.current) return;
    setZ({ s: 1, x: 0, y: 0 });
    setI(n);
  };

  const rel = (e) => { const r = size(); return { x: e.clientX - r.left - r.width / 2, y: e.clientY - r.top - r.height / 2 }; };

  const down = (e) => {
    if (e.button !== undefined && e.button !== 0 && e.pointerType === "mouse") return;
    kind.current = e.pointerType || "mouse";
    e.currentTarget.setPointerCapture?.(e.pointerId);
    pts.current.set(e.pointerId, rel(e));
    const list = [...pts.current.values()];
    if (list.length === 2) {
      const [a, b] = list;
      g.current = { kind: "pinch", d0: Math.hypot(a.x - b.x, a.y - b.y) || 1, m0: { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 }, z0: { ...zr.current } };
      setSlide({ dx: 0, dy: 0 });
    } else if (list.length === 1) {
      g.current = { kind: "one", p0: list[0], z0: { ...zr.current }, t0: performance.now(), axis: null, moved: 0 };
    }
    setLive(true);
  };

  const move = (e) => {
    if (!pts.current.has(e.pointerId)) return;
    pts.current.set(e.pointerId, rel(e));
    const G = g.current; if (!G) return;
    const list = [...pts.current.values()];
    if (G.kind === "pinch" && list.length >= 2) {
      const [a, b] = list;
      const d = Math.hypot(a.x - b.x, a.y - b.y);
      const m = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
      const s = clamp(G.z0.s * (d / G.d0), 1, MAX);
      const k = s / G.z0.s;
      setZ(bound(s, m.x - (G.m0.x - G.z0.x) * k, m.y - (G.m0.y - G.z0.y) * k));
      return;
    }
    if (G.kind !== "one") return;
    const p = list[0];
    const dx = p.x - G.p0.x, dy = p.y - G.p0.y;
    G.moved = Math.max(G.moved, Math.hypot(dx, dy));
    if (G.z0.s > 1.001) { setZ(bound(G.z0.s, G.z0.x + dx, G.z0.y + dy)); return; }
    if (!G.axis && G.moved > 10) G.axis = Math.abs(dx) > Math.abs(dy) ? "x" : "y";
    if (G.axis === "x") {
      const edge = (ir.current === 0 && dx > 0) || (ir.current === images.length - 1 && dx < 0);
      setSlide({ dx: edge ? dx * 0.3 : dx, dy: 0 });
    } else if (G.axis === "y") {
      setSlide({ dx: 0, dy: Math.max(0, dy) });
    }
  };

  const up = (e) => {
    if (!pts.current.has(e.pointerId)) return;
    const last = pts.current.get(e.pointerId);
    pts.current.delete(e.pointerId);
    const G = g.current;
    const left = [...pts.current.values()];
    if (G && G.kind === "pinch") {
      // one finger still down: it carries on as a drag from where it is
      if (left.length === 1) { g.current = { kind: "one", p0: left[0], z0: { ...zr.current }, t0: performance.now(), axis: "pan", moved: 99 }; return; }
      g.current = null; setLive(false);
      if (zr.current.s < 1.05) setZ({ s: 1, x: 0, y: 0 });
      return;
    }
    if (left.length) return;
    g.current = null; setLive(false);
    if (!G) return;
    const r = size();
    if (G.axis === "x") {
      const dx = sr.current.dx;
      if (dx < -Math.min(80, r.width * 0.18)) go(1); else if (dx > Math.min(80, r.width * 0.18)) go(-1);
      setSlide({ dx: 0, dy: 0 });
      return;
    }
    if (G.axis === "y") {
      if (sr.current.dy > 110) { close(); return; }
      setSlide({ dx: 0, dy: 0 });
      return;
    }
    // a tap: two quick ones zoom in (where you tapped) or back out (a mouse has its own double-click)
    if (kind.current !== "mouse" && G.moved < 10 && performance.now() - G.t0 < 300) {
      const now = performance.now();
      const T = tap.current;
      if (now - T.t < 320 && Math.hypot(last.x - T.x, last.y - T.y) < 40) {
        tap.current = { t: 0, x: 0, y: 0 };
        if (zr.current.s > 1.001) setZ({ s: 1, x: 0, y: 0 }); else zoomAt(last.x, last.y, 2.5);
      } else {
        tap.current = { t: now, x: last.x, y: last.y };
      }
    }
  };

  const wheel = (e) => {
    const p = rel(e);
    const s = clamp(zr.current.s * Math.exp(-e.deltaY * 0.0022), 1, MAX);
    zoomAt(p.x, p.y, s);
  };
  // the wheel must be able to stop the page from scrolling (React's onWheel can't)
  useLayoutEffect(() => {
    const el = stage.current; if (!el) return;
    const fn = (e) => { e.preventDefault(); wheel(e); };
    el.addEventListener("wheel", fn, { passive: false });
    return () => el.removeEventListener("wheel", fn);
  });

  const zoomed = z.s > 1.001;
  const fade = slide.dy ? Math.max(0.25, 1 - slide.dy / 420) : 1;

  return createPortal(
    <div
      className={`pv ${shown ? "is-in" : ""}`}
      role="dialog"
      aria-modal="true"
      aria-label={`Photos of ${name}`}
      style={{ "--pv-fade": fade }}
      onTouchStart={(e) => e.stopPropagation()}
      data-testid="photo-viewer"
    >
      <div className="pv-bg" />
      <div className="pv-top">
        <span className="pv-count font-num" aria-live="polite">{images.length > 1 ? `${i + 1} / ${images.length}` : ""}</span>
        <button ref={closeBtn} type="button" className="pv-btn" onClick={close} aria-label="Close photos" data-testid="photo-viewer-close"><X className="w-5 h-5" /></button>
      </div>
      <div
        ref={stage}
        className={`pv-stage ${zoomed ? "is-zoomed" : ""}`}
        onPointerDown={down}
        onPointerMove={move}
        onPointerUp={up}
        onPointerCancel={up}
        onDoubleClick={(e) => { if (kind.current !== "mouse") return; const p = rel(e); if (zr.current.s > 1.001) setZ({ s: 1, x: 0, y: 0 }); else zoomAt(p.x, p.y, 2.5); }}
      >
        <div className={`pv-strip ${live ? "" : "is-easing"}`} style={{ transform: `translate3d(calc(${-i * 100}% + ${slide.dx}px), ${slide.dy}px, 0)` }}>
          {images.map((src, k) => (
            <div className="pv-slide" key={src + k}>
              <img
                ref={(el) => { imgs.current[k] = el; }}
                src={src}
                alt={k === i ? `${name}, photo ${k + 1}` : ""}
                draggable={false}
                className={live ? "" : "is-easing"}
                style={k === i ? { transform: `translate3d(${z.x}px, ${z.y}px, 0) scale(${z.s})` } : undefined}
                data-testid={k === i ? "photo-viewer-img" : undefined}
              />
            </div>
          ))}
        </div>
      </div>
      {images.length > 1 && (
        <>
          <button type="button" className="pv-btn pv-prev" onClick={() => go(-1)} disabled={i === 0} aria-label="Previous photo"><ChevronLeft className="w-5 h-5" /></button>
          <button type="button" className="pv-btn pv-next" onClick={() => go(1)} disabled={i === images.length - 1} aria-label="Next photo"><ChevronRight className="w-5 h-5" /></button>
          <div className="pv-dots" aria-hidden="true">{images.map((_, k) => <i key={k} className={k === i ? "on" : ""} />)}</div>
        </>
      )}
      {!zoomed && <p className="pv-hint" aria-hidden="true">{HOVER ? "Scroll or double-click to zoom" : "Pinch or double-tap to zoom"}</p>}
    </div>,
    document.body
  );
}

export const PHOTO_VIEWER_CSS = `
  .pv { position: fixed; inset: 0; z-index: 90; touch-action: none; user-select: none; -webkit-user-select: none; }
  .pv-bg { position: absolute; inset: 0; background: #0B0B0E; opacity: 0; transition: opacity 0.28s ease; }
  .pv.is-in .pv-bg { opacity: var(--pv-fade, 1); }
  .pv-top { position: absolute; left: 0; right: 0; top: 0; z-index: 3; display: flex; align-items: center; justify-content: space-between; padding: calc(12px + env(safe-area-inset-top, 0px)) 14px 22px 20px; background: linear-gradient(rgba(11,11,14,0.6), rgba(11,11,14,0)); pointer-events: none; }
  .pv-top > * { pointer-events: auto; }
  .pv-count { color: rgba(255,255,255,0.78); font-size: 14px; letter-spacing: 0.04em; }
  .pv-btn { width: 44px; height: 44px; border-radius: 999px; display: grid; place-items: center; color: #fff; background: rgba(255,255,255,0.12); border: 1px solid rgba(255,255,255,0.18); backdrop-filter: blur(14px); -webkit-backdrop-filter: blur(14px); transition: opacity 0.2s ease, background 0.2s ease; }
  .pv-btn:hover { background: rgba(255,255,255,0.2); }
  .pv-btn:disabled { opacity: 0.25; }
  .pv-prev, .pv-next { position: absolute; top: 50%; margin-top: -22px; z-index: 3; display: none; }
  .pv-prev { left: 18px; } .pv-next { right: 18px; }
  @media (hover: hover) and (min-width: 768px) { .pv-prev, .pv-next { display: grid; } }
  .pv-stage { position: absolute; inset: 0; overflow: hidden; cursor: zoom-in; opacity: 0; transform: scale(0.96); transition: opacity 0.28s ease, transform 0.36s cubic-bezier(0.16,1,0.3,1); }
  .pv.is-in .pv-stage { opacity: 1; transform: none; }
  .pv-stage.is-zoomed { cursor: grab; }
  .pv-strip { display: flex; height: 100%; will-change: transform; }
  .pv-strip.is-easing { transition: transform 0.38s cubic-bezier(0.16,1,0.3,1); }
  .pv-slide { flex: 0 0 100%; height: 100%; display: grid; place-items: center; overflow: hidden; }
  .pv-slide img { width: 100%; height: 100%; object-fit: contain; transform-origin: 50% 50%; will-change: transform; -webkit-user-drag: none; pointer-events: none; }
  .pv-slide img.is-easing { transition: transform 0.32s cubic-bezier(0.16,1,0.3,1); }
  .pv-dots { position: absolute; left: 0; right: 0; bottom: calc(22px + env(safe-area-inset-bottom, 0px)); display: flex; justify-content: center; gap: 7px; z-index: 3; }
  .pv-dots i { width: 6px; height: 6px; border-radius: 999px; background: rgba(255,255,255,0.35); transition: width 0.3s cubic-bezier(0.16,1,0.3,1), background 0.3s ease; }
  .pv-dots i.on { width: 20px; background: #fff; }
  .pv-hint { position: absolute; left: 0; right: 0; bottom: calc(46px + env(safe-area-inset-bottom, 0px)); text-align: center; color: rgba(255,255,255,0.55); font-family: 'Inter', sans-serif; font-size: 12.5px; z-index: 3; pointer-events: none; animation: pvHint 3.2s ease 0.6s both; }
  @keyframes pvHint { 0% { opacity: 0; } 15%, 75% { opacity: 1; } 100% { opacity: 0; } }
  @media (prefers-reduced-motion: reduce) { .pv-bg, .pv-stage, .pv-strip.is-easing, .pv-slide img.is-easing { transition: none; } .pv-hint { animation: none; opacity: 1; } }
`;
