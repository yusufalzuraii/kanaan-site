/* The Kanaan store in Saida, rebuilt in 3D from the shop's own photos.

   Not a generic "3D room": every piece here is something in the real shop —
   the white fascia with the dimensional KANAAN letters, the black canopy
   with its string of bulbs, the glass front, the coffered ceiling with its
   warm hidden light, the two rows of black track spots, the white shelving
   with folded stacks, the black steel racks, the long white table, the
   slatted black back wall with its light strips, the plant by the door.

   The one thing that is NOT copied from the photos is the stock. The photos
   show last season; the lightboxes in this store are filled at runtime with
   whatever is live on the site right now, so the digital shop restocks
   itself every time the real one does.

   Units are metres. x runs across the shop (left wall at -2.3, right wall at
   +2.3), y is up, and the street is +z: the glass front sits at z = 0 and
   the back wall at z = -13. */
import * as THREE from "three";
import { RoundedBoxGeometry } from "three/addons/geometries/RoundedBoxGeometry.js";
import { mergeGeometries } from "three/addons/utils/BufferGeometryUtils.js";
import { LOGO } from "./logoShapes.js";
import {
  rng,
  floorTexture,
  pavementTexture,
  foldTexture,
  fabricTexture,
  glowTexture,
  poolTexture,
  contactShadowTexture,
  logoCanvasTexture,
  slatTexture,
  plasterTexture,
  shutterTexture,
} from "./textures.js";

export const SHOP = {
  xL: -2.3,
  xR: 2.3,
  depth: 13,
  ceil: 3.0,
  doorX: [0.85, 2.2],
};

// Winter stock colours for the folded stacks and hanging coats.
const WINTER = [
  "#1b1b1e", "#1b1b1e", "#2c2d31", "#3f4045", "#5f6066", "#8d8e93",
  "#e6e2d8", "#d4ccbb", "#b9a88b", "#8b6b4e", "#5a3a29", "#3e2a21",
  "#3c4637", "#556049", "#27303d", "#3a4658", "#5e2a30", "#7a2f33",
];

const warm = new THREE.Color("#ffcf9e");
const warmHot = new THREE.Color("#ffe3c2");

/* ------------------------------------------------------------ helpers */
function box(w, h, d, mat, x = 0, y = 0, z = 0) {
  const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
  m.position.set(x, y, z);
  return m;
}

function boxGeo(w, h, d, x, y, z, ry = 0) {
  const g = new THREE.BoxGeometry(w, h, d);
  if (ry) g.rotateY(ry);
  g.translate(x, y, z);
  return g;
}

function merged(geos, mat) {
  const g = mergeGeometries(geos, false);
  geos.forEach((x) => x.dispose());
  return new THREE.Mesh(g, mat);
}

function shapeFromFlat(flat, s, ox, oy) {
  const sh = new THREE.Shape();
  for (let i = 0; i < flat.length; i += 2) {
    const x = (flat[i] - ox) * s, y = -(flat[i + 1] - oy) * s;
    if (i === 0) sh.moveTo(x, y);
    else sh.lineTo(x, y);
  }
  sh.closePath();
  return sh;
}

function pathFromFlat(flat, s, ox, oy) {
  const p = new THREE.Path();
  for (let i = 0; i < flat.length; i += 2) {
    const x = (flat[i] - ox) * s, y = -(flat[i + 1] - oy) * s;
    if (i === 0) p.moveTo(x, y);
    else p.lineTo(x, y);
  }
  p.closePath();
  return p;
}

/* The logo, extruded. Width in metres; returns a group centred on the
   logo's middle, letters facing +z. */
function buildLogo(width, mats) {
  const g = new THREE.Group();
  const s = width / LOGO.w;
  const ox = LOGO.w / 2, oy = LOGO.h / 2;
  const depthFor = { letters: 0.11, shop: 0.05, lines: 0.02, tagline: 0.03 };
  for (const key of Object.keys(LOGO.parts)) {
    const shapes = LOGO.parts[key].map((entry) => {
      const sh = shapeFromFlat(entry[0], s, ox, oy);
      for (let i = 1; i < entry.length; i++) sh.holes.push(pathFromFlat(entry[i], s, ox, oy));
      return sh;
    });
    const geo = new THREE.ExtrudeGeometry(shapes, {
      depth: depthFor[key],
      bevelEnabled: key === "letters",
      bevelThickness: 0.012,
      bevelSize: 0.008,
      bevelSegments: 2,
      curveSegments: 4,
    });
    const mesh = new THREE.Mesh(geo, mats.letter);
    mesh.name = `logo-${key}`;
    g.add(mesh);
  }
  return g;
}

/* A hanging coat seen from the side — shoulders, hanger hook, a slight
   flare at the hem. One extruded outline, instanced along every rail. */
