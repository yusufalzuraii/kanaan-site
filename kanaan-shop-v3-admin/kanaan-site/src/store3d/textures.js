/* Procedural textures for the 3D store.

   Everything here is drawn on a canvas at start-up instead of being shipped
   as image files: a tiled floor, the fold of a stacked T-shirt and a soft
   glow are a few lines of drawing code but would be hundreds of kilobytes
   as photos — and the visitor's phone would have to download them before
   the store could appear. */
import * as THREE from "three";
import { LOGO } from "./logoShapes.js";

function canvas(w, h) {
  const c = document.createElement("canvas");
  c.width = w;
  c.height = h;
  return [c, c.getContext("2d")];
}

function tex(c, { repeat, srgb = true, mips = true } = {}) {
  const t = new THREE.CanvasTexture(c);
  if (srgb) t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 4;
  if (!mips) {
    t.generateMipmaps = false;
    t.minFilter = THREE.LinearFilter;
  }
  if (repeat) {
    t.wrapS = t.wrapT = THREE.RepeatWrapping;
    t.repeat.set(repeat[0], repeat[1]);
  }
  return t;
}

// A tiny deterministic random, so the floor and the stock look the same on
// every visit (a store that rearranges itself on refresh reads as a glitch).
export function rng(seed = 7) {
  let s = seed >>> 0;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 4294967296;
  };
}

/* Glossy grey porcelain, 60 cm tiles with a hairline joint — the floor in
   the shop photos. Two tiles per texture repeat. */
export function floorTexture() {
  const [c, g] = canvas(512, 512);
  const r = rng(11);
  g.fillStyle = "#9c9da2";
  g.fillRect(0, 0, 512, 512);
  // soft mottling so the tiles read as stone, not flat paint
  for (let i = 0; i < 900; i++) {
    const x = r() * 512, y = r() * 512, s = 6 + r() * 40;
    g.fillStyle = `rgba(${r() < 0.5 ? "255,255,255" : "40,40,46"},${0.015 + r() * 0.03})`;
    g.beginPath();
    g.arc(x, y, s, 0, Math.PI * 2);
    g.fill();
  }
  g.fillStyle = "rgba(30,30,34,0.55)";
  for (const p of [0, 256]) {
    g.fillRect(p, 0, 2, 512);
    g.fillRect(0, p, 512, 2);
  }
  g.fillStyle = "rgba(255,255,255,0.18)";
  for (const p of [2, 258]) {
    g.fillRect(p, 0, 1, 512);
    g.fillRect(0, p, 512, 1);
  }
  return tex(c, { repeat: [4, 11] });
}

/* The patterned pavement outside the shop (Saida's grey cement tiles). */
export function pavementTexture() {
  const [c, g] = canvas(512, 512);
  g.fillStyle = "#7d7e83";
  g.fillRect(0, 0, 512, 512);
  const cell = 128;
  for (let y = 0; y < 4; y++) {
    for (let x = 0; x < 4; x++) {
      const cx = x * cell + cell / 2, cy = y * cell + cell / 2;
      g.strokeStyle = "rgba(255,255,255,0.055)";
      g.lineWidth = 2;
      g.beginPath();
      g.arc(cx, cy, cell * 0.34, 0, Math.PI * 2);
      g.stroke();
      g.beginPath();
      g.moveTo(cx, cy - cell * 0.5);
      g.lineTo(cx + cell * 0.5, cy);
      g.lineTo(cx, cy + cell * 0.5);
      g.lineTo(cx - cell * 0.5, cy);
      g.closePath();
      g.stroke();
      g.fillStyle = "rgba(20,20,24,0.10)";
      g.fillRect(x * cell, y * cell, cell, 2);
      g.fillRect(x * cell, y * cell, 2, cell);
    }
  }
  return tex(c, { repeat: [5, 3] });
}

