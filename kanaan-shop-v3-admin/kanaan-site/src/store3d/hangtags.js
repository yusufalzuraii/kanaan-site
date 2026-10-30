/* Hang tags: the pieces of each section, on tags hung in the shop.

   Like a real shop, but bigger: at every section a few of its pieces hang
   on paper swing tags — on the cubby shelves, on the hoodies, on the
   jackets' rail, on the jeans shelves and the shoe shelves. Each tag has
   the piece's photo, its name and its price (coral with the old price
   struck through when it's on sale) and the shop's name at the foot; a
   thin black string ties it to the shelf or the rail. Tap a tag and the
   piece opens; on a computer a tag lifts and turns to you as the mouse
   finds it.

   They are part of the shop, so they're always there, not only at the
   stops; each one hangs turned towards where you'll stand to look at it.
   They sway a little as you walk past and settle when you stop (so the
   store can stop drawing).

   Driven by the store: setData() with the sections and their pieces,
   layout() when the screen changes shape (the stopping places change with
   it), update() every frame, pickables() for taps and hovers. */
import * as THREE from "three";
import { logoCanvasTexture } from "./textures.js";

const clamp = (v, a, b) => Math.min(b, Math.max(a, v));

// the tag, in metres (a big display tag, so it reads from the aisle)
const TAG_W = 0.15;
const TAG_H = TAG_W * (680 / 400);

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

/* name on at most two lines, with an ellipsis if it runs on */
function wrap(g, text, maxW) {
  const words = String(text || "").split(/\s+/);
  const lines = [""];
  for (const w of words) {
    const tryLine = lines[lines.length - 1] ? `${lines[lines.length - 1]} ${w}` : w;
    if (g.measureText(tryLine).width <= maxW) lines[lines.length - 1] = tryLine;
    else if (lines.length < 2) lines.push(w);
    else {
      let last = lines[1];
      while (last && g.measureText(`${last}…`).width > maxW) last = last.slice(0, -1);
      lines[1] = `${last}…`;
      break;
    }
  }
  return lines.filter(Boolean);
}

let logoCanvas = null;
function logo() {
  if (!logoCanvas) {
    try { logoCanvas = logoCanvasTexture({ width: 256, color: "#14141A", pad: 0.02, parts: ["letters"] }).image; } catch { logoCanvas = null; }
  }
  return logoCanvas;
}

/* The swing tag: off-white card with chamfered top corners and an eyelet,
   the photo, the name, the price, the shop's name at the foot. */
function tagTexture(img, item) {
  const W = 400, H = 680;
  const c = document.createElement("canvas");
  c.width = W;
  c.height = H;
  const g = c.getContext("2d");
  // the card
  const ch = 54; // chamfer
  g.beginPath();
  g.moveTo(ch, 0);
  g.lineTo(W - ch, 0);
  g.lineTo(W, ch);
  g.lineTo(W, H - 14);
  g.quadraticCurveTo(W, H, W - 14, H);
  g.lineTo(14, H);
  g.quadraticCurveTo(0, H, 0, H - 14);
  g.lineTo(0, ch);
  g.closePath();
  g.fillStyle = "#f7f5f0";
  g.fill();
  // a little paper grain
  g.save();
  g.clip();
  for (let i = 0; i < 900; i++) {
    g.fillStyle = `rgba(0,0,0,${0.012 + Math.random() * 0.02})`;
    g.fillRect(Math.random() * W, Math.random() * H, 1.5, 1.5);
  }
  g.restore();
  // the eyelet: a punched hole with a metal ring
  g.save();
  g.globalCompositeOperation = "destination-out";
  g.beginPath();
  g.arc(W / 2, 36, 11, 0, Math.PI * 2);
  g.fill();
  g.restore();
  g.strokeStyle = "#8d8e93";
  g.lineWidth = 5;
  g.beginPath();
  g.arc(W / 2, 36, 14, 0, Math.PI * 2);
  g.stroke();
  // the photo
  const px = 28, py = 74, pw = W - 56, ph = 344;
  g.save();
  roundRect(g, px, py, pw, ph, 14);
  g.clip();
  g.fillStyle = "#e6e3dd";
  g.fillRect(px, py, pw, ph);
  const iw = img.naturalWidth || img.width, ih = img.naturalHeight || img.height;
  const s = Math.max(pw / iw, ph / ih);
  g.drawImage(img, px + (pw - iw * s) / 2, py + (ph - ih * s) / 2, iw * s, ih * s);
  g.restore();
  // the name
  g.fillStyle = "#14141A";
  g.font = `500 29px Inter, system-ui, sans-serif`;
  g.textBaseline = "top";
  wrap(g, item.name, W - 56).forEach((line, i) => g.fillText(line, 28, 440 + i * 36));
  // the price
  g.font = `700 54px "Space Grotesk", system-ui, sans-serif`;
  g.textBaseline = "alphabetic";
  const sale = !!item.was;
  g.fillStyle = sale ? "#FF4522" : "#14141A";
  g.fillText(item.price || "", 28, 580);
  if (sale) {
    const pw2 = g.measureText(item.price || "").width;
    g.font = `500 30px Inter, system-ui, sans-serif`;
    g.fillStyle = "rgba(20,20,26,0.5)";
    const x = 28 + pw2 + 16;
    g.fillText(item.was, x, 576);
    g.fillRect(x, 566, g.measureText(item.was).width, 2.5);
  }
  // a hairline and the shop's name at the foot
  g.fillStyle = "rgba(20,20,26,0.14)";
  g.fillRect(28, 610, W - 56, 2);
  const lg = logo();
  if (lg) {
    const lw = 120, lh = lw * (lg.height / lg.width);
    g.drawImage(lg, 28, 636 - lh / 2, lw, lh);
  }
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 8;
  return t;
}

