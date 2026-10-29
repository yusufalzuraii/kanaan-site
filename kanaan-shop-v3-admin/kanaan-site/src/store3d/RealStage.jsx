/* The scanned shop's canvas, as a React component.

   Loaded only when a page shows the real walk on a capable device, in its
   own chunk together with Spark. It reports `onReady` once the front of the
   shop has arrived and drawn; until then (or if it never arrives) the drawn
   store underneath carries on, so nothing on the page waits for it. */
import React, { useEffect, useRef } from "react";
import { RealShop } from "./RealShop.js";

export default function RealStage({ parts, theme = "light", tier = "high", reducedMotion = false, onStore, onReady, onError, className = "", style }) {
  const canvasRef = useRef(null);
  const storeRef = useRef(null);
  const cb = useRef({ onStore, onReady, onError });
  cb.current = { onStore, onReady, onError };

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return undefined;
    let shop;
    try {
      shop = new RealShop(canvas, {
        tier,
        theme,
        reducedMotion,
        onReady: () => cb.current.onReady && cb.current.onReady(),
        onError: (e) => cb.current.onError && cb.current.onError(e),
      });
    } catch (e) {
      if (cb.current.onError) cb.current.onError(e);
      return undefined;
    }
    storeRef.current = shop;
    if (cb.current.onStore) cb.current.onStore(shop);
    shop.load(parts);

    const ro = new ResizeObserver(() => shop.resize(canvas.clientWidth, canvas.clientHeight));
    ro.observe(canvas);
    const io = new IntersectionObserver(([e]) => shop.setVisible(e.isIntersecting), { rootMargin: "80px" });
    io.observe(canvas);
    // a mouse leans the view a little; touch scrolls, nothing else
    const onMove = (e) => {
      if (e.pointerType !== "mouse") return;
      shop.setPointer((e.clientX / window.innerWidth) * 2 - 1, -((e.clientY / window.innerHeight) * 2 - 1));
    };
    window.addEventListener("pointermove", onMove, { passive: true });
    const onVis = () => { if (!document.hidden) shop.wake(300); };
    document.addEventListener("visibilitychange", onVis);
    return () => {
      ro.disconnect();
      io.disconnect();
      window.removeEventListener("pointermove", onMove);
      document.removeEventListener("visibilitychange", onVis);
      if (cb.current.onStore) cb.current.onStore(null);
      shop.dispose();
      storeRef.current = null;
    };
    // built once per page: the parts list is fixed and the theme is passed
    // on below without rebuilding
  }, [tier]);

  useEffect(() => { if (storeRef.current) storeRef.current.setTheme(theme); }, [theme]);

  return <canvas ref={canvasRef} className={className} style={style} aria-hidden="true" />;
}