/* The top of a folded garment: a soft crease and darker edges. Grey, so it
   multiplies with each stack's own colour. */
export function foldTexture() {
  const [c, g] = canvas(128, 128);
  const grd = g.createLinearGradient(0, 0, 0, 128);
  grd.addColorStop(0, "#d9d9d9");
  grd.addColorStop(0.45, "#ffffff");
  grd.addColorStop(0.5, "#cfcfcf");
  grd.addColorStop(0.56, "#f4f4f4");
  grd.addColorStop(1, "#d2d2d2");
  g.fillStyle = grd;
  g.fillRect(0, 0, 128, 128);
  g.fillStyle = "rgba(0,0,0,0.10)";
  g.fillRect(0, 0, 6, 128);
  g.fillRect(122, 0, 6, 128);
  return tex(c);
}

/* Fabric grain for hanging garments — barely there, it just stops large
   coats from looking like painted plastic. */
export function fabricTexture() {
  const [c, g] = canvas(128, 128);
  const r = rng(5);
  g.fillStyle = "#ededed";
  g.fillRect(0, 0, 128, 128);
  for (let i = 0; i < 1600; i++) {
    g.fillStyle = `rgba(0,0,0,${r() * 0.05})`;
    g.fillRect(r() * 128, r() * 128, 1, 2 + r() * 3);
  }
  const grd = g.createLinearGradient(0, 0, 0, 128);
  grd.addColorStop(0, "rgba(255,255,255,0.25)");
  grd.addColorStop(1, "rgba(0,0,0,0.12)");
  g.fillStyle = grd;
  g.fillRect(0, 0, 128, 128);
  return tex(c, { repeat: [1, 1] });
}

/* Radial glow: bulbs, lamp heads, light pools. White, so the material
   colour tints it. */
export function glowTexture(size = 128, falloff = 2.2) {
  const [c, g] = canvas(size, size);
  const img = g.createImageData(size, size);
  const h = size / 2;
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const d = Math.min(1, Math.hypot(x - h + 0.5, y - h + 0.5) / h);
      const a = Math.pow(1 - d, falloff);
      const i = (y * size + x) * 4;
      img.data[i] = img.data[i + 1] = img.data[i + 2] = 255;
      img.data[i + 3] = Math.round(a * 255);
    }
  }
  g.putImageData(img, 0, 0);
  return tex(c, { srgb: false, mips: false });
}

/* The oval wash a track spot throws on a wall: bright core, long soft tail. */
export function poolTexture() {
  const [c, g] = canvas(256, 256);
  const grd = g.createRadialGradient(128, 96, 4, 128, 128, 128);
  grd.addColorStop(0, "rgba(255,255,255,1)");
  grd.addColorStop(0.25, "rgba(255,255,255,0.55)");
  grd.addColorStop(0.6, "rgba(255,255,255,0.14)");
  grd.addColorStop(1, "rgba(255,255,255,0)");
  g.fillStyle = grd;
  g.fillRect(0, 0, 256, 256);
  return tex(c, { srgb: false, mips: false });
}

/* Soft dark disc that sits under tables, racks and the plinth: the contact
   shadow that keeps objects from floating, for the price of one quad. */
export function contactShadowTexture() {
  const [c, g] = canvas(128, 128);
  const grd = g.createRadialGradient(64, 64, 2, 64, 64, 64);
  grd.addColorStop(0, "rgba(0,0,0,0.55)");
  grd.addColorStop(0.55, "rgba(0,0,0,0.22)");
  grd.addColorStop(1, "rgba(0,0,0,0)");
  g.fillStyle = grd;
  g.fillRect(0, 0, 128, 128);
  return tex(c, { srgb: false, mips: false });
}

/* Logo drawn flat into a canvas — used for the white vinyl on the glass and
   for the soft halo behind the sign's letters at night. */
