/* Runtime for the 3D store: renderer, camera path, day/night, the live
   stock on the hang tags, taps on them, and — most of all — not wasting the
   phone's battery. The scene only renders while something is actually changing
   (scrolling, the intro, a door swinging, day turning to night); the
   moment it settles, the loop stops and the last frame simply stays on
   screen. */
import * as THREE from "three";
import { RoomEnvironment } from "three/addons/environments/RoomEnvironment.js";
import { buildStore } from "./buildStore.js";
import { scriptNeonTexture } from "./textures.js";
import { HangTags } from "./hangtags.js";

const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
const smooth = (a, b, v) => {
  const t = clamp((v - a) / (b - a), 0, 1);
  return t * t * (3 - 2 * t);
};
const lerp = (a, b, t) => a + (b - a) * t;

/* Day (light theme) and night (dark theme). The site's own background
   colours, so the canvas melts into the page instead of sitting on it. */
const LOOK = {
  // late afternoon in Saida: a low warm sun across the shopfront, so the
  // sign's letters and the canopy throw real shadows
  day: {
    bg: new THREE.Color("#ecebe8"), fog: new THREE.Color("#ecebe8"), fogDensity: 0.02,
    hemi: 0.5, hemiSky: new THREE.Color("#dde4ee"), hemiGround: new THREE.Color("#b8ad9d"),
    sun: 4.2, street: 0, warm: 2.4, env: 0.26, exposure: 1.02,
  },
  night: {
    bg: new THREE.Color("#0b0b0e"), fog: new THREE.Color("#0b0b0e"), fogDensity: 0.03,
    hemi: 0.28, hemiSky: new THREE.Color("#4b5468"), hemiGround: new THREE.Color("#0c0c10"),
    sun: 0, street: 0.28, warm: 10, env: 0.32, exposure: 1.18,
  },
};

/* A phone's opening shot, worked out from the screen's shape so it holds on
   every phone: zoomed out, the whole shopfront with a strip of the
   neighbours either side, sitting in the band between the header and the
   words at the bottom — then the walk carries you across the street and
   in through the door. */
function phoneFront(aspect, vfov, safeBottom = 0) {
  const tanV = Math.tan(THREE.MathUtils.degToRad(vfov / 2));
  const tanH = tanV * aspect;
  // the band, as shares of the screen height from the top: under the
  // header, and ending just above where the page says its words begin
  // (safeBottom), so on a short phone the shop moves up instead of under them
  const TOP = 0.2;
  const BOTTOM = safeBottom > 0 ? clamp(safeBottom - 0.035, 0.44, 0.6) : 0.58;
  const FILL = 0.78;               // share of the width the canopy takes
  const HALF = 3.25, NEAR = 1.05;  // the canopy: half its width, and its front edge
  const TALL = 5.45, EYE = 2.1;    // pavement to the top of the sign; camera height
  const byWidth = HALF / (FILL * tanH) + NEAR;
  const byHeight = TALL / ((BOTTOM - TOP) * 2 * tanV) + 0.32;
  const D = Math.max(byWidth, byHeight);
  // aim so the middle of the shopfront lands in the middle of the band
  const above = Math.atan((0.5 - (TOP + BOTTOM) / 2) * 2 * tanV);
  const pitch = Math.atan((2.7 - EYE) / (D - 0.32)) - above;
  return { p: [0, EYE, D], l: [0, EYE + Math.tan(pitch) * D, 0] };
}

/* Where the camera stands, and what it looks at, along the scroll.
   t is the share of the walk-through; the facade framing is computed from
   the screen shape so the whole sign always fits — on a narrow phone the
   camera simply steps back across the street. */
