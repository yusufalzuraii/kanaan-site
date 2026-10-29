/* The real Kanaan shop, from يوسف's own phone scans.

   Six Scaniverse scans of the shop in Saida were levelled, aligned into one
   space and merged part by part — each part of the shop (the window, the
   cubbies wall, the table, the racks, the jeans corner, the socks wall) from
   the one scan that saw it best, so there are no double edges where two
   scans meet. Then cleaned (floaters along the walk removed, the street and
   the badly seen ceiling taken away so the shop dissolves into the page),
   given a light grade (whites back to white), and split front to back so
   the doorway view arrives first. What's drawn here are those Gaussian
   splats — the shop as a camera saw it, not a model of it.

   Rendering is Spark (sparkjs.dev, MIT), on its own WebGL canvas over the
   drawn storefront: the hero stays the crisp 3D sign, and as the camera
   passes the door this canvas fades in and the real shop gathers itself
   from the doorway inwards, a wave of light running down the shop with the
   scroll.

   Same habits as KanaanStore: one scroll value drives the camera; nothing
   renders unless something changes (scrolling, a fade, Spark finishing a
   sort); offscreen, in a hidden tab, or before the door, it rests. */
import * as THREE from "three";

const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
const smooth = (a, b, v) => {
  const t = clamp((v - a) / (b - a), 0, 1);
  return t * t * (3 - 2 * t);
};
const lerp = (a, b, t) => a + (b - a) * t;

/* Camera path through the scanned shop, in the scan's own metres: floor at
   y 0, front glass at z 0, back wall near z -9.3, x across (left wall
   about -1.8, right about +1.7). t is the share of the whole walk, the same
   scale as the drawn store's path, so the words on screen stay in step.
   `wide` is for landscape screens, `tall` for phones (a narrow view, so the
   camera aims a little lower: the shelves sit above the words). Optional
   `f` is where the lens focuses (metres) and `a` how much the rest softens,
   for the stops; between stops everything stays sharp. */
export const REAL_PATH = [
  { t: 0.13, wide: { p: [1, 1.52, 0.6], l: [0.1, 1.25, -6] }, tall: { p: [1, 1.55, 0.6], l: [0.25, 1.2, -6] } },
  { t: 0.21, wide: { p: [0.9, 1.48, -0.4], l: [-0.3, 1.18, -6] }, tall: { p: [0.9, 1.52, -0.4], l: [-0.2, 1.15, -6] } },
  { t: 0.3, wide: { p: [0.78, 1.56, -1.35], l: [-1.9, 1.45, -3] }, tall: { p: [0.72, 1.6, -1.5], l: [-1.9, 1.25, -2.6] }, a: 1 },
  { t: 0.43, wide: { p: [0.7, 1.56, -2.45], l: [-1.9, 1.45, -3.9] }, tall: { p: [0.68, 1.6, -2.5], l: [-1.9, 1.25, -3.5] }, a: 1 },
  { t: 0.49, wide: { p: [0.05, 1.58, -1.55], l: [0.1, 1.45, -6.5] }, tall: { p: [0.05, 1.6, -1.55], l: [0.1, 1.3, -6.5] } },
  { t: 0.535, wide: { p: [-1.05, 1.6, -2], l: [1.6, 1.45, -3.6] }, tall: { p: [-1, 1.62, -2.1], l: [1.7, 1.3, -3] }, a: 1 },
  { t: 0.6, wide: { p: [-1, 1.6, -2.6], l: [1.6, 1.45, -4.2] }, tall: { p: [-0.95, 1.62, -2.6], l: [1.7, 1.3, -3.6] }, a: 1 },
  { t: 0.64, wide: { p: [-0.95, 1.58, -3.9], l: [-0.6, 1.45, -8] }, tall: { p: [-0.95, 1.6, -3.9], l: [-0.6, 1.3, -8] } },
  { t: 0.68, wide: { p: [-0.2, 1.56, -5], l: [-1.95, 1.32, -6.6] }, tall: { p: [-0.15, 1.6, -5], l: [-1.95, 1.1, -6.4] }, a: 1 },
  { t: 0.735, wide: { p: [-0.1, 1.56, -5.35], l: [-1.95, 1.3, -7] }, tall: { p: [-0.1, 1.6, -5.3], l: [-1.95, 1.05, -6.8] }, a: 1 },
  { t: 0.815, wide: { p: [0.1, 1.55, -5], l: [1.75, 1.15, -6.9] }, tall: { p: [0.1, 1.6, -5], l: [1.6, 1, -6.9] }, a: 1 },
  { t: 0.87, wide: { p: [0, 1.55, -5.2], l: [1.75, 1.15, -7.1] }, tall: { p: [0, 1.6, -5.2], l: [1.6, 1, -7.1] }, a: 1 },
  { t: 0.95, wide: { p: [-0.25, 1.6, -4.6], l: [0.9, 1.88, -6.3] }, tall: { p: [-0.2, 1.6, -4.5], l: [0.95, 1.55, -6.3] }, a: 1 },
  { t: 1, wide: { p: [-0.35, 1.6, -4.3], l: [0.9, 1.85, -6.3] }, tall: { p: [-0.3, 1.6, -4.2], l: [0.95, 1.5, -6.3] }, a: 1 },
];