export function logoCanvasTexture({ width = 1024, color = "#ffffff", blur = 0, pad = 0.08, parts = ["letters", "shop", "lines", "tagline"] } = {}) {
  const W = width;
  const scale = (W * (1 - pad * 2)) / LOGO.w;
  const H = Math.round(LOGO.h * scale + W * pad * 2);
  const [c, g] = canvas(W, H);
  const ox = W * pad, oy = (H - LOGO.h * scale) / 2;
  if (blur) g.filter = `blur(${blur}px)`;
  g.fillStyle = color;
  for (const key of parts) {
    for (const shape of LOGO.parts[key]) {
      g.beginPath();
      for (const poly of shape) {
        for (let i = 0; i < poly.length; i += 2) {
          const x = ox + poly[i] * scale, y = oy + poly[i + 1] * scale;
          if (i === 0) g.moveTo(x, y);
          else g.lineTo(x, y);
        }
        g.closePath();
      }
      g.fill("evenodd");
    }
  }
  const t = tex(c, { srgb: true, mips: true });
  t.userData = { aspect: W / H };
  return t;
}

/* Neon script for the back wall. A white-hot core inside a coloured halo,
   drawn once; the scene only fades its opacity. */
export function neonTexture(text, color = "#FF4522") {
  const W = 1024, H = 320;
  const [c, g] = canvas(W, H);
  g.textAlign = "center";
  g.textBaseline = "middle";
  const font = `600 ${text.length > 7 ? 150 : 190}px "Space Grotesk", system-ui, sans-serif`;
  g.font = font;
  g.shadowColor = color;
  for (const [blur, alpha] of [[60, 0.55], [28, 0.8], [10, 1]]) {
    g.shadowBlur = blur;
    g.globalAlpha = alpha;
    g.fillStyle = color;
    g.fillText(text, W / 2, H / 2);
  }
  g.globalAlpha = 1;
  g.shadowBlur = 6;
  g.shadowColor = "#fff";
  g.lineWidth = 7;
  g.strokeStyle = "#fff4ec";
  g.strokeText(text, W / 2, H / 2);
  const t = tex(c, { srgb: true, mips: false });
  t.userData = { aspect: W / H };
  return t;
}

/* Small printed card: the category plaques on the shelves. */
export function plaqueTexture(text, { bg = "#151518", fg = "#f2f2f4" } = {}) {
  const W = 512, H = 128;
  const [c, g] = canvas(W, H);
  g.fillStyle = bg;
  g.fillRect(0, 0, W, H);
  g.fillStyle = fg;
  g.font = `600 62px "Space Grotesk", system-ui, sans-serif`;
  g.textAlign = "center";
  g.textBaseline = "middle";
  g.fillText(text, W / 2, H / 2 + 2);
  const t = tex(c, { mips: true });
  t.userData = { aspect: W / H };
  return t;
}

/* Black slatted back wall with the vertical light strips from the photos. */
export function slatTexture() {
  const [c, g] = canvas(256, 256);
  g.fillStyle = "#121215";
  g.fillRect(0, 0, 256, 256);
  for (let x = 0; x < 256; x += 16) {
    const grd = g.createLinearGradient(x, 0, x + 16, 0);
    grd.addColorStop(0, "#1d1d21");
    grd.addColorStop(0.5, "#16161a");
    grd.addColorStop(1, "#0b0b0d");
    g.fillStyle = grd;
    g.fillRect(x, 0, 14, 256);
  }
  return tex(c, { repeat: [6, 1] });
}

/* The textured white plaster of the entrance pillar. */
export function plasterTexture() {
  const [c, g] = canvas(256, 256);
  const r = rng(23);
  g.fillStyle = "#f1f0ec";
  g.fillRect(0, 0, 256, 256);
  for (let i = 0; i < 2200; i++) {
    const s = 1 + r() * 5;
    g.fillStyle = `rgba(${r() < 0.5 ? "255,255,255" : "120,118,110"},${0.05 + r() * 0.12})`;
    g.fillRect(r() * 256, r() * 256, s, s * (0.6 + r()));
  }
  return tex(c, { repeat: [1, 3] });
}