function pathFor(aspect, mode, { left: safeLeft = 0, bottom: safeBottom = 0 } = {}) {
  // desktop wants a wide side shot of each wall; a phone, with its narrow
  // view, looks along the walls instead so several pieces stay in frame
  const tall = clamp((1.25 - aspect) / 0.7, 0, 1);
  const vfov = aspect < 0.8 ? 58 : aspect < 1.2 ? 54 : 48;
  const half = THREE.MathUtils.degToRad(vfov / 2);
  const hfovHalf = Math.atan(Math.tan(half) * aspect);
  const fitW = 3.55 / Math.tan(hfovHalf);
  const fitH = 3.0 / Math.tan(half);
  let D0 = Math.max(8.2, fitW, fitH) + 0.4;
  const mix = (a, b) => a.map((v, i) => lerp(v, b[i], tall));
  // On a wide screen the shopfront moves right of centre, leaving the left
  // side of the picture for the headline instead of printing over the sign.
  // The page says where its headline ends (safeLeft, a fraction of the
  // width); the front edge of the canopy — the widest, nearest part of the
  // shopfront, 6.5 m across — is placed just past it. If the whole front
  // would then run off the right edge, the camera steps back a little (at
  // most 12%) rather than crop the sign.
  const tanH = Math.tan(hfovHalf);
  let shift = 0;
  if (aspect >= 1.25) {
    if (safeLeft > 0) {
      const HALF = 3.25, NEAR = 1.05, RIGHT = 0.98;
      const want = Math.min(0.5, safeLeft + 0.025);
      const need = HALF / (RIGHT - want) / tanH + NEAR;
      D0 = Math.min(Math.max(D0, need), D0 * 1.12);
      const hwNear = (D0 - NEAR) * tanH;
      // left edge just past the words, unless that pushes the right edge
      // off the screen (a small laptop): then the words overlap a little
      const clearOfText = -HALF - (want - 0.5) * 2 * hwNear;
      const inFrame = HALF - (RIGHT - 0.5) * 2 * hwNear;
      shift = Math.min(0, Math.max(clearOfText, inFrame));
    } else {
      shift = Math.min(0, -3.3 + 0.2 * D0 * tanH);
    }
  }
  // a phone (and, part way, a tablet) opens on its own zoomed-out shot
  const phone = phoneFront(aspect, vfov, safeBottom);
  const front = {
    t: 0,
    p: [lerp(shift, phone.p[0], tall), lerp(1.75, phone.p[1], tall), lerp(D0, phone.p[2], tall)],
    l: [lerp(shift, phone.l[0], tall), lerp(2.6, phone.l[1], tall), 0],
  };
  if (mode === "facade") {
    // A slow push towards the window. A phone has no room for the shop to
    // grow (the sign would slide under the header, the window into the
    // text), so there the camera mostly drifts sideways instead.
    const end = {
      t: 1,
      p: mix([shift * 0.6 + 0.35, 1.9, D0 * 0.72], [0.7, 2.05, D0 * 0.95]),
      l: mix([shift * 0.6 + 0.25, 3.05, 0], [0.1, -0.3, 0]),
    };
    return { vfov, keys: [front, end] };
  }
  const K = (t, pW, lW, pT, lT) => ({ t, p: mix(pW, pT), l: mix(lW, lT) });
  const door = [
    // up to the door, and in
    K(0.12, [1.15, 1.64, 3.8], [1.35, 1.6, -2], [1.15, 1.64, 4.2], [1.4, 1.6, -2]),
    K(0.21, [1.45, 1.6, 0.75], [0.95, 1.55, -5], [1.45, 1.6, 0.9], [1.0, 1.55, -5]),
  ];
  // The walk goes by section, the way the real shop is laid out: knitwear
  // (the cubby wall, left), hoodies (the rail under it), jackets & coats
  // (the racks, right), pants & jeans (the jeans wall, back left), shoes
  // (the shoe wall, back right), then the counter. Each section has two
  // keys — arrive, then a slow drift — so the view settles while its words
  // show (HomeLab SECTION_STATIONS).
  return {
    vfov,
    keys: [
      front,
      ...door,
      // knitwear
      K(0.28, [0.92, 1.62, -2.2], [-2.3, 1.9, -4.3], [0.8, 1.66, -1.1], [-2.3, 1.85, -4.4]),
      K(0.35, [0.86, 1.62, -3.0], [-2.3, 1.88, -5.1], [0.72, 1.66, -1.7], [-2.3, 1.85, -5.0]),
      // hoodies: down the aisle between the rail and the table
      K(0.42, [-1.15, 1.46, -2.15], [-2.12, 0.86, -4.6], [-1.0, 1.5, -1.9], [-1.95, 0.9, -5.3]),
      K(0.48, [-1.28, 1.45, -2.45], [-2.15, 0.84, -5.0], [-1.1, 1.48, -2.15], [-1.95, 0.88, -5.7]),
      // round the front of the table to the racks
      K(0.515, [0.3, 1.58, -3.05], [1.6, 1.5, -5.4], [0.3, 1.6, -2.9], [1.6, 1.5, -5.6]),
      // jackets & coats
      K(0.55, [0.4, 1.62, -4.7], [2.3, 1.6, -5.9], [0.36, 1.62, -4.1], [2.3, 1.5, -7.0]),
      K(0.61, [0.43, 1.62, -5.05], [2.3, 1.59, -6.25], [0.38, 1.62, -4.7], [2.3, 1.5, -7.6]),
      // pants & jeans
      K(0.68, [0.78, 1.6, -7.3], [-2.3, 1.35, -9.8], [0.62, 1.62, -6.9], [-2.3, 1.3, -10.4]),
      K(0.74, [0.68, 1.6, -7.8], [-2.3, 1.3, -10.3], [0.55, 1.62, -7.3], [-2.3, 1.28, -10.8]),
      // shoes, side-on along the wall
      K(0.81, [-0.4, 1.52, -7.7], [2.3, 1.12, -8.75], [-0.6, 1.55, -7.5], [2.3, 1.12, -9.2]),
      K(0.87, [-0.3, 1.5, -8.0], [2.3, 1.1, -8.95], [-0.5, 1.54, -7.8], [2.3, 1.1, -9.45]),
      // the counter
      K(0.95, [-0.15, 1.62, -8.5], [-1.3, 1.22, -12.6], [-0.3, 1.7, -8.3], [-1.05, 0.62, -12.6]),
      K(1, [-0.2, 1.62, -8.7], [-1.35, 1.2, -12.6], [-0.35, 1.7, -8.5], [-1.08, 0.6, -12.6]),
    ],
  };
}