/* The scroll window of the arrival: the canvas fades in over FADE_IN, and
   the wave runs from the door to the back wall over WAVE. */
export const REAL_FADE_IN = [0.125, 0.175];
const WAVE = [0.12, 0.28];
const WAVE_ORIGIN = [0.95, 1.3, 0.6];
const WAVE_REACH = 12.5;
// how much the stops soften what's in front of and behind the subject
// (full-width lens opening, radians): a gentle film look, not a toy look —
// and cheap, since a softened splat covers more pixels
const APERTURE = 0.006;

// the page's own background: what's beyond the scan is the page
const VOID = { light: "#F2F2F4", dark: "#0B0B0E" };

export class RealShop {
  constructor(canvas, { tier = "high", theme = "light", path = REAL_PATH, reducedMotion = false, onReady, onError } = {}) {
    this.canvas = canvas;
    this.tier = tier;
    this.path = path;
    this.reducedMotion = reducedMotion;
    // the lens softening: computers only. The arrival wave: not with reduced
    // motion. (?dof=0 / ?wave=0 turn them off, for tests in a software GPU.)
    this.dof = tier === "high";
    this.wave = !reducedMotion;
    try {
      const q = new URLSearchParams(window.location.search);
      if (q.get("dof") === "0") this.dof = false;
      if (q.get("wave") === "0") this.wave = false;
    } catch { /* fine */ }
    this.onReady = onReady;
    this.onError = onError;
    this.progress = path[0].t;
    this.progressTarget = path[0].t;
    this.pointer = new THREE.Vector2();
    this.pointerTarget = new THREE.Vector2();
    this.visible = true;
    this.disposed = false;
    this.raf = 0;
    this.last = performance.now();
    this.dirtyUntil = 0;
    this.meshes = [];
    this.ready = false;
    this.readyAt = 0;
    this.radius = 0;
    // only draws while the page shows it (it waits, loaded, under the
    // storefront until the camera reaches the door)
    this.active = false;

    // Splats are drawn by blending many soft layers: cost grows with the
    // pixel count, and MSAA adds nothing — so a modest pixel ratio, no AA.
    const maxDpr = tier === "high" ? 1.5 : 1.25;
    this.dpr = Math.min(window.devicePixelRatio || 1, maxDpr);
    const renderer = new THREE.WebGLRenderer({ canvas, antialias: false, alpha: false, powerPreference: "high-performance" });
    renderer.setPixelRatio(this.dpr);
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer = renderer;

    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(VOID[theme === "dark" ? "dark" : "light"]);
    this.camera = new THREE.PerspectiveCamera(60, 1, 0.05, 80);
    this.look = new THREE.Vector3();
    this.curves = null;
    this.resize(canvas.clientWidth || window.innerWidth, canvas.clientHeight || window.innerHeight);
  }