function coatGeometry(length = 0.78, depth = 0.026) {
  // outline in the garment's own plane: x = across the shoulders, y = down
  // from the hanger. Collar, sloping shoulders, sleeves that hang a touch
  // wider than the body, and a hem — enough that a rail of them reads as
  // clothes and not as a row of cushions.
  const sh = new THREE.Shape();
  const L = length;
  sh.moveTo(0, 0.012);
  sh.quadraticCurveTo(-0.05, 0.016, -0.07, -0.012);   // collar
  sh.quadraticCurveTo(-0.17, -0.035, -0.225, -0.075); // shoulder
  sh.quadraticCurveTo(-0.248, -0.1, -0.252, -0.16);
  sh.lineTo(-0.262, -0.56);                           // sleeve
  sh.quadraticCurveTo(-0.262, -0.6, -0.236, -0.6);
  sh.lineTo(-0.212, -0.6);
  sh.lineTo(-0.206, -L + 0.03);                       // body
  sh.quadraticCurveTo(-0.205, -L, -0.17, -L);
  sh.quadraticCurveTo(0, -L - 0.018, 0.17, -L);       // hem
  sh.quadraticCurveTo(0.205, -L, 0.206, -L + 0.03);
  sh.lineTo(0.212, -0.6);
  sh.lineTo(0.236, -0.6);
  sh.quadraticCurveTo(0.262, -0.6, 0.262, -0.56);
  sh.lineTo(0.252, -0.16);
  sh.quadraticCurveTo(0.248, -0.1, 0.225, -0.075);
  sh.quadraticCurveTo(0.17, -0.035, 0.07, -0.012);
  sh.quadraticCurveTo(0.05, 0.016, 0, 0.012);
  sh.closePath();
  const thick = depth > 0.05;
  const geo = new THREE.ExtrudeGeometry(sh, {
    depth,
    bevelEnabled: true,
    bevelThickness: thick ? 0.04 : 0.006,
    bevelSize: thick ? 0.02 : 0.005,
    bevelSegments: thick ? 3 : 1,
    curveSegments: 5,
    steps: 1,
  });
  geo.translate(0, 0, -depth / 2);
  // drape: soft vertical folds below the chest, and shading baked into
  // vertex colours (darker sleeves and hem, lighter across the shoulders)
  const pos = geo.attributes.position;
  const col = new Float32Array(pos.count * 3);
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i), y = pos.getY(i);
    const below = Math.min(1, Math.max(0, (-y - 0.18) / 0.3));
    pos.setZ(i, pos.getZ(i) + below * 0.012 * Math.sin(x * 34 + y * 6));
    const edge = Math.abs(x) > 0.21 ? 0.8 : 1;
    const v = (0.84 + 0.16 * (1 + y / L)) * edge;
    col[i * 3] = col[i * 3 + 1] = col[i * 3 + 2] = v;
  }
  geo.setAttribute("color", new THREE.BufferAttribute(col, 3));
  geo.computeVertexNormals();
  return geo;
}

/* A window mannequin like the dark ones in the shop's window, dressed in a
   winter coat. Not product photos on purpose: the window should read as a
   menswear shop from across the street, whatever is in stock that day. */
function buildMannequin(mats, { coat, pants, turn = 0, x = 0, z = 0 }) {
  const g = new THREE.Group();
  const skin = mats.mannequin;
  const pantsMat = new THREE.MeshStandardMaterial({ color: pants, roughness: 0.85, map: mats.fabric.map });
  const coatMat = new THREE.MeshStandardMaterial({ color: coat, roughness: 0.9, map: mats.fabric.map, vertexColors: true });
  const base = new THREE.Mesh(new THREE.CylinderGeometry(0.17, 0.19, 0.025, 28), mats.black);
  base.position.y = 0.012;
  g.add(base);
  for (const sx of [-1, 1]) {
    const leg = new THREE.Mesh(new THREE.CapsuleGeometry(0.068, 0.72, 4, 12), pantsMat);
    leg.position.set(sx * 0.085, 0.47, 0);
    leg.rotation.z = sx * 0.035;
    g.add(leg);
    const shoe = new THREE.Mesh(new RoundedBoxGeometry(0.11, 0.07, 0.25, 2, 0.03), mats.matteBlack);
    shoe.position.set(sx * 0.09, 0.06, 0.045);
    g.add(shoe);
  }
  const hips = new THREE.Mesh(new RoundedBoxGeometry(0.34, 0.2, 0.2, 2, 0.08), pantsMat);
  hips.position.y = 0.92;
  g.add(hips);
  const body = new THREE.Mesh(coatGeometry(0.84, 0.16), coatMat);
  body.position.y = 1.56;
  g.add(body);
  const neck = new THREE.Mesh(new THREE.CylinderGeometry(0.042, 0.05, 0.14, 16), skin);
  neck.position.y = 1.62;
  g.add(neck);
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.1, 24, 18), skin);
  head.scale.set(0.88, 1.16, 0.98);
  head.position.y = 1.79;
  g.add(head);
  g.position.set(x, 0.3, z);
  g.rotation.y = turn;
  return g;
}

