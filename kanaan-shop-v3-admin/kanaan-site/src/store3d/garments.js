/* Clothes for the 3D shop, as shapes rather than boxes.

   A jacket on a hanger is built the way a tailor would see it: rings of
   cloth stacked from the hanger down — narrow at the neck, sloping out to
   the shoulders, the width of the chest, a wavy hem — with two sleeves that
   hang from the shoulders and end in a cuff above the hem. From the front
   it reads as a jacket; from the side (how most stock hangs on a rail) you
   see the sleeve, the shoulder curve and the hem below the cuff, the way a
   rail of real jackets looks.

   Every shape here is built once and drawn many times (instancing): a rail
   of thirty hoodies costs the phone about as much as one.

   Units are metres; each garment is built 1 m long and stretched to its
   real length when it is placed. Local axes: x across the shoulders, z out
   of the chest, y up, the hanger's hook at the origin. */
import * as THREE from "three";
import { mergeGeometries } from "three/addons/utils/BufferGeometryUtils.js";

const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
const smooth = (a, b, v) => {
  const t = clamp((v - a) / (b - a), 0, 1);
  return t * t * (3 - 2 * t);
};

/* Rings of a rounded-rectangle cross-section, joined into a tube, with
   both ends closed. Each section: { x, y, z, a, b } — the centre, the half
   width (x) and half depth (z). `shade(px, py, pz, ring, k)` returns the
   vertex's brightness (folds and corners darker). */