export class HangTags {
  constructor(store, spots) {
    this.store = store;
    this.spots = spots || {};
    this.root = new THREE.Group();
    this.root.name = "hang-tags";
    store.scene.add(this.root);
    this.tags = [];
    this.geo = new THREE.PlaneGeometry(TAG_W, TAG_H);
    this.geo.translate(0, -TAG_H / 2, 0); // hangs from its eyelet
    this.stringMat = new THREE.MeshBasicMaterial({ color: "#151517" });
    this.sway = 0;
    this.time = 0;
    this.lastCam = new THREE.Vector3();
    this.disposed = false;
  }

  /* sections: [{ id, to, items: [{ id, name, image, price, was, product }] }] */
  setData(list) {
    const key = JSON.stringify((list || []).map((s) => [s.id, s.to, (s.items || []).map((i) => i.id + i.price)]));
    if (key === this.key) return;
    this.key = key;
    this.clear();
    const fontsReady = document.fonts && document.fonts.load
      ? Promise.all([document.fonts.load('700 54px "Space Grotesk"'), document.fonts.load("500 29px Inter")]).catch(() => {})
      : Promise.resolve();
    this.sections = list || [];
    for (const s of this.sections) {
      const spot = this.spotsFor(s.id);
      if (!spot || !s.items) continue;
      s.items.slice(0, spot.length).forEach((item, i) => {
        const [x, y, z, drop] = spot[i];
        // pivot at the knot on the shelf or rail; the string, then the tag
        const pivot = new THREE.Group();
        pivot.position.set(x, y, z);
        pivot.visible = false;
        const sGeo = new THREE.CylinderGeometry(0.0012, 0.0012, drop, 4);
        sGeo.translate(0, -drop / 2, 0);
        const string = new THREE.Mesh(sGeo, this.stringMat);
        const mat = new THREE.MeshStandardMaterial({ transparent: true, alphaTest: 0.5, roughness: 0.85, metalness: 0, side: THREE.DoubleSide, envMapIntensity: 0.5 });
        const card = new THREE.Mesh(this.geo, mat);
        card.position.y = -drop + 0.012; // the string runs through the eyelet
        const swing = new THREE.Group(); // turns to you, sways
        swing.add(string, card);
        pivot.add(swing);
        this.root.add(pivot);
        const tag = { item, product: item, section: s.id, index: i, drop, pivot, swing, string, card, mat, sGeo, hover: 0, phase: i * 1.7 + s.id.length, ready: false, yaw: 0 };
        this.tags.push(tag);
        fontsReady.then(() => loadImage(item.image)).then((img) => {
          if (this.disposed) return;
          mat.map = tagTexture(img, item);
          mat.needsUpdate = true;
          tag.ready = true;
          pivot.visible = true;
          this.markReady();
          this.store.wake();
        }).catch(() => { /* no photo: no tag */ });
      });
    }
    this.layout();
  }

  /* the canvas says which sections have tags up (for the page's tests) */
  markReady() {
    const ids = [...new Set(this.tags.filter((t) => t.ready).map((t) => t.section))];
    const el = this.store.canvas;
    if (ids.length) el.dataset.tags = ids.join(" ");
    else delete el.dataset.tags;
  }

