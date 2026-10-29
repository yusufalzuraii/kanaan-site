/* The pieces of a section, out of the shelf and in front of you.

   No frames on the walls: when the walk stops at a section (the jackets,
   say), that section's pieces leave the rack one after another — each
   starts small and flat against its own stock, swings round on a little
   arc and settles facing you, in a loose row on the side of the screen the
   words aren't on (on a phone, above the words). Each is the piece's photo
   with its price; tap one and it opens. Walk on and they slip back.

   They're real objects in the shop, not stickers on the screen: they float
   about a metre in front of you, so the shop moves behind them as the
   camera drifts and the mouse leans the view.

   Driven by the store: setData() with the sections and their pieces,
   layout() whenever the screen changes shape, update() every frame (says
   whether anything is still moving, so the store knows to keep drawing),
   pick() for taps and hovers. */
import * as THREE from "three";

const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
const easeOutCubic = (t) => 1 - Math.pow(1 - t, 3);
const easeInOut = (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
const easeOutBack = (t) => {
  const c1 = 1.25, c3 = c1 + 1;
  return 1 + c3 * Math.pow(t - 1, 3) + c1 * Math.pow(t - 1, 2);
};

const OUT_S = 0.8;   // seconds for one piece to come out
const STAGGER = 0.11; // between pieces
const BACK_S = 0.42; // seconds to slip back

function loadImage(url) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.decoding = "async";
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = url;
  });
}

function roundRect(g, x, y, w, h, r) {
  g.beginPath();
  g.moveTo(x + r, y);
  g.arcTo(x + w, y, x + w, y + h, r);
  g.arcTo(x + w, y + h, x, y + h, r);
  g.arcTo(x, y + h, x, y, r);
  g.arcTo(x, y, x + w, y, r);
  g.closePath();
}

/* The card: the photo with soft round corners and the price in a pill
   (coral when it's on sale, with the old price struck through). The pill
   sits on the card's outer corner (`right` for the cards right of the
   middle), the part a neighbour in the fan never covers. */
function cardTexture(img, item, right = false) {
  const W = 512, H = 640;
  const c = document.createElement("canvas");
  c.width = W;
  c.height = H;
  const g = c.getContext("2d");
  g.save();
  roundRect(g, 0, 0, W, H, 40);
  g.clip();
  g.fillStyle = "#e9e7e3";
  g.fillRect(0, 0, W, H);
  const iw = img.naturalWidth || img.width, ih = img.naturalHeight || img.height;
  const s = Math.max(W / iw, H / ih);
  g.drawImage(img, (W - iw * s) / 2, (H - ih * s) / 2, iw * s, ih * s);
  // a soft fall-off at the foot so the pill reads on any photo
  const grd = g.createLinearGradient(0, H * 0.7, 0, H);
  grd.addColorStop(0, "rgba(0,0,0,0)");
  grd.addColorStop(1, "rgba(0,0,0,0.28)");
  g.fillStyle = grd;
  g.fillRect(0, 0, W, H);
  g.restore();
  // the glassy edge where the light catches it
  g.strokeStyle = "rgba(255,255,255,0.55)";
  g.lineWidth = 3;
  roundRect(g, 1.5, 1.5, W - 3, H - 3, 39);
  g.stroke();
  // price
  if (item.price) {
    const sale = !!item.was;
    g.font = `600 44px "Space Grotesk", system-ui, sans-serif`;
    const pw = g.measureText(item.price).width;
    g.font = `500 30px Inter, system-ui, sans-serif`;
    const ww = sale ? g.measureText(item.was).width + 16 : 0;
    const bw = pw + ww + 44, bh = 70, bx = right ? W - 24 - bw : 24, by = H - bh - 24;
    g.fillStyle = sale ? "#FF4522" : "rgba(255,255,255,0.92)";
    roundRect(g, bx, by, bw, bh, bh / 2);
    g.fill();
    g.textBaseline = "middle";
    g.fillStyle = sale ? "#ffffff" : "#14141A";
    g.font = `600 44px "Space Grotesk", system-ui, sans-serif`;
    g.fillText(item.price, bx + 22, by + bh / 2 + 2);
    if (sale) {
      g.font = `500 30px Inter, system-ui, sans-serif`;
      g.fillStyle = "rgba(255,255,255,0.78)";
      const x = bx + 22 + pw + 16;
      g.fillText(item.was, x, by + bh / 2 + 3);
      g.fillRect(x, by + bh / 2 + 2, ww - 16, 2.5);
    }
  }
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 4;
  return t;
}