/* ------------------------------------------------------------ the build */
export function buildStore({ tier = "high" } = {}) {
  const lite = tier !== "high";
  const r = rng(42);
  const root = new THREE.Group();
  const reg = {
    emissive: [],   // { mat, day, night, prop: 'emissiveIntensity' | 'opacity' }
    pools: [],
    bulbs: [],
    panels: [],
    door: null,
    halo: null,
    neon: null,
    glowPoints: null,
    pointer: [],
  };
  const addEm = (mat, day, night, prop = "emissiveIntensity") => reg.emissive.push({ mat, day, night, prop });

  /* materials */
  const mats = {
    white: new THREE.MeshStandardMaterial({ color: "#f3f2ef", roughness: 0.42, metalness: 0 }),
    whiteGloss: new THREE.MeshStandardMaterial({ color: "#f6f5f2", roughness: 0.18, metalness: 0 }),
    black: new THREE.MeshStandardMaterial({ color: "#1a1a1d", roughness: 0.45, metalness: 0.55 }),
    matteBlack: new THREE.MeshStandardMaterial({ color: "#151517", roughness: 0.8, metalness: 0.1 }),
    letter: new THREE.MeshStandardMaterial({ color: "#1f1f22", roughness: 0.68, metalness: 0.06, envMapIntensity: 0.45 }),
    wall: new THREE.MeshStandardMaterial({ color: "#efeeea", roughness: 0.9, metalness: 0 }),
    glass: new THREE.MeshStandardMaterial({ color: "#d8e6e8", roughness: 0.04, metalness: 0.2, transparent: true, opacity: 0.16, depthWrite: false }),
    floor: new THREE.MeshStandardMaterial({ color: "#ffffff", map: floorTexture(), roughness: 0.2, metalness: 0.05 }),
    pavement: new THREE.MeshStandardMaterial({ color: "#ffffff", map: pavementTexture(), roughness: 0.85, metalness: 0 }),
    road: new THREE.MeshStandardMaterial({ color: "#4c4e53", roughness: 0.92, metalness: 0 }),
    fold: new THREE.MeshStandardMaterial({ color: "#ffffff", map: foldTexture(), roughness: 0.92, metalness: 0 }),
    fabric: new THREE.MeshStandardMaterial({ color: "#ffffff", map: fabricTexture(), roughness: 0.9, metalness: 0, vertexColors: true }),
    slat: new THREE.MeshStandardMaterial({ color: "#ffffff", map: slatTexture(), roughness: 0.6, metalness: 0.15 }),
    plaster: new THREE.MeshStandardMaterial({ color: "#ffffff", map: plasterTexture(), roughness: 0.95, metalness: 0 }),
    facadeDark: new THREE.MeshStandardMaterial({ color: "#26272b", roughness: 0.3, metalness: 0.4 }),
    concrete: new THREE.MeshStandardMaterial({ color: "#5c5d61", roughness: 0.95, metalness: 0 }),
    mannequin: new THREE.MeshStandardMaterial({ color: "#45464b", roughness: 0.32, metalness: 0.35 }),
    shutter: new THREE.MeshStandardMaterial({ color: "#b4b6ba", map: shutterTexture(), roughness: 0.6, metalness: 0.3 }),
    darkGlass: new THREE.MeshStandardMaterial({ color: "#101216", roughness: 0.08, metalness: 0.6 }),
  };
  const glowTex = glowTexture(128, 2.4);
  const poolTex = poolTexture();
  const shadowTex = contactShadowTexture();

  const emissiveMat = (color, base = 0) =>
    new THREE.MeshStandardMaterial({ color: "#111", emissive: color, emissiveIntensity: base, roughness: 0.4 });

  /* ---------------------------------------------------- street & facade */
  const pave = new THREE.Mesh(new THREE.PlaneGeometry(16, 8.5), mats.pavement);
  pave.rotation.x = -Math.PI / 2;
  pave.position.set(0, 0, 4.25);
  pave.receiveShadow = true;
  root.add(pave);
  // kerb, and the road beyond it — on a phone the camera stands out in the
  // street and looks down, so the ground has to reach that far
  root.add(box(16, 0.16, 0.32, mats.concrete, 0, -0.04, 8.6));
  const road = new THREE.Mesh(new THREE.PlaneGeometry(40, 22), mats.road);
  road.rotation.x = -Math.PI / 2;
  road.position.set(0, -0.12, 8.76 + 11);
  root.add(road);

  // neighbouring shopfronts: dark masses either side, fog does the rest
  root.add(box(4, 8, 1.2, mats.facadeDark, -5.3, 4, -0.4));
  root.add(box(4, 8, 1.2, mats.facadeDark, 5.3, 4, -0.4));
  {
    const sh = new THREE.Mesh(new THREE.PlaneGeometry(3.3, 2.85), mats.shutter);
    sh.position.set(-5.25, 1.45, 0.205);
    root.add(sh);
    root.add(box(3.5, 0.22, 0.08, mats.matteBlack, -5.25, 2.98, 0.22));
    const gl = new THREE.Mesh(new THREE.PlaneGeometry(3.3, 2.85), mats.darkGlass);
    gl.position.set(5.25, 1.45, 0.205);
    root.add(gl);
    root.add(box(3.5, 0.06, 0.06, mats.matteBlack, 5.25, 2.9, 0.22));
    root.add(box(0.06, 2.85, 0.06, mats.matteBlack, 4.3, 1.45, 0.22));
    // upstairs windows; after dark a couple of the flats have a lamp on
    const lampMat = new THREE.MeshStandardMaterial({ color: "#2a2117", emissive: "#ffc98f", emissiveIntensity: 0, roughness: 0.6 });
    addEm(lampMat, 0, 0.9);
    const lit = new Set(["-5.25:6.3:0.9", "5.25:4.4:-0.9"]);
    for (const nx of [-5.25, 5.25]) {
      for (const wy of [4.4, 6.3]) {
        for (const off of [-0.9, 0.9]) {
          const w = new THREE.Mesh(new THREE.PlaneGeometry(1.2, 1.3), lit.has(`${nx}:${wy}:${off}`) ? lampMat : mats.darkGlass);
          w.position.set(nx + off, wy, 0.205);
          root.add(w);
        }
      }
    }
  }
  reg.colors = [
    { mat: mats.facadeDark, day: new THREE.Color("#cfcbc3"), night: new THREE.Color("#222327") },
    { mat: mats.concrete, day: new THREE.Color("#a9a7a2"), night: new THREE.Color("#4d4e52") },
    { mat: mats.shutter, day: new THREE.Color("#b4b6ba"), night: new THREE.Color("#3b3d41") },
    { mat: mats.darkGlass, day: new THREE.Color("#55606f"), night: new THREE.Color("#0c0d10") },
  ];
  // the building above the sign: dark glazing like the photo
  root.add(box(6.6, 3.2, 0.6, mats.facadeDark, 0, 6.95, -0.1));
  const upperWin = new THREE.MeshStandardMaterial({ color: "#0e1013", roughness: 0.08, metalness: 0.6 });
  for (let i = 0; i < 3; i++) root.add(box(1.7, 1.9, 0.05, upperWin, -2.1 + i * 2.1, 6.9, 0.21));

  // the fascia: white panel carrying the 3D sign
  const fascia = box(6.5, 1.9, 0.14, mats.white, 0, 4.42, 0.32);
  fascia.receiveShadow = true;
  root.add(fascia);
  const logo = buildLogo(5.5, mats);
  logo.position.set(0, 4.44, 0.39);
  logo.traverse((o) => { if (o.isMesh) o.castShadow = true; });
  root.add(logo);
  reg.shadowCasters = [logo];

  // night halo behind the letters — the sign "switching on"
  const haloTex = logoCanvasTexture({ width: 1024, color: "#ffffff", blur: 14, pad: 0.06 });
  const haloMat = new THREE.ShaderMaterial({
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    uniforms: {
      uMap: { value: haloTex },
      uReveal: { value: 0 },
      uIntensity: { value: 0 },
      uColor: { value: new THREE.Color("#ffd9ae") },
    },
    vertexShader: "varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }",
    fragmentShader:
      "uniform sampler2D uMap; uniform float uReveal; uniform float uIntensity; uniform vec3 uColor; varying vec2 vUv;" +
      "void main(){ float a = texture2D(uMap, vUv).a; float m = smoothstep(uReveal - 0.08, uReveal, vUv.x + 0.0); m = 1.0 - m;" +
      " gl_FragColor = vec4(uColor * a * uIntensity * m, 1.0); }",
  });
  const haloW = 5.5 / (1 - 0.06 * 2);
  const halo = new THREE.Mesh(new THREE.PlaneGeometry(haloW, haloW / haloTex.userData.aspect), haloMat);
  halo.position.set(0, 4.44, 0.395);
  root.add(halo);
  reg.halo = haloMat;

  // canopy, with three flush downlights underneath
  const canopy = box(6.5, 0.3, 1.05, mats.matteBlack, 0, 3.32, 0.52);
  canopy.castShadow = true;
  root.add(canopy);
  const downMat = emissiveMat(warmHot, 0.6);
  addEm(downMat, 0.5, 3.2);
  for (const x of [-2.1, 0, 2.1]) {
    const d = new THREE.Mesh(new THREE.CircleGeometry(0.11, 24), downMat);
    d.rotation.x = Math.PI / 2;
    d.position.set(x, 3.165, 0.6);
    root.add(d);
  }
  // light pools those downlights throw on the pavement
  const pavePoolMat = new THREE.MeshBasicMaterial({ map: poolTex, color: warm, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false });
  addEm(pavePoolMat, 0.02, 0.32, "opacity");
  for (const x of [-2.1, 0, 2.1]) {
    const p = new THREE.Mesh(new THREE.PlaneGeometry(2.6, 3.2), pavePoolMat);
    p.rotation.x = -Math.PI / 2;
    p.position.set(x, 0.006, 1.2);
    root.add(p);
  }

  // string lights: a sagging wire along the canopy edge, bulbs on drops
  {
    const hooks = [-3.15, -1.9, -0.63, 0.63, 1.9, 3.15];
    const pts = [];
    for (let i = 0; i < hooks.length - 1; i++) {
      const a = hooks[i], b = hooks[i + 1];
      for (let k = 0; k <= 10; k++) {
        const t = k / 10;
        const x = a + (b - a) * t;
        const sag = 0.16 * (1 - Math.pow(2 * t - 1, 2));
        if (i > 0 && k === 0) continue;
        pts.push(new THREE.Vector3(x, 3.17 - sag, 1.06));
      }
    }
    const wire = new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 160, 0.006, 4, false), mats.matteBlack);
    root.add(wire);
    const bulbMat = new THREE.MeshStandardMaterial({ color: "#2a2015", emissive: warmHot, emissiveIntensity: 0, roughness: 0.2, transparent: true, opacity: 0.95 });
    reg.bulbMat = bulbMat;
    const bulbGeo = new THREE.SphereGeometry(0.035, 12, 10);
    bulbGeo.scale(1, 1.25, 1);
    const n = 22;
    const glowPos = new Float32Array(n * 3);
    for (let i = 0; i < n; i++) {
      const x = -3.0 + (6.0 * i) / (n - 1);
      // find the wire height at x
      let y = 3.0;
      for (let j = 0; j < pts.length - 1; j++) {
        if (pts[j].x <= x && pts[j + 1].x >= x) {
          const t = (x - pts[j].x) / (pts[j + 1].x - pts[j].x);
          y = pts[j].y + (pts[j + 1].y - pts[j].y) * t;
          break;
        }
      }
      const drop = 0.07 + r() * 0.05;
      const b = new THREE.Mesh(bulbGeo, bulbMat);
      b.position.set(x, y - drop, 1.06);
      root.add(b);
      reg.bulbs.push({ mesh: b, base: b.position.clone(), phase: r() * Math.PI * 2, on: 0, delay: i * 0.045 + r() * 0.08 });
      glowPos.set([x, y - drop, 1.07], i * 3);
    }
    const glowGeo = new THREE.BufferGeometry();
    glowGeo.setAttribute("position", new THREE.BufferAttribute(glowPos, 3));
    const glowMat = new THREE.PointsMaterial({ map: glowTex, color: warm, size: 0.55, sizeAttenuation: true, transparent: true, opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending });
    const glow = new THREE.Points(glowGeo, glowMat);
    root.add(glow);
    reg.glowPoints = glow;
  }

  // shopfront: black frame, fixed glass on the left, the door on the right
  const frameGeos = [
    boxGeo(0.07, 3.05, 0.09, SHOP.xL - 0.02, 1.58, 0),
    boxGeo(0.07, 3.05, 0.09, 0.79, 1.58, 0),
    boxGeo(0.07, 3.05, 0.09, SHOP.xR + 0.02, 1.58, 0),
    boxGeo(4.75, 0.08, 0.1, 0, 3.12, 0),
    boxGeo(4.75, 0.12, 0.1, 0, 0.06, 0),
    // the side piers in black, like the photo
    boxGeo(0.5, 3.2, 0.5, -2.75, 1.6, 0.05),
    boxGeo(0.5, 3.2, 0.5, 2.75, 1.6, 0.05),
  ];
  root.add(merged(frameGeos, mats.matteBlack));
  const fixedGlass = new THREE.Mesh(new THREE.PlaneGeometry(3.08, 2.98), mats.glass);
  fixedGlass.position.set(-0.76, 1.6, 0.0);
  root.add(fixedGlass);

  // white vinyl logo on the glass
  const vinylTex = logoCanvasTexture({ width: 1024, color: "#ffffff", pad: 0.02 });
  const vinylMat = new THREE.MeshBasicMaterial({ map: vinylTex, transparent: true, opacity: 0.88, depthWrite: false, toneMapped: false });
  const vinyl = new THREE.Mesh(new THREE.PlaneGeometry(1.85, 1.85 / vinylTex.userData.aspect), vinylMat);
  vinyl.position.set(-0.76, 2.52, 0.012);
  root.add(vinyl);

  // the door: glass leaf in a thin black frame, hinged on the right
  {
    const pivot = new THREE.Group();
    pivot.position.set(SHOP.doorX[1], 0, 0.02);
    const w = SHOP.doorX[1] - SHOP.doorX[0];
    const leaf = new THREE.Group();
    leaf.position.set(-w / 2, 0, 0);
    const dg = new THREE.Mesh(new THREE.PlaneGeometry(w - 0.08, 2.96), mats.glass);
    dg.position.set(0, 1.58, 0);
    leaf.add(dg);
    leaf.add(merged([
      boxGeo(w, 0.06, 0.05, 0, 3.07, 0),
      boxGeo(w, 0.1, 0.05, 0, 0.1, 0),
      boxGeo(0.04, 3.0, 0.05, -w / 2 + 0.02, 1.58, 0),
      boxGeo(0.04, 3.0, 0.05, w / 2 - 0.02, 1.58, 0),
      // long vertical pull handle
      boxGeo(0.03, 1.2, 0.03, -w / 2 + 0.16, 1.2, 0.07),
      boxGeo(0.03, 0.03, 0.07, -w / 2 + 0.16, 1.75, 0.035),
      boxGeo(0.03, 0.03, 0.07, -w / 2 + 0.16, 0.65, 0.035),
    ], mats.black));
    pivot.add(leaf);
    root.add(pivot);
    reg.door = pivot;
  }

  // window display: plinth + three tall lightboxes (filled with live stock)
  root.add(box(2.5, 0.3, 0.95, mats.white, -0.6, 0.15, -0.8));
  addShadow(root, shadowTex, -0.6, -0.8, 3.0, 1.4, 0.5);
  root.add(buildMannequin(mats, { coat: "#a68a66", pants: "#2b3442", turn: 0.22, x: -1.38, z: -0.85 }));
  root.add(buildMannequin(mats, { coat: "#1f1f22", pants: "#d6d0c2", turn: -0.05, x: -0.6, z: -0.9 }));
  root.add(buildMannequin(mats, { coat: "#4f5a45", pants: "#1c1c1f", turn: -0.26, x: 0.2, z: -0.85 }));
  const windowSlots = [];

  /* ---------------------------------------------------- interior shell */
  const floor = new THREE.Mesh(new THREE.PlaneGeometry(SHOP.xR - SHOP.xL, SHOP.depth), mats.floor);
  floor.rotation.x = -Math.PI / 2;
  floor.position.set(0, 0.001, -SHOP.depth / 2);
  root.add(floor);

  const lw = new THREE.Mesh(new THREE.PlaneGeometry(SHOP.depth, SHOP.ceil), mats.wall);
  lw.rotation.y = Math.PI / 2;
  lw.position.set(SHOP.xL, SHOP.ceil / 2, -SHOP.depth / 2);
  root.add(lw);
  const rw = lw.clone();
  rw.rotation.y = -Math.PI / 2;
  rw.position.x = SHOP.xR;
  root.add(rw);

  // back wall: black slats with three vertical light strips
  const back = new THREE.Mesh(new THREE.PlaneGeometry(SHOP.xR - SHOP.xL, SHOP.ceil), mats.slat);
  back.position.set(0, SHOP.ceil / 2, -SHOP.depth);
  root.add(back);
  const stripMat = emissiveMat(warmHot, 1.2);
  addEm(stripMat, 1.0, 2.6);
  for (const x of [-1.5, -0.25, 1.0]) root.add(box(0.025, 2.7, 0.02, stripMat, x, 1.45, -SHOP.depth + 0.02));

  // ceiling with three recessed coffers and their hidden warm cove light
  {
    const sh = new THREE.Shape();
    sh.moveTo(SHOP.xL, 0.2);
    sh.lineTo(SHOP.xR, 0.2);
    sh.lineTo(SHOP.xR, -SHOP.depth);
    sh.lineTo(SHOP.xL, -SHOP.depth);
    sh.closePath();
    const coffers = [-2.6, -6.4, -10.2];
    for (const cz of coffers) {
      const h = new THREE.Path();
      h.moveTo(-0.85, cz + 1.3);
      h.lineTo(-0.85, cz - 1.3);
      h.lineTo(0.85, cz - 1.3);
      h.lineTo(0.85, cz + 1.3);
      h.closePath();
      sh.holes.push(h);
    }
    const cg = new THREE.ShapeGeometry(sh);
    cg.rotateX(Math.PI / 2); // shape y -> world -z, facing down
    const ceil = new THREE.Mesh(cg, mats.wall);
    ceil.position.y = SHOP.ceil;
    ceil.material = mats.wall.clone();
    ceil.material.side = THREE.DoubleSide;
    root.add(ceil);
    const coveMat = emissiveMat(warm, 1.4);
    addEm(coveMat, 1.1, 3.4);
    const recessGeos = [];
    const coveGeos = [];
    for (const cz of coffers) {
      recessGeos.push(boxGeo(1.7, 0.02, 2.6, 0, SHOP.ceil + 0.18, cz));
      recessGeos.push(boxGeo(0.02, 0.18, 2.6, -0.86, SHOP.ceil + 0.09, cz));
      recessGeos.push(boxGeo(0.02, 0.18, 2.6, 0.86, SHOP.ceil + 0.09, cz));
      recessGeos.push(boxGeo(1.7, 0.18, 0.02, 0, SHOP.ceil + 0.09, cz - 1.31));
      recessGeos.push(boxGeo(1.7, 0.18, 0.02, 0, SHOP.ceil + 0.09, cz + 1.31));
      coveGeos.push(boxGeo(1.66, 0.025, 0.02, 0, SHOP.ceil + 0.02, cz - 1.28));
      coveGeos.push(boxGeo(1.66, 0.025, 0.02, 0, SHOP.ceil + 0.02, cz + 1.28));
      coveGeos.push(boxGeo(0.02, 0.025, 2.56, -0.83, SHOP.ceil + 0.02, cz));
      coveGeos.push(boxGeo(0.02, 0.025, 2.56, 0.83, SHOP.ceil + 0.02, cz));
    }
    const recessMat = new THREE.MeshStandardMaterial({ color: "#f3e7d6", emissive: warm, emissiveIntensity: 0.18, roughness: 0.9, side: THREE.DoubleSide });
    addEm(recessMat, 0.15, 0.55);
    root.add(merged(recessGeos, recessMat));
    root.add(merged(coveGeos, coveMat));
  }

  // track lighting: two black rails, heads angled at the walls
  {
    const railGeos = [];
    const headGeos = [];
    const lensMat = emissiveMat(warmHot, 1.5);
    addEm(lensMat, 1.2, 3.0);
    const lensGeos = [];
    const poolMat = new THREE.MeshBasicMaterial({ map: poolTex, color: warm, transparent: true, opacity: 0.1, blending: THREE.AdditiveBlending, depthWrite: false });
    addEm(poolMat, 0.07, 0.26, "opacity");
    reg.pools.push(poolMat);
    for (const side of [-1, 1]) {
      const rx = side * 1.25;
      railGeos.push(boxGeo(0.04, 0.035, 10.6, rx, SHOP.ceil - 0.02, -6.2));
      const count = lite ? 7 : 11;
      for (let i = 0; i < count; i++) {
        const z = -1.2 - (i * 10) / (count - 1);
        // stem + can, tilted toward the wall on this side
        const can = new THREE.CylinderGeometry(0.045, 0.05, 0.17, 12);
        // tilt so the open end points down and out toward this side's wall
        can.rotateZ(side * 0.62);
        can.translate(rx + side * 0.06, SHOP.ceil - 0.13, z);
        headGeos.push(can);
        headGeos.push(boxGeo(0.015, 0.06, 0.015, rx, SHOP.ceil - 0.05, z));
        const lens = new THREE.CircleGeometry(0.04, 12);
        lens.rotateY(side * Math.PI / 2);
        lens.rotateZ(-side * 0.95);
        lens.translate(rx + side * 0.115, SHOP.ceil - 0.2, z);
        lensGeos.push(lens);
        // the wash it throws on the wall
        const pool = new THREE.Mesh(new THREE.PlaneGeometry(1.25, 2.1), poolMat);
        pool.rotation.y = side > 0 ? -Math.PI / 2 : Math.PI / 2;
        pool.position.set(side > 0 ? SHOP.xR - 0.01 : SHOP.xL + 0.01, 1.85, z);
        root.add(pool);
      }
    }
    root.add(merged(railGeos, mats.black));
    root.add(merged(headGeos, mats.black));
    root.add(merged(lensGeos, lensMat));
  }

  /* ---------------------------------------------------- left wall: the new-in wall */
  const stacks = []; // [x, y, z, ry] for folded garments
  const wallSlots = [];
  {
    const x0 = SHOP.xL, d = 0.42, z0 = -1.9, z1 = -8.3;
    const bays = 4, bayW = (z0 - z1) / bays;
    const geos = [];
    for (let i = 0; i <= bays; i++) geos.push(boxGeo(d, 2.7, 0.03, x0 + d / 2, 1.35, z0 - i * bayW));
    for (const y of [0.05, 0.42, 0.84, 2.22, 2.66]) geos.push(boxGeo(d, 0.03, z0 - z1, x0 + d / 2, y, (z0 + z1) / 2));
    // thin backer behind the lightbox band, a shade darker
    root.add(merged(geos, mats.white));
    const backer = box(0.01, 1.33, z0 - z1, new THREE.MeshStandardMaterial({ color: "#e4e2dd", roughness: 0.8 }), x0 + 0.01, 1.53, (z0 + z1) / 2);
    root.add(backer);
    for (let b = 0; b < bays; b++) {
      const zc = z0 - bayW * (b + 0.5);
      // two lightboxes per bay at eye level
      for (const off of [-0.385, 0.385]) wallSlots.push({ x: x0 + 0.07, y: 1.53, z: zc + off, ry: Math.PI / 2, w: 0.68, kind: "wall" });
      // folded stacks on the shelves below and above
      for (const y of [0.065, 0.445, 2.245]) {
        for (const off of [-0.42, 0, 0.42]) {
          if (y > 2 && off === 0) continue;
          const n = 3 + Math.floor(r() * 4);
          for (let k = 0; k < n; k++) stacks.push([x0 + 0.22, y + 0.03 + k * 0.058, zc + off + (r() - 0.5) * 0.02, Math.PI / 2 + (r() - 0.5) * 0.06]);
        }
      }
    }
  }

  // the entrance pillar in textured plaster
  root.add(box(0.44, SHOP.ceil, 0.8, mats.plaster, SHOP.xL + 0.22, SHOP.ceil / 2, -1.45));

  /* ---------------------------------------------------- right wall: steel racks */
  const coats = [];
  {
    const x0 = SHOP.xR, z0 = -1.9, z1 = -8.6;
    const bays = 4, bayW = (z0 - z1) / bays;
    const steel = [];
    for (let i = 0; i <= bays; i++) steel.push(boxGeo(0.035, 2.85, 0.035, x0 - 0.36, 1.43, z0 - i * bayW), boxGeo(0.035, 2.85, 0.035, x0 - 0.04, 1.43, z0 - i * bayW));
    for (let b = 0; b < bays; b++) {
      const zc = z0 - bayW * (b + 0.5);
      if (b === 2) {
        // a shelving bay between the racks, as in the photos
        for (const y of [0.4, 0.95, 1.5, 2.05, 2.6]) {
          steel.push(boxGeo(0.4, 0.025, bayW - 0.05, x0 - 0.2, y, zc));
          const n = y > 2.5 ? 0 : 3 + Math.floor(r() * 3);
          for (const off of [-0.4, 0, 0.4]) {
            const m = Math.max(0, n - (off === 0 ? 1 : 0));
            for (let k = 0; k < m; k++) stacks.push([x0 - 0.21, y + 0.04 + k * 0.058, zc + off, -Math.PI / 2 + (r() - 0.5) * 0.06]);
          }
        }
        continue;
      }
      for (const railY of [2.45, 1.38]) {
        const rail = new THREE.CylinderGeometry(0.014, 0.014, bayW, 8);
        rail.rotateX(Math.PI / 2);
        rail.translate(x0 - 0.3, railY, zc);
        steel.push(rail);
        const n = lite ? 10 : 15;
        for (let k = 0; k < n; k++) {
          const z = zc - bayW / 2 + 0.12 + ((bayW - 0.24) * k) / (n - 1);
          coats.push([x0 - 0.3, railY - 0.03, z, (r() - 0.5) * 0.22, 0.9 + r() * 0.2]);
        }
      }
    }
    // white shelf on top of the racks
    steel.push(boxGeo(0.42, 0.03, z0 - z1, x0 - 0.21, 2.86, (z0 + z1) / 2));
    root.add(merged(steel, mats.black));
  }

  /* ---------------------------------------------------- the long white table */
  const tableSlots = [];
  {
    // set left of centre so the camera's aisle (on the right) stays clear
    const cx = -0.56, cz = -5.0, L = 2.8, W = 1.0, H = 0.92;
    const top = new RoundedBoxGeometry(W, 0.06, L, 2, 0.012);
    top.translate(cx, H, cz);
    const shelves = [boxGeo(W - 0.08, 0.03, L - 0.08, cx, 0.5, cz), boxGeo(W - 0.08, 0.03, L - 0.08, cx, 0.14, cz)];
    root.add(new THREE.Mesh(top, mats.whiteGloss));
    root.add(merged(shelves, mats.white));
    const frame = [];
    for (const sx of [-1, 1]) for (const sz of [-1, 1]) frame.push(boxGeo(0.04, H, 0.04, cx + sx * (W / 2 - 0.03), H / 2, cz + sz * (L / 2 - 0.03)));
    for (const y of [0.5, 0.14]) {
      frame.push(boxGeo(0.03, 0.03, L, cx - W / 2 + 0.03, y - 0.03, cz));
      frame.push(boxGeo(0.03, 0.03, L, cx + W / 2 - 0.03, y - 0.03, cz));
    }
    root.add(merged(frame, mats.black));
    addShadow(root, shadowTex, cx, cz, 1.9, 3.6, 0.55);
    // stacks on the top and the shelves
    for (const [y, n0] of [[H + 0.03, 3], [0.53, 3], [0.17, 3]]) {
      for (const offZ of [-1.0, -0.33, 0.33, 1.0]) {
        if (y > 0.9 && (offZ === -0.33 || offZ === 0.33)) continue; // room for the frames
        for (const offX of [-0.22, 0.22]) {
          const n = n0 + Math.floor(r() * 3);
          for (let k = 0; k < n; k++) stacks.push([cx + offX, y + k * 0.058, cz + offZ, (r() - 0.5) * 0.08]);
        }
      }
    }
    // two standing frames on the table, facing the door
    tableSlots.push({ x: cx - 0.2, y: H + 0.33, z: cz + 0.2, ry: 0.12, w: 0.38, kind: "table" });
    tableSlots.push({ x: cx + 0.22, y: H + 0.33, z: cz - 0.25, ry: -0.18, w: 0.38, kind: "table" });
  }

  /* ---------------------------------------------------- back of the shop */
  {
    // cash desk: white top on a black base
    root.add(box(1.7, 0.98, 0.62, mats.matteBlack, 1.25, 0.49, -11.4));
    root.add(box(1.76, 0.05, 0.68, mats.whiteGloss, 1.25, 1.0, -11.4));
    addShadow(root, shadowTex, 1.25, -11.4, 2.4, 1.3, 0.5);
    // mirror on the left — a dark glossy panel
    const mirror = box(0.03, 2.1, 0.9, new THREE.MeshStandardMaterial({ color: "#3a3d42", roughness: 0.04, metalness: 0.9 }), SHOP.xL + 0.02, 1.2, -10.6);
    root.add(mirror);
    root.add(box(0.05, 2.2, 0.98, mats.black, SHOP.xL + 0.01, 1.2, -10.6));
  }

  // neon on the back wall (texture swapped at runtime: "new in" / "sale")
  {
    const neonMat = new THREE.MeshBasicMaterial({ transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false, fog: false });
    neonMat.color.setScalar(1.9); // hot enough to read as light, not paint
    const neon = new THREE.Mesh(new THREE.PlaneGeometry(2.1, 0.66), neonMat);
    neon.position.set(-0.45, 1.95, -SHOP.depth + 0.07);
    root.add(neon);
    reg.neon = neon;
    const neonGlowMat = new THREE.MeshBasicMaterial({ map: poolTex, color: "#ff5a36", transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false });
    const ng = new THREE.Mesh(new THREE.PlaneGeometry(3.4, 2.4), neonGlowMat);
    ng.position.set(-0.45, 1.85, -SHOP.depth + 0.05);
    root.add(ng);
    reg.neonGlow = neonGlowMat;
  }

  // the plant by the entrance
  {
    const pot = new THREE.Mesh(new THREE.CylinderGeometry(0.19, 0.15, 0.46, 24), mats.whiteGloss);
    pot.position.set(-1.88, 0.23, -12.25);
    root.add(pot);
    const green = new THREE.MeshStandardMaterial({ color: "#4f6b3c", roughness: 0.7 });
    const stems = [];
    for (let i = 0; i < 5; i++) {
      const h = 0.55 + r() * 0.65;
      const c = new THREE.CapsuleGeometry(0.035 + r() * 0.015, h, 4, 8);
      c.rotateZ((r() - 0.5) * 0.25);
      c.rotateX((r() - 0.5) * 0.25);
      c.translate(-1.88 + (r() - 0.5) * 0.16, 0.46 + h / 2, -12.25 + (r() - 0.5) * 0.16);
      stems.push(c);
    }
    root.add(merged(stems, green));
    addShadow(root, shadowTex, -1.88, -12.25, 0.7, 0.7, 0.5);
  }

  /* ---------------------------------------------------- instanced stock */
  {
    const geo = new RoundedBoxGeometry(0.34, 0.052, 0.28, 2, 0.018);
    const im = new THREE.InstancedMesh(geo, mats.fold, stacks.length);
    const m4 = new THREE.Matrix4();
    const q = new THREE.Quaternion();
    const c = new THREE.Color();
    stacks.forEach(([x, y, z, ry], i) => {
      q.setFromAxisAngle(new THREE.Vector3(0, 1, 0), ry);
      const s = 0.97 + r() * 0.06;
      m4.compose(new THREE.Vector3(x, y, z), q, new THREE.Vector3(s, 1, s));
      im.setMatrixAt(i, m4);
      c.set(WINTER[Math.floor(r() * WINTER.length)]);
      im.setColorAt(i, c);
    });
    root.add(im);
  }
  {
    // the coat's width already runs across x (out from the wall) and its
    // thickness along z (the rail), which is how clothes hang on a wall rail
    const geo = coatGeometry();
    const im = new THREE.InstancedMesh(geo, mats.fabric, coats.length);
    const m4 = new THREE.Matrix4();
    const q = new THREE.Quaternion();
    const c = new THREE.Color();
    const hooks = [];
    coats.forEach(([x, y, z, rot, len], i) => {
      q.setFromEuler(new THREE.Euler(0, rot, 0));
      m4.compose(new THREE.Vector3(x - 0.03, y - 0.06, z), q, new THREE.Vector3(1, len, 1));
      im.setMatrixAt(i, m4);
      c.set(WINTER[Math.floor(r() * WINTER.length)]);
      im.setColorAt(i, c);
      const hk = new THREE.TorusGeometry(0.03, 0.004, 4, 10, Math.PI * 1.3);
      hk.translate(x, y + 0.03, z);
      hooks.push(hk);
    });
    root.add(im);
    root.add(merged(hooks, mats.black));
    reg.coats = im;
  }

  // contact shadows along both walls
  addShadow(root, shadowTex, SHOP.xL + 0.3, -5.1, 1.0, 7.0, 0.45);
  addShadow(root, shadowTex, SHOP.xR - 0.3, -5.3, 1.0, 7.4, 0.45);

  /* ---------------------------------------------------- lightbox slots */
  const slots = [...windowSlots, ...wallSlots, ...tableSlots];
  const frameMat = mats.black;
  // until a photo arrives, a frame glows like an empty lightbox
  const emptyMat = new THREE.MeshStandardMaterial({ color: "#e9e4dc", emissive: "#f6efe4", emissiveIntensity: 0.55, roughness: 0.9 });
  slots.forEach((s, i) => {
    const h = s.w * 1.25;
    const g = new THREE.Group();
    g.position.set(s.x, s.y, s.z);
    g.rotation.y = s.ry;
    const fr = box(s.w + 0.05, h + 0.05, 0.035, frameMat, 0, 0, -0.02);
    g.add(fr);
    const pic = new THREE.Mesh(new THREE.PlaneGeometry(s.w, h), emptyMat);
    pic.position.z = 0.0;
    g.add(pic);
    if (s.kind === "window" || s.kind === "table") {
      // slim stand under free-standing frames
      const stand = box(0.03, s.kind === "window" ? 0.9 : 0.3, 0.03, frameMat, 0, -h / 2 - (s.kind === "window" ? 0.45 : 0.15), -0.03);
      g.add(stand);
    }
    // stays hidden until its photo has arrived — an empty frame on the
    // wall looks like something failed to load
    g.visible = false;
    root.add(g);
    reg.panels.push({ slot: s, group: g, pic, frame: fr, index: i, product: null, hover: 0 });
  });

  // daylight shadow: everything on the street side of the glass takes part
  root.traverse((o) => {
    if (!o.isMesh) return;
    const wp = new THREE.Vector3();
    o.getWorldPosition(wp);
    if (wp.z > -1.4 && !o.material.transparent) {
      o.castShadow = true;
      o.receiveShadow = true;
    }
  });
  return { root, reg, mats, textures: { glowTex, poolTex, shadowTex } };
}

function addShadow(root, tex, x, z, w, d, opacity) {
  const m = new THREE.Mesh(
    new THREE.PlaneGeometry(w, d),
    new THREE.MeshBasicMaterial({ map: tex, transparent: true, opacity, depthWrite: false })
  );
  m.rotation.x = -Math.PI / 2;
  m.position.set(x, 0.004, z);
  root.add(m);
}
