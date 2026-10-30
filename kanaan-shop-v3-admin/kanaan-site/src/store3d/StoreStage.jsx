/* The canvas the 3D store draws into, as a React component.

   This file (and three.js with it) is only downloaded when a page actually
   shows the 3D store, in its own chunk. Everything the page needs to work —
   text, buttons, products, the still image of the store — is already on
   screen before this arrives; the 3D scene fades in over the still image
   once its first frame is ready, so there is never a blank moment. */
import React, { useEffect, useRef } from "react";
import { KanaanStore } from "./KanaanStore.js";

export default function StoreStage({ mode = "walk", theme = "light", tier = "high", tags, safeLeft = 0, safeBottom = 0, onSelect, onStore, onReady, className = "", style }) {
  const canvasRef = useRef(null);
  const storeRef = useRef(null);
  const onSelectRef = useRef(onSelect);
  onSelectRef.current = onSelect;
  // the latest stock, for a store that is (re)built after it arrived
  const latest = useRef({});
  latest.current = { tags };

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return undefined;
    let store;
    try {
      store = new KanaanStore(canvas, {
        mode,
        theme,
        tier,
        safe: { left: safeLeft, bottom: safeBottom },
        onSelect: (p) => onSelectRef.current && onSelectRef.current(p),
        onReady: () => onReady && onReady(),
      });
    } catch {
      // no WebGL after all, or the GPU said no: the still image stays up
      return undefined;
    }
    storeRef.current = store;
    // a page opened with ?tier= (the owner checking a device, our tests)
    // can reach the store from its canvas
    const debug = /[?&]tier=/.test(window.location.search);
    if (debug) canvas.kanaanStore = store;
    if (latest.current.tags) store.setTags(latest.current.tags);
    if (onStore) onStore(store);

    const ro = new ResizeObserver(() => store.resize(canvas.clientWidth, canvas.clientHeight));
    ro.observe(canvas);
    const io = new IntersectionObserver(([e]) => store.setVisible(e.isIntersecting), { rootMargin: "80px" });
    io.observe(canvas);
    return () => {
      ro.disconnect();
      io.disconnect();
      if (onStore) onStore(null);
      store.dispose();
      storeRef.current = null;
      if (debug) delete canvas.kanaanStore;
    };
    // the scene is rebuilt only when the kind of store changes
  }, [mode, tier]);

  useEffect(() => { if (storeRef.current) storeRef.current.setTheme(theme); }, [theme]);
  useEffect(() => { if (storeRef.current && tags) storeRef.current.setTags(tags); }, [tags]);
  useEffect(() => { if (storeRef.current) storeRef.current.setSafe({ left: safeLeft, bottom: safeBottom }); }, [safeLeft, safeBottom]);

  return <canvas ref={canvasRef} className={className} style={style} aria-hidden="true" />;
}