/* Corrugated roller shutter — the closed shop next door. */
export function shutterTexture() {
  const [c, g] = canvas(64, 256);
  for (let y = 0; y < 256; y += 8) {
    const grd = g.createLinearGradient(0, y, 0, y + 8);
    grd.addColorStop(0, "#9a9ca0");
    grd.addColorStop(0.5, "#c9cbcf");
    grd.addColorStop(1, "#7b7d82");
    g.fillStyle = grd;
    g.fillRect(0, y, 64, 8);
  }
  return tex(c, { repeat: [1, 3] });
}

/* ------------------------------------------------------------------
   The real-shop look (buildStoreV2): textures for what's actually in
   the Kanaan shop — denim twill, sock packs, the "Your Happy Place"
   neon, the striped curtain over the back door, soft corner shading.
   ------------------------------------------------------------------ */

/* Denim twill, grey so each pile's own wash tints it: fine diagonal
   lines, a lighter fold edge along one side. */
export function denimTexture() {
  const [c, g] = canvas(128, 128);
  const r = rng(31);
  g.fillStyle = "#c8c8c8";
  g.fillRect(0, 0, 128, 128);
  g.lineWidth = 1;
  for (let i = -128; i < 256; i += 3) {
    g.strokeStyle = `rgba(${r() < 0.5 ? "255,255,255" : "0,0,0"},${0.08 + r() * 0.1})`;
    g.beginPath();
    g.moveTo(i, 0);
    g.lineTo(i + 128, 128);
    g.stroke();
  }
  // worn, lighter fold along the front edge
  const grd = g.createLinearGradient(0, 0, 0, 128);
  grd.addColorStop(0, "rgba(255,255,255,0.35)");
  grd.addColorStop(0.18, "rgba(255,255,255,0)");
  grd.addColorStop(0.85, "rgba(0,0,0,0)");
  grd.addColorStop(1, "rgba(0,0,0,0.18)");
  g.fillStyle = grd;
  g.fillRect(0, 0, 128, 128);
  return tex(c);
}

/* A pack of socks on a hook: a printed card header with a hole, and a
   pair of socks below it — leg, heel and foot, the second sock peeking out
   behind the first. `sock` is the socks' colour, `band` the stripes. */
export function sockPackTexture(sock = "#f4f4f2", band = "#1c1c1f") {
  const W = 96, H = 160;
  const [c, g] = canvas(W, H);
  g.clearRect(0, 0, W, H);
  const sockPath = (x, y) => {
    g.beginPath();
    g.moveTo(x, y);
    g.lineTo(x + 25, y);
    g.lineTo(x + 25, y + 68);
    g.quadraticCurveTo(x + 26, y + 79, x + 38, y + 83);
    g.lineTo(x + 52, y + 87);
    g.quadraticCurveTo(x + 64, y + 91, x + 60, y + 103);
    g.quadraticCurveTo(x + 56, y + 112, x + 41, y + 110);
    g.lineTo(x + 16, y + 107);
    g.quadraticCurveTo(x - 3, y + 104, x, y + 82);
    g.closePath();
  };
  for (const [x, y, shade] of [[22, 38, 0.82], [10, 42, 1]]) {
    g.save();
    sockPath(x, y);
    g.fillStyle = sock;
    g.fill();
    g.clip();
    // ribbed cuff, the stripes, a shadow down the back of the leg
    g.fillStyle = "rgba(0,0,0,0.08)";
    for (let k = 0; k < 6; k++) g.fillRect(x + 2 + k * 4, y, 1.2, 14);
    g.fillStyle = band;
    g.fillRect(x - 2, y + 17, 30, 4);
    g.fillRect(x - 2, y + 24, 30, 2.5);
    const grd = g.createLinearGradient(x, 0, x + 26, 0);
    grd.addColorStop(0, "rgba(0,0,0,0.16)");
    grd.addColorStop(0.3, "rgba(0,0,0,0)");
    g.fillStyle = grd;
    g.fillRect(x - 4, y, 70, 115);
    // heel and toe in a slightly darker knit
    g.fillStyle = "rgba(0,0,0,0.07)";
    g.beginPath();
    g.ellipse(x + 6, y + 96, 12, 11, 0, 0, Math.PI * 2);
    g.ellipse(x + 55, y + 99, 9, 10, 0, 0, Math.PI * 2);
    g.fill();
    if (shade < 1) {
      g.fillStyle = `rgba(0,0,0,${1 - shade})`;
      g.fillRect(0, 0, W, H);
    }
    g.restore();
  }
  // card header over the top of both socks
  g.fillStyle = "#2a2a2e";
  g.beginPath();
  g.roundRect(6, 4, W - 12, 40, 4);
  g.fill();
  g.fillStyle = "#e9e6df";
  g.fillRect(16, 24, W - 32, 5);
  g.fillRect(28, 32, W - 56, 3);
  g.fillStyle = "#0b0b0d";
  g.beginPath();
  g.arc(W / 2, 12, 3.5, 0, Math.PI * 2);
  g.fill();
  const t = tex(c, { mips: true });
  t.userData = { aspect: W / H };
  return t;
}