  clear() {
    for (const t of this.tags) {
      if (t.mat.map) t.mat.map.dispose();
      t.mat.dispose();
      t.sGeo.dispose();
      this.root.remove(t.pivot);
    }
    this.tags = [];
    this.markReady();
  }

  /* Where a section's tags hang: a phone looks along the walls and a
     computer at them side-on, so each has its own spots on the same rails
     and shelves — the ones that read clear of the page's words from the
     stop (found by measuring every spot from both). */
  spotsFor(id) {
    const tall = this.store.camera && this.store.camera.aspect < 1.05;
    const set = this.spots && (this.spots.tall || this.spots.wide) ? this.spots[tall ? "tall" : "wide"] || this.spots.wide : this.spots;
    return set ? set[id] : null;
  }

  /* Each tag turns (on its string) towards where you'll stand to look at
     that section, so it reads face-on from the stop on every screen. */
  layout() {
    const st = this.store;
    if (!st.posCurve || !this.sections) return;
    const tall = st.camera.aspect < 1.05;
    for (const s of this.sections) {
      const eye = st.posCurve.getPoint(st.curveU(s.to));
      const spot = this.spotsFor(s.id) || [];
      for (const t of this.tags) {
        if (t.section !== s.id) continue;
        // the screen changed shape (a tablet turned): the tag moves to that screen's spot
        const sp = spot[t.index];
        if (sp) {
          t.pivot.position.set(sp[0], sp[1], sp[2]);
          if (Math.abs(sp[3] - t.drop) > 1e-6) {
            t.drop = sp[3];
            t.sGeo.dispose();
            t.sGeo = new THREE.CylinderGeometry(0.0012, 0.0012, sp[3], 4);
            t.sGeo.translate(0, -sp[3] / 2, 0);
            t.string.geometry = t.sGeo;
            t.card.position.y = -sp[3] + 0.012;
          }
        }
        const p = t.pivot.position;
        t.yaw = Math.atan2(eye.x - p.x, eye.z - p.z);
        // a phone shows the shop smaller: its tags are a size up
        t.pivot.scale.setScalar(tall ? 1.3 : 1);
      }
    }
  }

  update(dt, hovered) {
    if (!this.tags.length) return false;
    // walking stirs the air: the tags sway with the camera's speed and
    // settle when it stops
    const cam = this.store.camera.position;
    const speed = this.lastCam.distanceTo(cam) / Math.max(dt, 1e-3);
    this.lastCam.copy(cam);
    const target = clamp(speed * 0.35, 0, 1);
    this.sway += (target - this.sway) * (1 - Math.exp(-dt * (target > this.sway ? 6 : 1.4)));
    if (this.sway < 0.002) this.sway = 0;
    this.time += dt;
    let moving = this.sway > 0;
    for (const t of this.tags) {
      if (!t.ready) continue;
      const hv = hovered === t ? 1 : 0;
      if (Math.abs(t.hover - hv) > 1e-3) {
        t.hover += (hv - t.hover) * (1 - Math.exp(-dt * 12));
        moving = true;
      }
      const a = this.sway * Math.sin(this.time * 2.6 + t.phase);
      t.swing.rotation.set(0, t.yaw + a * 0.25, a * 0.07);
      // found by the mouse: it lifts a touch and comes forward
      t.swing.position.set(Math.sin(t.yaw) * 0.03 * t.hover, 0.02 * t.hover, Math.cos(t.yaw) * 0.03 * t.hover);
      t.card.scale.setScalar(1 + 0.08 * t.hover);
    }
    return moving;
  }

  pickables() {
    return this.tags.filter((t) => t.ready && t.pivot.visible).map((t) => [t.card, t]);
  }

  /* Where the middle of each tag that's up is on the page (CSS pixels),
     optionally for one section — for the page's own tests, which tap them
     like a shopper would. */
  screenPoints(section) {
    const st = this.store;
    const r = st.canvas.getBoundingClientRect();
    const v = new THREE.Vector3();
    st.camera.updateMatrixWorld();
    return this.tags
      .filter((t) => t.ready && t.pivot.visible && (!section || t.section === section))
      .map((t) => {
        v.set(0, -TAG_H / 2, 0);
        t.card.localToWorld(v);
        v.project(st.camera);
        return { id: t.item.id, section: t.section, x: r.left + ((v.x + 1) / 2) * r.width, y: r.top + ((1 - v.y) / 2) * r.height, z: v.z };
      })
      .filter((p) => p.z > -1 && p.z < 1);
  }

  dispose() {
    this.disposed = true;
    this.clear();
    this.geo.dispose();
    this.stringMat.dispose();
    this.store.scene.remove(this.root);
  }
}