  /* parts: [url, url, ...] — loaded one after another, the front of the
     shop first, so the doorway view is ready as early as possible */
  async load(parts) {
    try {
      const { SparkRenderer, SplatMesh, dyno } = await import("@sparkjsdev/spark");
      if (this.disposed) return;
      this.spark = new SparkRenderer({
        renderer: this.renderer,
        onDirty: () => this.wake(400),
        // the scans were trained with anti-aliasing (the SPZ flag): this is
        // the matching filter, it keeps fine stripes and labels from
        // sparkling as the camera moves
        blurAmount: 0.3,
        maxStdDev: Math.sqrt(this.tier === "high" ? 8 : 6),
      });
      this.scene.add(this.spark);
      this.uRadius = dyno.dynoFloat(this.wave ? 0 : WAVE_REACH);
      this.uOrigin = dyno.dynoVec3(new THREE.Vector3(...WAVE_ORIGIN));
      const modifier = arrivalWave(dyno, this.uRadius, this.uOrigin);
      for (const url of parts) {
        const mesh = new SplatMesh({ url, objectModifier: modifier });
        this.scene.add(mesh);
        const entry = { mesh, born: 0 };
        this.meshes.push(entry);
        await mesh.initialized;
        if (this.disposed) return;
        // arriving in front of the visitor: fade in over a second; arriving
        // while the canvas is still hidden (the usual case): just be there
        if (this.active) {
          entry.born = performance.now();
          mesh.opacity = 0;
        } else {
          mesh.opacity = 1;
        }
        // draw once now, even hidden: the splats get laid out and sorted
        // ahead of time, so the first frame at the door is already complete
        this.render();
        if (!this.ready) {
          this.ready = true;
          this.readyAt = performance.now();
          if (this.onReady) this.onReady();
        }
        this.wake(1600);
      }
    } catch (e) {
      if (this.onError) this.onError(e);
    }
  }

  setTheme(theme) {
    this.scene.background.set(VOID[theme === "dark" ? "dark" : "light"]);
    this.wake(200);
  }

  setProgress(p) {
    this.progressTarget = clamp(p, 0, 1);
    this.wake(900);
  }

  setPointer(x, y) {
    this.pointerTarget.set(clamp(x, -1, 1), clamp(y, -1, 1));
    this.wake(700);
  }

  setVisible(v) {
    this.visible = !!v;
    if (v) this.wake(300);
  }

  /* Shown or not (faded out before the door). On showing, the camera jumps
     to where the scroll is instead of flying there in front of the visitor. */
  setActive(a) {
    const was = this.active;
    this.active = !!a;
    if (this.active && !was) {
      this.progress = this.progressTarget;
      this.updateCamera(1);
      this.wake(800);
    }
  }

  resize(w, h) {
    if (!w || !h) return;
    this.w = w;
    this.h = h;
    this.renderer.setSize(w, h, false);
    const aspect = w / h;
    this.camera.aspect = aspect;
    // a phone sees less sideways: a touch wider lens
    this.camera.fov = aspect < 0.8 ? 66 : aspect < 1.2 ? 60 : 52;
    this.camera.updateProjectionMatrix();
    const tall = clamp((1.25 - aspect) / 0.7, 0, 1);
    const pick = (k, which) => k.wide[which].map((v, i) => lerp(v, k.tall[which][i], tall));
    const pos = this.path.map((k) => new THREE.Vector3(...pick(k, "p")));
    const look = this.path.map((k) => new THREE.Vector3(...pick(k, "l")));
    // The camera turns a lot on the spot at the back of the shop, so the
    // direction is blended as a heading and a tilt (the short way round),
    // not as a point to look at — a look point swinging past the lens
    // would whip the view around.
    let prev = 0;
    const dirs = pos.map((p, i) => {
      const d = look[i].clone().sub(p).normalize();
      let yaw = Math.atan2(d.x, -d.z);
      if (i > 0) {
        while (yaw - prev > Math.PI) yaw -= Math.PI * 2;
        while (yaw - prev < -Math.PI) yaw += Math.PI * 2;
      }
      prev = yaw;
      // where each stop focuses: on what it looks at, unless told otherwise
      const focus = this.path[i].f || p.distanceTo(look[i]);
      return new THREE.Vector3(yaw, Math.asin(clamp(d.y, -1, 1)), focus);
    });
    this.curves = {
      pos: new THREE.CatmullRomCurve3(pos, false, "centripetal"),
      dir: new THREE.CatmullRomCurve3(dirs, false, "catmullrom", 0.5),
    };
    this.updateCamera(1);
    this.wake(300);
  }