function loft(sections, { seg = 22, n = 2.6, shade } = {}) {
  const rings = sections.length;
  const pos = [], uv = [], col = [], idx = [];
  for (let j = 0; j < rings; j++) {
    const s = sections[j];
    for (let k = 0; k <= seg; k++) {
      const th = (k / seg) * Math.PI * 2;
      const c = Math.cos(th), sn = Math.sin(th);
      const px = s.x + s.a * Math.sign(c) * Math.pow(Math.abs(c), 2 / n);
      const pz = s.z + s.b * Math.sign(sn) * Math.pow(Math.abs(sn), 2 / n);
      pos.push(px, s.y, pz);
      // texture in metres-ish, so the weave is the same size everywhere
      uv.push((k / seg) * 2.4 * (s.a + s.b), s.y * 2.2);
      const v = shade ? shade(px, s.y, pz, j, k / seg) : 1;
      col.push(v, v, v);
    }
  }
  const row = seg + 1;
  for (let j = 0; j < rings - 1; j++) {
    for (let k = 0; k < seg; k++) {
      const a = j * row + k, b = a + 1, c = a + row, d = c + 1;
      idx.push(a, b, c, b, d, c);
    }
  }
  // caps: a fan to the middle of the first and last rings
  for (const [j, flip] of [[0, true], [rings - 1, false]]) {
    const s = sections[j];
    const centre = pos.length / 3;
    pos.push(s.x, s.y + (flip ? 0.004 : -0.004), s.z);
    uv.push(0.5, s.y);
    const v = shade ? shade(s.x, s.y, s.z, j, 0) * 0.85 : 0.85;
    col.push(v, v, v);
    for (let k = 0; k < seg; k++) {
      const a = j * row + k, b = a + 1;
      if (flip) idx.push(centre, b, a);
      else idx.push(centre, a, b);
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute("uv", new THREE.Float32BufferAttribute(uv, 2));
  g.setAttribute("color", new THREE.Float32BufferAttribute(col, 3));
  g.setIndex(idx);
  g.computeVertexNormals();
  return g;
}

function join(parts) {
  const g = mergeGeometries(parts, false);
  parts.forEach((p) => p.dispose());
  return g;
}

/* A top on a hanger: jacket, coat, hoodie, shirt or puffer.
     thick   half depth of the body at the chest
     sleeve  radius of the sleeve at the shoulder (0 = none)
     cuff    how far down the sleeve ends (share of the length)
     quilt   puffer bands (0 = none)
     hood    a hood hanging down the back
     phase   where the folds fall, so neighbours don't match */
export function topGeometry({ thick = 0.055, sleeve = 0.05, cuff = 0.7, quilt = 0, hood = false, phase = 0, width = 0.21 } = {}) {
  const parts = [];
  const N = quilt ? 46 : 18;
  const sections = [];
  const bAt = (t) => {
    let b = thick * (0.42 + 0.58 * smooth(0, 0.16, t)) * (1 - 0.08 * smooth(0.6, 1, t));
    if (quilt) b *= 1 + quilt * Math.pow(Math.abs(Math.sin(Math.PI * t * 7.5)), 0.7) - quilt * 0.5;
    return b;
  };
  for (let i = 0; i <= N; i++) {
    // more rings near the shoulders, where the shape turns fastest
    const u = i / N;
    const t = quilt ? u : Math.pow(u, 1.35);
    const shoulder = 1 - Math.pow(1 - clamp(t / 0.1, 0, 1), 2);
    const a = 0.072 + (width - 0.072) * shoulder - 0.008 * smooth(0.25, 0.6, t) + 0.006 * smooth(0.7, 1, t);
    sections.push({ x: 0, y: -t, z: 0, a, b: bAt(t) });
  }
  const body = loft(sections, {
    seg: 26,
    n: 2.4,
    shade: (x, y, z, j) => {
      const t = -y;
      const a = sections[j].a;
      // under the arms and down the sides the cloth is in shadow
      const side = Math.abs(x) > a * 0.8 && t > 0.08 && t < cuff ? 0.8 : 1;
      return (0.97 - 0.1 * t) * side;
    },
  });
  // folds: soft vertical waves on the front and back that open toward the
  // hem, and a hem that isn't ruler-straight
  {
    const p = body.attributes.position;
    const c = body.attributes.color;
    for (let i = 0; i < p.count; i++) {
      const x = p.getX(i), y = p.getY(i), z = p.getZ(i);
      const t = -y;
      const w = smooth(0.12, 1, t);
      const wave = Math.sin(x * 29 + phase) * 0.6 + Math.sin(x * 61 + phase * 2.3) * 0.4;
      const dz = Math.sign(z) * 0.009 * w * wave * (quilt ? 0.4 : 1);
      p.setZ(i, z + dz);
      p.setY(i, y + 0.01 * smooth(0.9, 1, t) * Math.sin(x * 23 + phase));
      const k = 1 + 4 * dz * Math.sign(z);
      c.setXYZ(i, c.getX(i) * k, c.getY(i) * k, c.getZ(i) * k);
    }
    body.computeVertexNormals();
  }
  parts.push(body);

  if (sleeve > 0) {
    for (const sx of [-1, 1]) {
      const ss = [];
      const M = quilt ? 30 : 12;
      for (let i = 0; i <= M; i++) {
        const s = i / M;
        const r = sleeve * (i === 0 ? 0.55 : 1 - 0.24 * s);
        const ty = 0.085 + (cuff - 0.085) * s;
        let rz = r * (thick / 0.055) * 0.95;
        if (quilt) rz *= 1 + quilt * 0.6 * Math.pow(Math.abs(Math.sin(Math.PI * s * 6)), 0.7) - quilt * 0.3;
        ss.push({
          x: sx * (width - 0.012 + r * 0.55 + 0.02 * s),
          y: -ty,
          z: 0.004,
          a: r * 0.92,
          b: Math.min(rz, bAt(ty) * 1.06),
        });
      }
      parts.push(loft(ss, {
        seg: 16,
        n: 2.2,
        // the side of the sleeve against the body is in shadow
        shade: (x, y) => {
          const t = -y;
          const inner = Math.sign(x) !== sx ? 0.78 : 1;
          return (0.95 - 0.1 * t) * inner;
        },
      }));
    }
  }

  if (hood) {
    // the hood hangs flat down the back
    const hs = [];
    for (let i = 0; i <= 8; i++) {
      const s = i / 8;
      const a = 0.06 + 0.06 * Math.sin(Math.PI * Math.min(1, s * 1.1));
      hs.push({ x: 0, y: -0.01 - 0.24 * s, z: -thick * 0.95 - 0.018 * Math.sin(Math.PI * s), a, b: 0.022 + 0.012 * Math.sin(Math.PI * s) });
    }
    parts.push(loft(hs, { seg: 14, n: 2.2, shade: () => 0.86 }));
  }
  return join(parts);
}

/* Trousers folded over a hanger's bar: a short seat that splits into two
   legs. Side-on on a rail they read as a slim column with a rounded top. */
export function trousersGeometry({ phase = 0 } = {}) {
  const parts = [];
  const top = [];
  for (let i = 0; i <= 5; i++) {
    const t = (i / 5) * 0.34;
    top.push({ x: 0, y: -t, z: 0, a: 0.15 + 0.02 * smooth(0, 0.06, t), b: 0.028 - 0.01 * smooth(0, 0.08, t) });
  }
  parts.push(loft(top, { seg: 18, n: 2.6, shade: (x, y) => 0.98 + 0.1 * y }));
  for (const sx of [-1, 1]) {
    const leg = [];
    for (let i = 0; i <= 8; i++) {
      const t = 0.3 + (i / 8) * 0.7;
      const a = 0.084 - 0.022 * smooth(0.3, 1, t);
      leg.push({ x: sx * (0.084 - 0.01 * smooth(0.3, 1, t)), y: -t + (i === 8 ? 0.012 * Math.sin(phase + sx) : 0), z: 0, a, b: 0.018 });
    }
    parts.push(loft(leg, { seg: 14, n: 2.4, shade: (x, y) => (0.95 + 0.08 * y) * (Math.abs(x) < 0.02 ? 0.8 : 1) }));
  }
  return join(parts);
}

/* A sneaker seen side-on: a white cupsole and a padded upper with a dipped
   collar, built as two extruded profiles so the sole keeps its white while
   the upper takes the shoe's colour. Heel at the origin, toe toward +z. */
export function sneakerGeometries() {
  const L = 0.29;
  // side profiles, (length from the heel, height), in metres
  const solePts = [
    [0.004, 0.014], [0.012, 0.003], [0.035, 0.0], [L - 0.06, 0.0], [L - 0.02, 0.004],
    [L - 0.004, 0.014], [L, 0.024], [L - 0.006, 0.03], [0.02, 0.03], [0.006, 0.026],
  ];
  const upperPts = [
    [0.014, 0.028], [0.008, 0.06], [0.01, 0.092], [0.02, 0.108], [0.036, 0.106], [0.06, 0.092],
    [0.085, 0.088], [0.104, 0.104], [0.118, 0.108], [0.128, 0.1], [0.16, 0.088], [0.2, 0.076],
    [0.235, 0.068], [0.258, 0.063], [0.274, 0.056], [L - 0.008, 0.045], [L - 0.008, 0.032], [L - 0.03, 0.028],
  ];
  const shape = (pts) => {
    const s = new THREE.Shape();
    pts.forEach(([u, v], i) => (i ? s.lineTo(u, v) : s.moveTo(u, v)));
    s.closePath();
    return s;
  };
  const toShoe = (g, width) => {
    // shape is drawn in (length, height); turn it so length runs along z
    g.translate(0, 0, -width / 2);
    g.rotateY(-Math.PI / 2);
    g.computeVertexNormals();
    return g;
  };
  const sole = toShoe(new THREE.ExtrudeGeometry(shape(solePts), {
    depth: 0.088, bevelEnabled: true, bevelThickness: 0.008, bevelSize: 0.006, bevelSegments: 2, curveSegments: 6,
  }), 0.088);
  const upper = toShoe(new THREE.ExtrudeGeometry(shape(upperPts), {
    depth: 0.064, bevelEnabled: true, bevelThickness: 0.016, bevelSize: 0.01, bevelSegments: 3, curveSegments: 6,
  }), 0.064);
  // the dark opening of the collar, seen from above
  const collar = new THREE.SphereGeometry(1, 14, 8);
  collar.scale(0.03, 0.008, 0.036);
  collar.translate(0, 0.094, 0.06);
  return { sole, upper, collar };
}