/* The shop's neon, "Your Happy Place", in warm yellow script on three
   lines: a thin white-hot tube inside a soft glow, like bent glass.
   `family` is the script face (loaded by the store); until it arrives the
   sign stays dark rather than light up in the wrong letters. */
export function scriptNeonTexture(lines = ["Your", "Happy", "Place"], color = "#ffcf5a", family = "cursive") {
  const W = 1024, H = 900;
  const [c, g] = canvas(W, H);
  g.textAlign = "center";
  g.textBaseline = "middle";
  g.lineJoin = "round";
  g.lineCap = "round";
  const size = 236;
  g.font = `400 ${size}px ${family}`;
  const step = size * 1.06;
  const ys = lines.map((_, i) => H / 2 + (i - (lines.length - 1) / 2) * step);
  // a letter's fill plus an even stroke around it makes a line of one
  // width all the way along: the bent glass tube
  const tube = (style, width) => {
    g.fillStyle = style;
    g.strokeStyle = style;
    g.lineWidth = width;
    lines.forEach((l, i) => {
      g.fillText(l, W / 2, ys[i]);
      g.strokeText(l, W / 2, ys[i]);
    });
  };
  // the light the tube throws on the wall around it
  g.shadowColor = color;
  for (const [blur, alpha] of [[70, 0.45], [30, 0.7], [12, 0.9]]) {
    g.shadowBlur = blur;
    g.globalAlpha = alpha;
    tube(color, 8);
  }
  // the tube itself: coloured glass, a white-hot core
  g.globalAlpha = 1;
  g.shadowBlur = 0;
  tube(color, 8);
  tube("#fff6da", 3);
  const t = tex(c, { srgb: true, mips: true });
  t.userData = { aspect: W / H };
  return t;
}

/* The curtain over the back door: dark cloth with thin gold stripes and
   soft folds. */
export function curtainTexture() {
  const [c, g] = canvas(256, 256);
  g.fillStyle = "#1a1917";
  g.fillRect(0, 0, 256, 256);
  for (let x = 0; x < 256; x += 32) {
    const grd = g.createLinearGradient(x, 0, x + 32, 0);
    grd.addColorStop(0, "rgba(0,0,0,0.45)");
    grd.addColorStop(0.5, "rgba(255,255,255,0.06)");
    grd.addColorStop(1, "rgba(0,0,0,0.45)");
    g.fillStyle = grd;
    g.fillRect(x, 0, 32, 256);
    g.fillStyle = "rgba(196,160,92,0.75)";
    g.fillRect(x + 10, 0, 2, 256);
    g.fillRect(x + 21, 0, 1, 256);
  }
  return tex(c, { repeat: [3, 1] });
}

