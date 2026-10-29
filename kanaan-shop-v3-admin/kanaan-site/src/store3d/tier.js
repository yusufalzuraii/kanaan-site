/* Which version of the store this device should get — decided without
   loading three.js, so a phone that will only ever see the still image
   never downloads the 3D engine at all.

   "high"   desktop / strong GPU: the full scene
   "mid"    phones and tablets: same scene, fewer pixels and fewer coats
   "static" reduced motion, data saver, or a weak device: the still image
   "none"   no WebGL2 at all: the still image */
export function detectTier() {
  try {
    const c = document.createElement("canvas");
    const gl = c.getContext("webgl2");
    if (!gl) return "none";
    // give the test context straight back — phones only allow a handful
    try { gl.getExtension("WEBGL_lose_context")?.loseContext(); } catch { /* fine */ }
    const reduce = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reduce) return "static";
    const conn = navigator.connection || {};
    if (conn.saveData) return "static";
    const mem = navigator.deviceMemory || 4;
    const cores = navigator.hardwareConcurrency || 4;
    if (mem <= 2 || cores <= 2) return "static";
    const coarse = window.matchMedia && window.matchMedia("(pointer: coarse)").matches;
    const small = Math.min(window.screen.width, window.screen.height) < 820;
    if (coarse || small || mem < 4) return "mid";
    return "high";
  } catch {
    return "none";
  }
}