  /* index of the segment and the share along it, for a scroll value */
  segment(p) {
    const keys = this.path;
    const n = keys.length - 1;
    if (p <= keys[0].t) return { i: 0, s: 0, u: 0 };
    for (let i = 0; i < n; i++) {
      if (p <= keys[i + 1].t) {
        const s = clamp((p - keys[i].t) / (keys[i + 1].t - keys[i].t || 1), 0, 1);
        return { i, s, u: (i + s) / n };
      }
    }
    return { i: n - 1, s: 1, u: 1 };
  }

  updateCamera(alpha) {
    this.progress = lerp(this.progress, this.progressTarget, alpha);
    this.pointer.lerp(this.pointerTarget, Math.min(1, alpha * 0.8));
    if (!this.curves) return;
    const seg = this.segment(this.progress);
    const p = this.curves.pos.getPoint(seg.u);
    const d = this.curves.dir.getPoint(seg.u);
    // a little parallax with the pointer: the shop has real depth, let it show
    p.x += this.pointer.x * 0.06;
    p.y += this.pointer.y * 0.035;
    const yaw = d.x - this.pointer.x * 0.03;
    const pitch = d.y + this.pointer.y * 0.015;
    this.camera.position.copy(p);
    this.look.set(p.x + Math.sin(yaw) * Math.cos(pitch), p.y + Math.sin(pitch), p.z - Math.cos(yaw) * Math.cos(pitch));
    this.camera.lookAt(this.look);
    if (this.spark) {
      // focus follows the path; the softening only at the stops, easing in
      // and out so walking between them stays crisp
      // (each stop is two keys, arrive and drift, both marked `a`: the
      // softening holds through the stop and eases out on the way on)
      const a0 = this.path[seg.i].a || 0;
      const a1 = this.path[Math.min(seg.i + 1, this.path.length - 1)].a || 0;
      const e = seg.s * seg.s * (3 - 2 * seg.s);
      const ap = lerp(a0, a1, e);
      this.spark.focalDistance = Math.max(0.5, d.z);
      // (softening makes every splat bigger on screen: computers only)
      this.spark.apertureAngle = this.reducedMotion || !this.dof ? 0 : ap * APERTURE;
    }
  }

  /* how far the wave of light has run from the door: with the scroll, and,
     if the scan arrived late, from the moment it arrived */
  updateWave(now) {
    if (!this.uRadius || !this.wave) return false;
    // fast off the mark, easing out towards the back wall: the doorway
    // fills in as soon as the canvas is up
    const tw = clamp((this.progress - WAVE[0]) / (WAVE[1] - WAVE[0]), 0, 1);
    const fromScroll = (1 - (1 - tw) * (1 - tw)) * WAVE_REACH;
    const fromArrival = this.readyAt ? ((now - this.readyAt) / 1000) * 7.5 : 0;
    const r = Math.min(fromScroll, fromArrival);
    // every change re-generates all the splats, so the front moves in
    // small steps, at most ~20 times a second (the front itself is 1.8 m
    // soft, so the steps don't show); a phone takes bigger steps
    const settled = r >= WAVE_REACH || r <= 0;
    const step = this.tier === "high" ? 0.12 : 0.22;
    const pending = r < WAVE_REACH && r > 0 && fromArrival < fromScroll;
    if (Math.abs(r - this.radius) < (settled ? 1e-3 : step)) return pending;
    if (!settled && now - (this.waveAt || 0) < 50) return true;
    this.waveAt = now;
    this.radius = r;
    this.uRadius.value = r;
    for (const m of this.meshes) m.mesh.updateVersion();
    return r < WAVE_REACH;
  }

  skipWave() {
    this.wave = false;
    if (!this.uRadius) return;
    this.radius = WAVE_REACH;
    this.uRadius.value = WAVE_REACH;
    for (const m of this.meshes) m.mesh.updateVersion();
    this.wake(400);
  }