/* Soft shading where two surfaces meet (wall and floor, wall and
   ceiling, under a shelf): dark at one edge, gone by the other. */
export function edgeShadeTexture() {
  const [c, g] = canvas(8, 128);
  const grd = g.createLinearGradient(0, 0, 0, 128);
  grd.addColorStop(0, "rgba(0,0,0,0.5)");
  grd.addColorStop(0.35, "rgba(0,0,0,0.16)");
  grd.addColorStop(1, "rgba(0,0,0,0)");
  g.fillStyle = grd;
  g.fillRect(0, 0, 8, 128);
  return tex(c, { srgb: false, mips: false });
}

/* Matte white wall paint with the faintest roller texture. */
export function paintTexture() {
  const [c, g] = canvas(256, 256);
  const r = rng(77);
  g.fillStyle = "#f0efeb";
  g.fillRect(0, 0, 256, 256);
  for (let i = 0; i < 1400; i++) {
    const s = 1 + r() * 3;
    g.fillStyle = `rgba(${r() < 0.5 ? "255,255,255" : "110,108,100"},${0.03 + r() * 0.05})`;
    g.fillRect(r() * 256, r() * 256, s, s);
  }
  return tex(c, { repeat: [6, 2] });
}

/* Cloth for the clothes: a fine knit, a few soft blotches where the cloth
   catches the light differently. Tiles every few centimetres. */
export function clothTexture() {
  const [c, g] = canvas(128, 128);
  const r = rng(19);
  g.fillStyle = "#ececec";
  g.fillRect(0, 0, 128, 128);
  for (let i = 0; i < 14; i++) {
    const x = r() * 128, y = r() * 128, rad = 18 + r() * 30;
    const grd = g.createRadialGradient(x, y, 0, x, y, rad);
    const a = 0.03 + r() * 0.04;
    grd.addColorStop(0, r() < 0.5 ? `rgba(255,255,255,${a})` : `rgba(0,0,0,${a})`);
    grd.addColorStop(1, "rgba(0,0,0,0)");
    g.fillStyle = grd;
    for (const dx of [-128, 0, 128]) for (const dy of [-128, 0, 128]) {
      g.save();
      g.translate(dx, dy);
      g.fillRect(x - rad, y - rad, rad * 2, rad * 2);
      g.restore();
    }
  }
  // the knit: tiny alternating ticks
  for (let y = 0; y < 128; y += 2) {
    for (let x = (y / 2) % 2; x < 128; x += 2) {
      g.fillStyle = `rgba(0,0,0,${0.03 + r() * 0.05})`;
      g.fillRect(x, y, 1, 1);
    }
  }
  return tex(c, { repeat: [1, 1] });
}

/* The inside of one cubby, tiled across the whole grid: light in the
   middle, a soft shadow into each corner and under the shelf above. */
export function cubbyTexture() {
  const [c, g] = canvas(64, 64);
  g.fillStyle = "#ffffff";
  g.fillRect(0, 0, 64, 64);
  const edge = (x0, y0, x1, y1, a) => {
    const grd = g.createLinearGradient(x0, y0, x1, y1);
    grd.addColorStop(0, `rgba(0,0,0,${a})`);
    grd.addColorStop(1, "rgba(0,0,0,0)");
    g.fillStyle = grd;
    g.fillRect(0, 0, 64, 64);
  };
  edge(0, 0, 0, 22, 0.34);   // under the shelf above
  edge(0, 0, 14, 0, 0.18);   // the dividers either side
  edge(64, 0, 50, 0, 0.18);
  edge(0, 64, 0, 56, 0.1);   // where the stack sits
  return tex(c);
}
