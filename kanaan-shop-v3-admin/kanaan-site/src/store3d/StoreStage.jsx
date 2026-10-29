/* The canvas the 3D store draws into, as a React component.

   This file (and three.js with it) is only downloaded when a page actually
   shows the 3D store, in its own chunk. Everything the page needs to work —
   text, buttons, products, the still image of the store — is already on
   screen before this arrives; the 3D scene fades in over the still image
   once its first frame is ready, so there is never a blank moment. */
import React, { useEffect, useRef } from "react";
import { KanaanStore } from "./KanaanStore.js";

export default function StoreStage({ mode = "walk", theme = "light", tier = "high", look = "v1", products, neon, safeLeft = 0, safeBottom = 0, onSelect, onStore, onReady, className = "", style }) {
  const canvasRef = useRef(null);
  const storeRef = useRef(null);
  const onSelectRef = useRef(onSelect);
  onSelectRef.current = onSelect;

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return undefined;
    let store;
    try {
      store = new KanaanStore(canvas, {
        mode,
        theme,
        tier,
        look,
        safe: { left: safeLeft, bottom: safeBottom },
        onSelect: (p) => onSelectRef.current && onSelectRef.current(p),
        onReady: () => onReady && onReady(),
      });
    } catch {
      // no WebGL after all, or the GPU said no: the still image stays up
      return undefined;
    }
    storeRef.current = store;
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
    };
    // the scene is rebuilt only when the kind of store changes
  }, [mode, tier, look]);

  useEffect(() => { if (storeRef.current) storeRef.current.setTheme(theme); }, [theme]);
  useEffect(() => { if (storeRef.current && products) storeRef.current.setProducts(products); }, [products]);
  useEffect(() => { if (storeRef.current && neon) storeRef.current.setNeon(neon); }, [neon]);
  useEffect(() => { if (storeRef.current) storeRef.current.setSafe({ left: safeLeft, bottom: safeBottom }); }, [safeLeft, safeBottom]);

  return <canvas ref={canvasRef} className={className} style={style} aria-hidden="true" />;
}