  /* keep drawing for at least `ms` more milliseconds */
  wake(ms = 600) {
    this.dirtyUntil = Math.max(this.dirtyUntil, performance.now() + ms);
    if (this.raf || this.disposed || !this.visible || !this.active || document.hidden) return;
    this.last = performance.now();
    this.raf = requestAnimationFrame(this._tick);
  }

  _tick = () => {
    this.raf = 0;
    if (this.disposed || !this.visible || !this.active || document.hidden) return;
    const now = performance.now();
    const gap = now - this.last;
    const dt = Math.min(0.05, gap / 1000);
    this.last = now;
    this.adapt(gap);
    const k = 1 - Math.exp(-dt * 7);
    const moving = Math.abs(this.progress - this.progressTarget) > 1e-4 || this.pointer.distanceTo(this.pointerTarget) > 1e-3;
    this.updateCamera(k);
    const waving = this.updateWave(now);
    // each part fades in over a second as it arrives
    let fading = false;
    for (const m of this.meshes) {
      if (!m.born) continue;
      const o = smooth(0, 1100, now - m.born);
      if (m.mesh.opacity !== o) {
        m.mesh.opacity = o;
        if (o < 1) fading = true;
      }
    }
    this.render();
    if (moving || waving || fading || now < this.dirtyUntil) this.raf = requestAnimationFrame(this._tick);
  };

  /* If frames keep coming slowly while walking, draw fewer pixels: a
     slightly softer picture beats a stuttering one. */
  adapt(gap) {
    if (gap > 250) { this.slow = 0; this.frames = 0; return; }
    this.frames = (this.frames || 0) + 1;
    this.slow = (this.slow || 0) + gap;
    if (this.frames < 30) return;
    const avg = this.slow / this.frames;
    this.frames = 0;
    this.slow = 0;
    if (avg > 38 && this.dpr > 1) {
      this.dpr = Math.max(1, this.dpr - 0.25);
      this.renderer.setPixelRatio(this.dpr);
      this.renderer.setSize(this.w, this.h, false);
    }
    // a device this slow skips the arrival wave: the shop is simply there
    if (avg > 45 && this.wave) this.skipWave();
  }

  render() {
    if (this.disposed) return;
    this.renderer.render(this.scene, this.camera);
  }

  dispose() {
    this.disposed = true;
    cancelAnimationFrame(this.raf);
    for (const m of this.meshes) {
      try { m.mesh.dispose(); } catch { /* already gone */ }
    }
    try { if (this.spark && this.spark.dispose) this.spark.dispose(); } catch { /* already gone */ }
    // dispose, but don't force the context lost: React may mount the same
    // canvas again straight away (it does in development), and a canvas
    // whose context was killed can never draw again
    this.renderer.dispose();
  }
}

/* The arrival, on the GPU: each splat appears as the wave reaches it,
   growing from a speck to its full size, and catches a little warm light as
   the front passes. Behind the wave everything is exactly as scanned. */
function arrivalWave(dyno, radius, origin) {
  return dyno.dynoBlock({ gsplat: dyno.Gsplat }, { gsplat: dyno.Gsplat }, ({ gsplat }) => {
    const wave = new dyno.Dyno({
      inTypes: { gsplat: dyno.Gsplat, radius: "float", origin: "vec3" },
      outTypes: { gsplat: dyno.Gsplat },
      statements: ({ inputs, outputs }) => dyno.unindentLines(`
        ${outputs.gsplat} = ${inputs.gsplat};
        float wd = distance(${inputs.gsplat}.center, ${inputs.origin});
        float wk = clamp((${inputs.radius} - wd) / 1.8, 0.0, 1.0);
        float ws = wk * wk * (3.0 - 2.0 * wk);
        ${outputs.gsplat}.scales *= mix(0.06, 1.0, ws);
        ${outputs.gsplat}.rgba.a *= smoothstep(0.0, 0.45, wk);
        float we = wk * (1.0 - wk) * 4.0;
        ${outputs.gsplat}.rgba.rgb = mix(${outputs.gsplat}.rgba.rgb, vec3(1.0, 0.97, 0.92), we * 0.4);
      `),
    });
    return { gsplat: wave.apply({ gsplat, radius, origin }).gsplat };
  });
}