/* A soft shadow under a card, drawn once and shared. */
function shadowTexture() {
  const c = document.createElement("canvas");
  c.width = 256;
  c.height = 320;
  const g = c.getContext("2d");
  g.shadowColor = "rgba(0,0,0,0.55)";
  g.shadowBlur = 34;
  g.fillStyle = "rgba(0,0,0,0.55)";
  roundRect(g, 48, 56, 160, 208, 22);
  g.fill();
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

export class Showcase {
  constructor(store, spots) {
    this.store = store;
    this.spots = spots || {};
    this.root = new THREE.Group();
    this.root.name = "showcase";
    store.scene.add(this.root);
    this.sections = [];
    this.geo = new THREE.PlaneGeometry(1, 1.25);
    this.shadowGeo = new THREE.PlaneGeometry(1.5, 1.875);
    this.shadowTex = shadowTexture();
    this.tmp = new THREE.PerspectiveCamera();
    this.disposed = false;
    this.showing = null;
  }

  /* sections: [{ id, from, to, side: "start" | "end", items: [{ id, image, price, was, product }] }] */
  setData(list) {
    const key = JSON.stringify((list || []).map((s) => [s.id, s.from, s.to, s.side, (s.items || []).map((i) => i.id + i.price)]));
    if (key === this.key) return;
    this.key = key;
    this.clear();
    const fontsReady = document.fonts && document.fonts.load
      ? Promise.all([document.fonts.load('600 44px "Space Grotesk"'), document.fonts.load("500 30px Inter")]).catch(() => {})
      : Promise.resolve();
    for (const s of list || []) {
      const spot = this.spots[s.id];
      if (!spot || !s.items || !s.items.length) continue;
      const group = new THREE.Group();
      group.visible = false;
      this.root.add(group);
      const sec = { ...s, group, cards: [], time: 0, on: false };
      const face = new THREE.Vector3(...spot.face).normalize();
      const qFrom = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 0, 1), face);
      s.items.slice(0, 4).forEach((item, i) => {
        const mat = new THREE.MeshBasicMaterial({ transparent: true, opacity: 0, toneMapped: false, fog: false, depthWrite: false });
        const mesh = new THREE.Mesh(this.geo, mat);
        mesh.visible = false;
        const shadow = new THREE.Mesh(this.shadowGeo, new THREE.MeshBasicMaterial({ map: this.shadowTex, transparent: true, opacity: 0, depthWrite: false, fog: false }));
        shadow.visible = false;
        group.add(shadow, mesh);
        const from = new THREE.Vector3(...spot.spots[i % spot.spots.length]);
        const card = { item, product: item, mesh, shadow, mat, p: 0, hover: 0, ready: false, from, qFrom, to: from.clone(), qTo: qFrom.clone(), size: 0.3, index: i, sec };
        sec.cards.push(card);
        fontsReady.then(() => loadImage(item.image)).then((img) => {
          if (this.disposed) return;
          mat.map = cardTexture(img, item, i >= 2);
          mat.needsUpdate = true;
          card.ready = true;
          this.store.wake();
        }).catch(() => { /* no photo: that piece simply stays on the shelf */ });
      });
      this.sections.push(sec);
    }
    this.layout();
  }

  clear() {
    for (const s of this.sections) {
      for (const c of s.cards) {
        if (c.mat.map) c.mat.map.dispose();
        c.mat.dispose();
        c.shadow.material.dispose();
      }
      this.root.remove(s.group);
    }
    this.sections = [];
    this.showing = null;
  }

  /* Where each piece settles: worked out from where the camera stands at
     the end of that section's stop, so on every screen shape they land in
     the free part of the picture. */
  layout() {
    const st = this.store;
    if (!st.path || !st.posCurve) return;
    const aspect = st.camera.aspect;
    const tall = aspect < 1.05;
    const vfov = st.camera.fov;
    const tanV = Math.tan(THREE.MathUtils.degToRad(vfov / 2));
    const tanH = tanV * aspect;
    const cam = this.tmp;
    for (const s of this.sections) {
      const u = st.curveU(s.to);
      cam.position.copy(st.posCurve.getPoint(u));
      cam.lookAt(st.lookCurve.getPoint(u));
      cam.updateMatrixWorld();
      const right = new THREE.Vector3().setFromMatrixColumn(cam.matrixWorld, 0);
      const up = new THREE.Vector3().setFromMatrixColumn(cam.matrixWorld, 1);
      const fwd = new THREE.Vector3().setFromMatrixColumn(cam.matrixWorld, 2).negate();
      const cards = s.cards;
      const n = tall ? Math.min(cards.length, 3) : cards.length;
      const d = tall ? 0.95 : 1.05;
      // the free part of the screen, in -1..1 across and up
      let x0 = -0.92, x1 = 0.02;
      if (tall) { x0 = -0.94; x1 = 0.94; } else if (s.side === "start") { x0 = -0.02; x1 = 0.92; }
      const yc = tall ? 0.3 : -0.02;
      // a fanned hand of cards: big enough to see, overlapping a little,
      // the middle ones nearest
      let hFrac = tall ? 0.2 : 0.34;                // card height, share of the screen
      const wOf = (hf) => (2 * hf * 0.8) / aspect;  // card width across the screen (-1..1)
      while (wOf(hFrac) * (1 + (n - 1) * 0.55) > x1 - x0 && hFrac > 0.1) hFrac *= 0.95;
      const cw = wOf(hFrac);
      const step = n > 1 ? Math.min(cw * 0.86, (x1 - x0 - cw) / (n - 1)) : 0;
      const rowW = cw + step * (n - 1);
      const start = (x0 + x1) / 2 - rowW / 2;
      const h = 2 * d * tanV * hFrac;
      cards.forEach((c, i) => {
        if (i >= n) { c.skip = true; return; }
        c.skip = false;
        const k = n > 1 ? (i / (n - 1)) * 2 - 1 : 0;      // -1 .. 1 along the row
        const di = d - 0.09 * (1 - k * k);                // the middle comes forward
        const xi = start + cw / 2 + step * i;
        const yi = yc - 0.05 * k * k;                      // the ends dip, like a hand of cards
        c.to.copy(cam.position)
          .addScaledVector(fwd, di)
          .addScaledVector(right, xi * di * tanH)
          .addScaledVector(up, yi * di * tanV);
        c.qTo.copy(cam.quaternion)
          .multiply(new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), -k * (tall ? 0.22 : 0.3)))
          .multiply(new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 0, 1), -k * 0.05));
        c.size = h / 1.25;
        c.towards = fwd.clone().negate();
      });
    }
  }

  /* The section the walk is at (or null), with a little give at the edges
     so a piece doesn't flicker out while you're still reading. */
  current(progress) {
    for (const s of this.sections) if (progress >= s.from - 0.012 && progress <= s.to + 0.012) return s;
    return null;
  }

  update(dt, progress, hovered) {
    if (!this.sections.length) return false;
    const cur = this.current(progress);
    let moving = false;
    for (const s of this.sections) {
      const on = s === cur;
      if (on !== s.on) { s.on = on; s.time = 0; }
      s.time += dt;
      let any = false;
      for (const c of s.cards) {
        if (c.skip || !c.ready) { c.mesh.visible = c.shadow.visible = false; continue; }
        const target = on ? 1 : 0;
        if (on && s.time < c.index * STAGGER) { /* waiting its turn */ }
        else if (c.p !== target) {
          c.p = on ? Math.min(1, c.p + dt / OUT_S) : Math.max(0, c.p - dt / BACK_S);
          moving = true;
        }
        const hv = hovered === c ? 1 : 0;
        if (Math.abs(c.hover - hv) > 1e-3) {
          c.hover += (hv - c.hover) * (1 - Math.exp(-dt * 12));
          moving = true;
        }
        const vis = c.p > 0.001;
        c.mesh.visible = c.shadow.visible = vis;
        if (!vis) continue;
        any = true;
        const e = easeOutCubic(c.p);
        const m = c.mesh;
        m.position.lerpVectors(c.from, c.to, e);
        m.position.y += Math.sin(Math.PI * e) * 0.14;          // a little arc up and out
        if (c.towards) m.position.addScaledVector(c.towards, c.hover * 0.09);
        m.quaternion.slerpQuaternions(c.qFrom, c.qTo, easeInOut(c.p));
        const sc = c.size * (0.22 + 0.78 * easeOutBack(c.p)) * (1 + c.hover * 0.06);
        m.scale.setScalar(sc);
        c.mat.opacity = clamp(c.p * 3, 0, 1);
        // the shadow sits just behind and a touch below
        c.shadow.position.copy(m.position);
        if (c.towards) c.shadow.position.addScaledVector(c.towards, -0.03);
        c.shadow.position.y -= sc * 0.06;
        c.shadow.quaternion.copy(m.quaternion);
        c.shadow.scale.setScalar(sc);
        c.shadow.material.opacity = clamp(c.p * 2 - 1, 0, 1) * 0.42;
      }
      s.group.visible = any;
    }
    // say which section's pieces are out or on their way (for the page and
    // its tests)
    const out = cur && cur.cards.some((c) => c.ready && c.p > 0) ? cur.id : null;
    if (out !== this.showing) {
      this.showing = out;
      const el = this.store.canvas;
      if (out) el.dataset.showing = out;
      else delete el.dataset.showing;
    }
    return moving;
  }

  /* the cards that are out, for taps and hovers */
  pickables() {
    const list = [];
    for (const s of this.sections) for (const c of s.cards) if (c.mesh.visible && c.p > 0.85) list.push(c);
    return list;
  }

  dispose() {
    this.disposed = true;
    this.clear();
    this.geo.dispose();
    this.shadowGeo.dispose();
    this.shadowTex.dispose();
    this.store.scene.remove(this.root);
  }
}