export class KanaanStore {
  constructor(canvas, { mode = "walk", theme = "light", tier = "high", safe = {}, onSelect, onReady } = {}) {
    this.canvas = canvas;
    this.mode = mode;
    this.safe = { left: safe.left || 0, bottom: safe.bottom || 0 };
    this.tier = tier;
    this.onSelect = onSelect;
    this.onReady = onReady;
    this.night = theme === "dark" ? 1 : 0;
    this.nightTarget = this.night;
    this.progress = 0;
    this.progressTarget = 0;
    this.pointer = new THREE.Vector2();
    this.pointerTarget = new THREE.Vector2();
    this.start = performance.now();
    this.last = this.start;
    this.idleSince = this.start;
    this.raf = 0;
    this.visible = true;
    this.disposed = false;
    this.frameTimes = [];
    this.neonOn = 0;
    this.hovered = null;

    const maxDpr = tier === "high" ? 2 : 1.5;
    this.dpr = Math.min(window.devicePixelRatio || 1, maxDpr);
    const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: false, powerPreference: "high-performance" });
    renderer.setPixelRatio(this.dpr);
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    // One static shadow, drawn once: daylight on the sign's 3D letters. The
    // scene never moves, so the shadow map is rendered when the light
    // changes and simply reused on every other frame.
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFShadowMap;
    renderer.shadowMap.autoUpdate = false;
    this.renderer = renderer;

    const scene = new THREE.Scene();
    this.scene = scene;
    const pmrem = new THREE.PMREMGenerator(renderer);
    const env = new RoomEnvironment();
    scene.environment = pmrem.fromScene(env, 0.04).texture;
    env.dispose?.();
    pmrem.dispose();
    scene.fog = new THREE.FogExp2(LOOK.day.fog.clone(), LOOK.day.fogDensity);
    scene.background = LOOK.day.bg.clone();

    // near plane at 10 cm: the camera never comes closer to anything, and a
    // further near plane keeps surfaces a few mm apart from flickering
    this.camera = new THREE.PerspectiveCamera(50, 1, 0.1, 60);

    this.hemi = new THREE.HemisphereLight("#ffffff", "#999999", 1);
    scene.add(this.hemi);
    this.sun = new THREE.DirectionalLight("#ffd8b2", 2);
    this.sun.position.set(7.2, 6.6, 6.4);
    this.sun.target.position.set(0, 2.6, 0);
    this.sun.castShadow = true;
    const sc = this.sun.shadow.camera;
    sc.left = -5; sc.right = 5; sc.top = 4.6; sc.bottom = -4.6; sc.near = 2; sc.far = 26;
    this.sun.shadow.mapSize.set(tier === "high" ? 2048 : 1024, tier === "high" ? 2048 : 1024);
    this.sun.shadow.bias = -0.0004;
    this.sun.shadow.normalBias = 0.02;
    this.sun.shadow.radius = 3;
    scene.add(this.sun, this.sun.target);
    this.street = new THREE.DirectionalLight("#a8b6d6", 0);
    this.street.position.set(-7, 3, 9);
    scene.add(this.street);
    this.warmA = new THREE.PointLight("#ffcf9e", 2, 0, 2);
    this.warmA.position.set(0, 2.6, -3.4);
    this.warmB = new THREE.PointLight("#ffcf9e", 2, 0, 2);
    this.warmB.position.set(0, 2.6, -8.6);
    scene.add(this.warmA, this.warmB);

    const built = buildStore({ tier });
    this.reg = built.reg;
    this.built = built;
    scene.add(built.root);
    renderer.shadowMap.needsUpdate = true;
    // the floor's tile joints, the slatted back wall and the pavement are
    // fine repeating lines; seen at a slant while walking they shimmer
    // unless the GPU filters them more carefully
    const aniso = Math.min(8, renderer.capabilities.getMaxAnisotropy());
    built.root.traverse((o) => {
      const m = o.material;
      if (m && m.map && m.map.wrapS === THREE.RepeatWrapping) m.map.anisotropy = aniso;
    });

    this.loadNeonFont(this.reg.neonFont);
    // each section's pieces hang on paper swing tags in the shop (hangtags.js)
    this.hangTags = new HangTags(this, this.reg.tagSpots);

    this.raycaster = new THREE.Raycaster();

    this.resize(canvas.clientWidth || window.innerWidth, canvas.clientHeight || window.innerHeight);
    this.applyLook(true);
    this.updateCamera(1);
    this.bindInput();
    this.wake();
    // the first frame is drawn synchronously so a screenshot or a slow phone
    // never sees an empty canvas
    this.renderer.render(scene, this.camera);
    requestAnimationFrame(() => this.onReady && this.onReady());
  }

  /* ------------------------------------------------------------ inputs */
  setProgress(p) {
    const v = clamp(p, 0, 1);
    if (Math.abs(v - this.progressTarget) > 1e-4) {
      this.progressTarget = v;
      this.wake();
    }
  }

  setPointer(nx, ny) {
    this.pointerTarget.set(clamp(nx, -1, 1), clamp(ny, -1, 1));
    this.wake();
  }

  setTheme(theme) {
    this.nightTarget = theme === "dark" ? 1 : 0;
    this.wake();
  }

  setVisible(v) {
    this.visible = !!v;
    if (v) this.wake();
  }

  /* The mirror by the counter: the shop never moves, so instead of drawing
     the room twice on every frame, the store takes one snapshot of it from
     in front of the mirror (six small views, a cube) and the mirror reflects
     that. Taken again when day has turned to night, never while scrolling. */
  captureMirror() {
    const m = this.reg.mirror;
    if (!m) return;
    try {
      if (!this._mirrorCam) {
        const rt = new THREE.WebGLCubeRenderTarget(this.tier === "high" ? 256 : 128);
        this._mirrorRT = rt;
        this._mirrorCam = new THREE.CubeCamera(0.1, 16, rt);
        this._mirrorCam.position.copy(m.capture);
        this.scene.add(this._mirrorCam);
      }
      m.mesh.visible = false;
      this._mirrorCam.update(this.renderer, this.scene);
      m.mesh.visible = true;
      const mat = m.mesh.material;
      if (mat.envMap !== this._mirrorRT.texture) {
        mat.envMap = this._mirrorRT.texture;
        mat.envMapIntensity = 1;
        mat.needsUpdate = true;
      }
      this._mirrorAt = this.night;
    } catch {
      /* the mirror simply keeps the plain studio reflection */
    }
  }

  /* The shop's neon is drawn in its own script face; the sign stays off
     until the face has arrived, then flickers on. */
  loadNeonFont(f) {
    const draw = (family) => {
      if (this.disposed) return;
      const t = scriptNeonTexture(f.lines, f.color, family);
      const m = this.reg.neon.material;
      if (m.map) m.map.dispose();
      m.map = t;
      m.needsUpdate = true;
      f.ready = true;
      this.neonOn = 0;
      this.wake();
    };
    try {
      const face = new FontFace(f.family, `url(${f.url})`);
      face.load().then((ff) => {
        document.fonts.add(ff);
        draw(`"${f.family}"`);
      }).catch(() => draw(`"Snell Roundhand", "Segoe Script", cursive`));
    } catch {
      draw("cursive");
    }
  }

  /* The sections' pieces, for the hang tags: [{ id, to, items }] (see
     hangtags.js). */
  setTags(list) {
    this.hangTags.setData(list);
    this.wake();
  }

  bindInput() {
    const c = this.canvas;
    let down = null;
    this._onDown = (e) => { down = { x: e.clientX, y: e.clientY, t: performance.now() }; };
    this._onUp = (e) => {
      if (!down) return;
      const moved = Math.hypot(e.clientX - down.x, e.clientY - down.y);
      const quick = performance.now() - down.t < 450;
      down = null;
      if (moved > 8 || !quick) return;
      const hit = this.pick(e.clientX, e.clientY);
      if (hit && hit.product && this.onSelect) this.onSelect(hit.product);
    };
    this._onMove = (e) => {
      if (e.pointerType === "mouse") {
        const r = c.getBoundingClientRect();
        this.setPointer(((e.clientX - r.left) / r.width) * 2 - 1, -(((e.clientY - r.top) / r.height) * 2 - 1));
        const hit = this.pick(e.clientX, e.clientY);
        const next = hit && hit.product ? hit : null;
        if (next !== this.hovered) {
          this.hovered = next;
          c.style.cursor = next ? "pointer" : "";
          this.wake();
        }
      }
    };
    c.addEventListener("pointerdown", this._onDown);
    c.addEventListener("pointerup", this._onUp);
    c.addEventListener("pointermove", this._onMove);
    this._onVis = () => this.setVisible(document.visibilityState === "visible");
    document.addEventListener("visibilitychange", this._onVis);
  }

  pick(clientX, clientY) {
    const r = this.canvas.getBoundingClientRect();
    const v = new THREE.Vector2(((clientX - r.left) / r.width) * 2 - 1, -(((clientY - r.top) / r.height) * 2 - 1));
    this.raycaster.setFromCamera(v, this.camera);
    const targets = this.hangTags.pickables();
    const hits = this.raycaster.intersectObjects(targets.map((t) => t[0]), false);
    if (!hits.length || hits[0].distance > 9) return null;
    const hit = targets.find((t) => t[0] === hits[0].object);
    return hit ? hit[1] : null;
  }

  /* Where the page's words are, as shares of the screen, so the opening
     shot keeps the sign clear of them: on a wide screen where the headline
     ends (left), on a phone where the words begin (bottom). */
  setSafe({ left = 0, bottom = 0 } = {}) {
    const l = clamp(Number(left) || 0, 0, 0.6), b = clamp(Number(bottom) || 0, 0, 1);
    if (Math.abs(l - this.safe.left) < 0.004 && Math.abs(b - this.safe.bottom) < 0.004) return;
    this.safe = { left: l, bottom: b };
    if (this.w && this.h) this.resize(this.w, this.h);
  }

  resize(w, h) {
    if (!w || !h) return;
    this.w = w;
    this.h = h;
    this.renderer.setSize(w, h, false);
    this.camera.aspect = w / h;
    this.path = pathFor(w / h, this.mode, this.safe);
    // a phone starts further out across the street: thinner haze, so the
    // shop doesn't look washed out from there
    this.fogScale = lerp(1, 0.6, clamp((1.25 - w / h) / 0.7, 0, 1));
    this.camera.fov = this.path.vfov;
    this.camera.updateProjectionMatrix();
    this.posCurve = new THREE.CatmullRomCurve3(this.path.keys.map((k) => new THREE.Vector3(...k.p)), false, "centripetal");
    this.lookCurve = new THREE.CatmullRomCurve3(this.path.keys.map((k) => new THREE.Vector3(...k.l)), false, "centripetal");
    this.updateCamera(1);
    this.hangTags.layout();
    this.wake();
  }

  /* progress (0..1) -> curve parameter, honouring each key's own time */
  curveU(p) {
    const keys = this.path.keys;
    const n = keys.length - 1;
    for (let i = 0; i < n; i++) {
      if (p <= keys[i + 1].t) {
        const local = (p - keys[i].t) / (keys[i + 1].t - keys[i].t || 1);
        return (i + clamp(local, 0, 1)) / n;
      }
    }
    return 1;
  }

  updateCamera(alpha) {
    this.progress = lerp(this.progress, this.progressTarget, alpha);
    this.pointer.lerp(this.pointerTarget, Math.min(1, alpha * 0.8));
    const u = this.curveU(this.progress);
    const pos = this.posCurve.getPoint(u);
    const look = this.lookCurve.getPoint(u);
    // a little parallax with the mouse — the store answers the hand
    const k = this.progress < 0.08 ? 1 : 0.45;
    pos.x += this.pointer.x * 0.35 * k;
    pos.y += this.pointer.y * 0.18 * k;
    look.x += this.pointer.x * 0.12 * k;
    this.camera.position.copy(pos);
    this.camera.lookAt(look);
  }

  /* ------------------------------------------------------------ the look */
  applyLook(force) {
    const n = this.night;
    const a = LOOK.day, b = LOOK.night;
    const intro = this.introLevel();
    const scene = this.scene;
    scene.background.copy(a.bg).lerp(b.bg, n);
    scene.fog.color.copy(a.fog).lerp(b.fog, n);
    scene.fog.density = lerp(a.fogDensity, b.fogDensity, n) * (this.fogScale || 1);
    this.hemi.intensity = lerp(a.hemi, b.hemi, n);
    this.hemi.color.copy(a.hemiSky).lerp(b.hemiSky, n);
    this.hemi.groundColor.copy(a.hemiGround).lerp(b.hemiGround, n);
    // stepping in from the street, the eye leaves the daylight behind:
    // the shop is lit by its own lights from the door on
    const indoors = this.mode === "walk" ? smooth(0.14, 0.24, this.progress) : 0;
    this.sun.intensity = lerp(a.sun, b.sun, n) * (1 - 0.85 * indoors);
    this.street.intensity = lerp(a.street, b.street, n) * (1 - indoors);
    const lightsUp = 0.25 + 0.75 * intro.inside;
    const inside = lerp(a.warm, b.warm, n) * lightsUp * this.reg.fill;
    this.warmA.intensity = inside;
    this.warmB.intensity = inside;
    for (const s of this.reg.spots) s.light.intensity = lerp(s.day, s.night, n) * lightsUp;
    // after dark the whole interior waits for its lights to come on
    const dim = lerp(1, 0.3 + 0.7 * intro.inside, n);
    scene.environmentIntensity = lerp(a.env, b.env, n) * dim;
    this.hemi.intensity *= dim;
    for (const c of this.reg.colors || []) c.mat.color.copy(c.day).lerp(c.night, n);
    this.renderer.toneMappingExposure = lerp(a.exposure, b.exposure, n);
    for (const e of this.reg.emissive) {
      const v = lerp(e.day, e.night, n) * (0.2 + 0.8 * intro.inside);
      if (e.prop === "opacity") e.mat.opacity = v;
      else e.mat.emissiveIntensity = v;
    }
    // sign halo: night only, swept on letter by letter
    this.reg.halo.uniforms.uIntensity.value = n * 1.25;
    this.reg.halo.uniforms.uReveal.value = intro.sign * 1.12;
    // bulbs
    const bulbLevel = lerp(0.9, 3.2, n);
    let glowSum = 0;
    for (const bulb of this.reg.bulbs) glowSum += bulb.on;
    this.reg.bulbMat.emissiveIntensity = bulbLevel * (glowSum / this.reg.bulbs.length);
    this.reg.glowPoints.material.opacity = lerp(0.12, 0.85, n) * (glowSum / this.reg.bulbs.length);
    // the neon on the partition, once its face has arrived
    const neon = this.neonOn * (this.reg.neonFont.ready ? 1 : 0);
    this.reg.neon.material.opacity = neon * lerp(0.85, 1, n);
    this.reg.neonGlow.opacity = neon * lerp(0.06, 0.34, n);
    if (force) this.dirty = true;
  }

  /* 0..1 levels of the opening sequence: bulbs flicker on one by one, the
     sign's halo sweeps across the letters, then the shop lights come up. */
  introLevel() {
    const t = (performance.now() - this.start) / 1000;
    if (this._introDone) return { sign: 1, inside: 1 };
    const sign = smooth(0.35, 1.9, t);
    const inside = smooth(0.7, 2.1, t);
    let all = true;
    for (const b of this.reg.bulbs) {
      const lt = t - 0.15 - b.delay;
      if (lt <= 0) { b.on = 0; all = false; continue; }
      // a couple of quick flickers before it holds
      const flick = lt < 0.24 ? (Math.sin(lt * 70 + b.phase) > -0.2 ? 1 : 0.15) : 1;
      b.on = Math.min(1, lt * 6) * flick;
      if (lt < 0.24) all = false;
    }
    if (all && sign >= 1 && inside >= 1) this._introDone = true;
    return { sign, inside };
  }

  /* ------------------------------------------------------------ loop */
  wake() {
    this.idleSince = performance.now();
    if (!this.raf && !this.disposed && this.visible) {
      this.last = performance.now();
      this.raf = requestAnimationFrame(this._tick);
    }
  }

  _tick = (now) => {
    this.raf = 0;
    if (this.disposed || !this.visible) return;
    const dt = Math.min(0.05, (now - this.last) / 1000);
    this.last = now;
    let active = false;

    // ease toward the targets (frame-rate independent)
    const alpha = 1 - Math.exp(-dt * 6.5);
    if (Math.abs(this.progress - this.progressTarget) > 1e-4 || this.pointer.distanceTo(this.pointerTarget) > 1e-3) active = true;
    this.updateCamera(alpha);

    if (Math.abs(this.night - this.nightTarget) > 1e-3) {
      this.night += (this.nightTarget - this.night) * (1 - Math.exp(-dt * 2.6));
      active = true;
    } else this.night = this.nightTarget;

    if (!this._introDone) active = true;

    // the door swings open as the camera reaches it
    const doorOpen = smooth(0.1, 0.2, this.progress);
    const ang = -1.45 * doorOpen;
    if (Math.abs(this.reg.door.rotation.y - ang) > 1e-4) {
      this.reg.door.rotation.y = ang;
      active = true;
    }

    // the neon is simply on, like the real one — it flickers on once
    if (this.reg.neonFont.ready && this.neonOn < 1 - 1e-3) {
      const flicker = Math.sin(now * 0.05) > 0.4 ? 0.5 : 1;
      this.neonOn += (1 - this.neonOn) * (1 - Math.exp(-dt * 5)) * flicker;
      active = true;
    }

    // bulbs sway gently, more while things are moving
    const sway = active ? 1 : 0.4;
    const ts = now / 1000;
    const glowAttr = this.reg.glowPoints.geometry.attributes.position;
    this.reg.bulbs.forEach((b, i) => {
      const dx = Math.sin(ts * 1.3 + b.phase) * 0.006 * sway;
      b.mesh.position.x = b.base.x + dx;
      glowAttr.setX(i, b.base.x + dx);
    });
    glowAttr.needsUpdate = true;

    if (this.hangTags.update(dt, this.hovered)) active = true;
    this.applyLook(false);
    if (this._introDone && this.night === this.nightTarget && this._mirrorAt !== this.night) this.captureMirror();
    this.renderer.render(this.scene, this.camera);
    this.measure(dt);

    if (active) this.idleSince = now;
    // keep breathing for a moment after the last change, then stop drawing
    if (now - this.idleSince < 1600) this.raf = requestAnimationFrame(this._tick);
  };

  /* If the phone can't keep up, draw fewer pixels rather than drop frames. */
  measure(dt) {
    if (this._tuned) return;
    this.frameTimes.push(dt);
    if (this.frameTimes.length < 40) return;
    const avg = this.frameTimes.reduce((a, b) => a + b, 0) / this.frameTimes.length;
    this.frameTimes.length = 0;
    if (avg > 0.024 && this.dpr > 1) {
      this.dpr = Math.max(1, this.dpr - 0.35);
      this.renderer.setPixelRatio(this.dpr);
      this.renderer.setSize(this.w, this.h, false);
    } else {
      this._tuned = true;
    }
  }

  snapshot(type = "image/webp", q = 0.86) {
    this.renderer.render(this.scene, this.camera);
    return this.renderer.domElement.toDataURL(type, q);
  }

  dispose() {
    this.disposed = true;
    cancelAnimationFrame(this.raf);
    const c = this.canvas;
    c.removeEventListener("pointerdown", this._onDown);
    c.removeEventListener("pointerup", this._onUp);
    c.removeEventListener("pointermove", this._onMove);
    document.removeEventListener("visibilitychange", this._onVis);
    this.scene.traverse((o) => {
      if (o.geometry) o.geometry.dispose();
      const mats = Array.isArray(o.material) ? o.material : o.material ? [o.material] : [];
      for (const m of mats) {
        for (const k of Object.keys(m)) if (m[k] && m[k].isTexture) m[k].dispose();
        m.dispose();
      }
    });
    if (this.scene.environment) this.scene.environment.dispose();
    if (this._mirrorRT) this._mirrorRT.dispose();
    this.hangTags.dispose();
    this.renderer.dispose();
  }
}
