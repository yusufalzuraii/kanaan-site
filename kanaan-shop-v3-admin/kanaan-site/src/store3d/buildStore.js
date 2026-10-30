/* The Kanaan store in Saida, drawn after the real shop.

   The storefront: the white fascia with the 3D letters, the canopy and its
   bulbs, the glass front, the door, the window with its mannequins. Inside,
   the layout follows the real shop wall by wall (as the owner's own photos
   and scans of it showed it):

     left, front    the white cubby wall: folded stock sorted by colour in
                    square cubbies, a jacket hung out in front, a rail of
                    hoodies and jackets underneath
     middle         the long white table, folded stock on top, a shelf and a
                    rail of shirts underneath
     right          black steel racks, jackets on two rails, folded stock on
                    the shelf on top
     left, back     the jeans wall: white shelves on black brackets, piles of
                    jeans with their leather patches and price tags
     right, back    the shoe wall: sneakers on floating white shelves
     back           the dark partition with the shop's own neon — "Your Happy
                    Place" — over the sock wall and a rail of trousers; the
                    mirror, the counter, the striped curtain over the back door

   And the light is the shop's light: a white ceiling with its coffers, two
   black tracks of spots and round downlights; warm pools on a grey
   porcelain floor; real shadows under the table and the racks (drawn once,
   the shop never moves); soft shading where walls meet the floor and the
   ceiling.

   Coordinates: metres, x across the shop (left wall -2.3, right wall
   +2.3), y up, the glass front at z 0 and the back wall at z -13. */
import * as THREE from "three";
import { RoundedBoxGeometry } from "three/addons/geometries/RoundedBoxGeometry.js";
import { mergeGeometries } from "three/addons/utils/BufferGeometryUtils.js";
import { LOGO } from "./logoShapes.js";
import { topGeometry, trousersGeometry, sneakerGeometries } from "./garments.js";
import {
  rng,
  floorTexture,
  pavementTexture,
  foldTexture,
  glowTexture,
  poolTexture,
  contactShadowTexture,
  logoCanvasTexture,
  plasterTexture,
  shutterTexture,
  denimTexture,
  sockPackTexture,
  curtainTexture,
  edgeShadeTexture,
  paintTexture,
  clothTexture,
  cubbyTexture,
} from "./textures.js";

export const SHOP = {
  xL: -2.3,
  xR: 2.3,
  depth: 13,
  ceil: 3.0,
  doorX: [0.85, 2.2],
};

// Winter stock: what's on the rails and shelves this season.
const WINTER = [
  "#1b1b1e", "#1b1b1e", "#2c2d31", "#3f4045", "#5f6066", "#8d8e93",
  "#e6e2d8", "#d4ccbb", "#b9a88b", "#8b6b4e", "#5a3a29", "#3e2a21",
  "#3c4637", "#556049", "#27303d", "#3a4658", "#5e2a30", "#7a2f33",
];
// The cubby wall is sorted by colour, a cubby per colour, with a few bright
// ones like the real wall (the yellow, the sky blue, the maroon).
const CUBBY = [
  "#f1efe9", "#f1efe9", "#e3ded3", "#1c1c1f", "#2a2b30", "#45474d", "#8f9096",
  "#27303d", "#3a4658", "#d8c9a9", "#b9a88b", "#3c4637",
  "#e5c547", "#7fb0d3", "#6e2a36", "#9b3b3b",
];
// Hoodies and jackets on the rail under the cubbies: the most colourful rail
// in the shop.
const HOODIES = ["#f1efe9", "#e5c547", "#c63b2f", "#1f6f75", "#1c1c1f", "#8d8e93", "#27303d", "#d8c9a9", "#7fb0d3", "#5a3a29", "#efe8da", "#3c4637"];
// Jeans: rinse, mid and light washes, black, a few chinos.
const DENIM = ["#22314b", "#2c3f5f", "#2c3f5f", "#3b5276", "#557092", "#7790b0", "#1b1c21", "#2b2c31", "#857659", "#6a6252"];
const TROUSERS = ["#2c3f5f", "#557092", "#1b1c21", "#d8cdb6", "#f0ede6", "#9b3b3b", "#3b5276", "#6a6252", "#2b2c31", "#7790b0"];
const SHOES = ["#f3f2ee", "#f3f2ee", "#f3f2ee", "#1c1c1f", "#8d8e93", "#d8cdb6", "#f3f2ee", "#2a2b30"];

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

/* A flat quad as geometry, turned and placed (Euler XYZ, like a mesh), so
   many of them can be merged into one draw. */
function planeGeo(w, h, [rx = 0, ry = 0, rz = 0], [x, y, z]) {
  const g = new THREE.PlaneGeometry(w, h);
  if (rz) g.rotateZ(rz);
  if (ry) g.rotateY(ry);
  if (rx) g.rotateX(rx);
  g.translate(x, y, z);
  return g;
}

function merged(geos, mat) {
  const g = mergeGeometries(geos.map((x) => (x.index ? x : x)), false);
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

/* A coat seen from the side, for the mannequins: an extruded outline. */
function coatGeometry(length = 0.78, depth = 0.026) {
  const sh = new THREE.Shape();
  const L = length;
  sh.moveTo(0, 0.012);
  sh.quadraticCurveTo(-0.05, 0.016, -0.07, -0.012);
  sh.quadraticCurveTo(-0.17, -0.035, -0.225, -0.075);
  sh.quadraticCurveTo(-0.248, -0.1, -0.252, -0.16);
  sh.lineTo(-0.262, -0.56);
  sh.quadraticCurveTo(-0.262, -0.6, -0.236, -0.6);
  sh.lineTo(-0.212, -0.6);
  sh.lineTo(-0.206, -L + 0.03);
  sh.quadraticCurveTo(-0.205, -L, -0.17, -L);
  sh.quadraticCurveTo(0, -L - 0.018, 0.17, -L);
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

/* A window mannequin, the light grey of the ones in the shop's window. */
function buildMannequin(mats, { top, pants, turn = 0, x = 0, z = 0, tee = false }) {
  const g = new THREE.Group();
  const skin = mats.mannequin;
  const pantsMat = new THREE.MeshStandardMaterial({ color: pants, roughness: 0.85, map: mats.denimMap });
  const topMat = new THREE.MeshStandardMaterial({ color: top, roughness: 0.9, map: mats.fabric.map, vertexColors: true });
  const base = new THREE.Mesh(new THREE.CylinderGeometry(0.17, 0.19, 0.025, 28), mats.black);
  base.position.y = 0.012;
  g.add(base);
  for (const sx of [-1, 1]) {
    const leg = new THREE.Mesh(new THREE.CapsuleGeometry(0.068, 0.72, 4, 12), pantsMat);
    leg.position.set(sx * 0.085, 0.47, 0);
    leg.rotation.z = sx * 0.035;
    g.add(leg);
    const shoe = new THREE.Mesh(new RoundedBoxGeometry(0.11, 0.07, 0.25, 2, 0.03), mats.shoeWhite);
    shoe.position.set(sx * 0.09, 0.06, 0.045);
    g.add(shoe);
  }
  const hips = new THREE.Mesh(new RoundedBoxGeometry(0.34, 0.2, 0.2, 2, 0.08), pantsMat);
  hips.position.y = 0.92;
  g.add(hips);
  const body = new THREE.Mesh(coatGeometry(tee ? 0.62 : 0.84, 0.16), topMat);
  body.position.y = 1.56;
  if (tee) body.scale.set(1, 1, 0.9);
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
    emissive: [],
    pools: [],
    bulbs: [],
    spots: [],
    door: null,
    halo: null,
    neon: null,
    glowPoints: null,
    pointer: [],
    // the room light comes from the shop's own spots; the two broad fill
    // lamps (KanaanStore warmA/warmB) are kept low
    fill: lite ? 0.5 : 0.32,
  };
  const addEm = (mat, day, night, prop = "emissiveIntensity") => reg.emissive.push({ mat, day, night, prop });

  /* materials */
  const denimMap = denimTexture();
  const mats = {
    white: new THREE.MeshStandardMaterial({ color: "#f3f2ef", roughness: 0.5, metalness: 0 }),
    whiteGloss: new THREE.MeshStandardMaterial({ color: "#f6f5f2", roughness: 0.16, metalness: 0 }),
    black: new THREE.MeshStandardMaterial({ color: "#1a1a1d", roughness: 0.42, metalness: 0.6 }),
    matteBlack: new THREE.MeshStandardMaterial({ color: "#151517", roughness: 0.8, metalness: 0.1 }),
    letter: new THREE.MeshStandardMaterial({ color: "#1f1f22", roughness: 0.68, metalness: 0.06, envMapIntensity: 0.45 }),
    wall: new THREE.MeshStandardMaterial({ color: "#ffffff", map: paintTexture(), roughness: 0.92, metalness: 0 }),
    glass: new THREE.MeshStandardMaterial({ color: "#d8e6e8", roughness: 0.04, metalness: 0.2, transparent: true, opacity: 0.16, depthWrite: false }),
    floor: new THREE.MeshStandardMaterial({ color: "#ffffff", map: floorTexture(), roughness: 0.16, metalness: 0.05, envMapIntensity: 1.2 }),
    pavement: new THREE.MeshStandardMaterial({ color: "#ffffff", map: pavementTexture(), roughness: 0.85, metalness: 0 }),
    fold: new THREE.MeshStandardMaterial({ color: "#ffffff", map: foldTexture(), roughness: 0.92, metalness: 0 }),
    jeans: new THREE.MeshStandardMaterial({ color: "#ffffff", map: denimMap, roughness: 0.95, metalness: 0 }),
    fabric: new THREE.MeshStandardMaterial({ color: "#ffffff", map: clothTexture(), roughness: 0.95, metalness: 0, vertexColors: true, envMapIntensity: 0.6 }),
    plaster: new THREE.MeshStandardMaterial({ color: "#ffffff", map: plasterTexture(), roughness: 0.95, metalness: 0 }),
    facadeDark: new THREE.MeshStandardMaterial({ color: "#26272b", roughness: 0.3, metalness: 0.4 }),
    concrete: new THREE.MeshStandardMaterial({ color: "#5c5d61", roughness: 0.95, metalness: 0 }),
    mannequin: new THREE.MeshStandardMaterial({ color: "#d9d9d6", roughness: 0.45, metalness: 0.05 }),
    shoeWhite: new THREE.MeshStandardMaterial({ color: "#f4f3ef", roughness: 0.55 }),
    shutter: new THREE.MeshStandardMaterial({ color: "#b4b6ba", map: shutterTexture(), roughness: 0.6, metalness: 0.3 }),
    darkGlass: new THREE.MeshStandardMaterial({ color: "#101216", roughness: 0.08, metalness: 0.6 }),
    partition: new THREE.MeshStandardMaterial({ color: "#2a2a2e", roughness: 0.78, metalness: 0.05 }),
    mirror: new THREE.MeshStandardMaterial({ color: "#e8ecef", roughness: 0.03, metalness: 1, envMapIntensity: 1.1 }),
    curtain: new THREE.MeshStandardMaterial({ color: "#ffffff", map: curtainTexture(), roughness: 0.9, side: THREE.DoubleSide }),
    green: new THREE.MeshStandardMaterial({ color: "#46663a", roughness: 0.7 }),
    denimMap,
  };
  const glowTex = glowTexture(128, 2.4);
  const poolTex = poolTexture();
  const shadowTex = contactShadowTexture();
  const edgeTex = edgeShadeTexture();
  const edgeMat = new THREE.MeshBasicMaterial({ map: edgeTex, transparent: true, depthWrite: false, opacity: 0.55 });
  // every strip of corner shading, merged into one draw at the end
  const edgeGeos = [];

  const emissiveMat = (color, base = 0) =>
    new THREE.MeshStandardMaterial({ color: "#111", emissive: color, emissiveIntensity: base, roughness: 0.4 });

  // furniture inside casts and takes the shop's spot shadows; listed here
  // and switched on at the end
  const shadowed = [];
  const cast = (o) => { shadowed.push(o); return o; };

  /* ---------------------------------------------------- street & facade */
  // The pavement runs on past the camera: on a phone the opening shot
  // stands well back and looks down, and the ground under the words at the
  // bottom of the screen must still be this street — a kerb or a dark road
  // there read as the picture ending in a band under the buttons.
  const PAVE_W = 32, PAVE_D = 34;
  const pave = new THREE.Mesh(new THREE.PlaneGeometry(PAVE_W, PAVE_D), mats.pavement);
  pave.rotation.x = -Math.PI / 2;
  pave.position.set(0, 0, PAVE_D / 2);
  pave.receiveShadow = true;
  // the same 80 cm slabs as before, whatever the size of the plane
  mats.pavement.map.repeat.set(PAVE_W / 3.2, PAVE_D / 2.83);
  root.add(pave);

  root.add(box(4, 11.6, 1.2, mats.facadeDark, -5.3, 5.8, -0.4));
  root.add(box(4, 11.6, 1.2, mats.facadeDark, 5.3, 5.8, -0.4));
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
    const lampMat = new THREE.MeshStandardMaterial({ color: "#2a2117", emissive: "#ffc98f", emissiveIntensity: 0, roughness: 0.6 });
    addEm(lampMat, 0, 0.9);
    const lit = new Set(["-5.25:6.3:0.9", "5.25:4.4:-0.9", "5.25:8.2:0.9", "-5.25:10.1:-0.9"]);
    for (const nx of [-5.25, 5.25]) {
      for (const wy of [4.4, 6.3, 8.2, 10.1]) {
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
  root.add(box(6.6, 6.2, 0.6, mats.facadeDark, 0, 8.45, -0.1));
  const upperWin = new THREE.MeshStandardMaterial({ color: "#0e1013", roughness: 0.08, metalness: 0.6 });
  const upperLamp = new THREE.MeshStandardMaterial({ color: "#2a2117", emissive: "#ffc98f", emissiveIntensity: 0, roughness: 0.6 });
  addEm(upperLamp, 0, 0.75);
  for (const wy of [6.9, 9.05]) {
    for (let i = 0; i < 3; i++) root.add(box(1.7, 1.9, 0.05, wy > 8 && i === 2 ? upperLamp : upperWin, -2.1 + i * 2.1, wy, 0.21));
  }

  const fascia = box(6.5, 1.9, 0.14, mats.white, 0, 4.42, 0.32);
  fascia.receiveShadow = true;
  root.add(fascia);
  const logo = buildLogo(5.5, mats);
  logo.position.set(0, 4.44, 0.39);
  logo.traverse((o) => { if (o.isMesh) o.castShadow = true; });
  root.add(logo);
  reg.shadowCasters = [logo];

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

  // canopy, with the three round white puck lights of the real one
  const canopy = box(6.5, 0.3, 1.05, mats.matteBlack, 0, 3.32, 0.52);
  canopy.castShadow = true;
  root.add(canopy);
  const downMat = emissiveMat(warmHot, 0.6);
  addEm(downMat, 0.5, 3.2);
  for (const x of [-2.1, 0, 2.1]) {
    const puck = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.2, 0.04, 32), mats.white);
    puck.position.set(x, 3.15, 0.6);
    root.add(puck);
    const d = new THREE.Mesh(new THREE.CircleGeometry(0.17, 32), downMat);
    d.rotation.x = Math.PI / 2;
    d.position.set(x, 3.128, 0.6);
    root.add(d);
  }
  const pavePoolMat = new THREE.MeshBasicMaterial({ map: poolTex, color: warm, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false });
  addEm(pavePoolMat, 0.02, 0.32, "opacity");
  for (const x of [-2.1, 0, 2.1]) {
    const p = new THREE.Mesh(new THREE.PlaneGeometry(2.6, 3.2), pavePoolMat);
    p.rotation.x = -Math.PI / 2;
    p.position.set(x, 0.006, 1.2);
    root.add(p);
  }

  // string lights along the canopy edge
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
  root.add(merged([
    boxGeo(0.07, 3.05, 0.09, SHOP.xL - 0.02, 1.58, 0),
    boxGeo(0.07, 3.05, 0.09, 0.79, 1.58, 0),
    boxGeo(0.07, 3.05, 0.09, SHOP.xR + 0.02, 1.58, 0),
    boxGeo(4.75, 0.08, 0.1, 0, 3.12, 0),
    boxGeo(4.75, 0.12, 0.1, 0, 0.06, 0),
    boxGeo(0.5, 3.2, 0.5, -2.75, 1.6, 0.05),
    boxGeo(0.5, 3.2, 0.5, 2.75, 1.6, 0.05),
  ], mats.matteBlack));
  const fixedGlass = new THREE.Mesh(new THREE.PlaneGeometry(3.08, 2.98), mats.glass);
  fixedGlass.position.set(-0.76, 1.6, 0.0);
  root.add(fixedGlass);
  const vinylTex = logoCanvasTexture({ width: 1024, color: "#ffffff", pad: 0.02 });
  const vinylMat = new THREE.MeshBasicMaterial({ map: vinylTex, transparent: true, opacity: 0.88, depthWrite: false, toneMapped: false });
  const vinyl = new THREE.Mesh(new THREE.PlaneGeometry(1.85, 1.85 / vinylTex.userData.aspect), vinylMat);
  vinyl.position.set(-0.76, 2.52, 0.012);
  root.add(vinyl);
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
      boxGeo(0.03, 1.2, 0.03, -w / 2 + 0.16, 1.2, 0.07),
      boxGeo(0.03, 0.03, 0.07, -w / 2 + 0.16, 1.75, 0.035),
      boxGeo(0.03, 0.03, 0.07, -w / 2 + 0.16, 0.65, 0.035),
    ], mats.black));
    pivot.add(leaf);
    root.add(pivot);
    reg.door = pivot;
  }

  // window display: white plinth, three light-grey mannequins dressed like
  // the real window (a beige jacket, a white graphic tee, a striped shirt)
  root.add(box(2.5, 0.3, 0.95, mats.white, -0.6, 0.15, -0.8));
  addShadow(root, shadowTex, -0.6, -0.8, 3.0, 1.4, 0.5);
  root.add(buildMannequin(mats, { top: "#c8b394", pants: "#7790b0", turn: 0.22, x: -1.38, z: -0.85 }));
  root.add(buildMannequin(mats, { top: "#f1efe9", pants: "#3b5276", turn: -0.05, x: -0.6, z: -0.9, tee: true }));
  root.add(buildMannequin(mats, { top: "#56657a", pants: "#557092", turn: -0.26, x: 0.2, z: -0.85 }));
  // a low cactus in a white pot on the plinth, like the window's
  {
    const pot = new THREE.Mesh(new THREE.CylinderGeometry(0.11, 0.09, 0.2, 20), mats.whiteGloss);
    pot.position.set(-0.98, 0.4, -0.55);
    root.add(pot);
    const arms = [];
    for (const [dx, h] of [[0, 0.42], [0.06, 0.3], [-0.06, 0.26]]) {
      const c = new THREE.CapsuleGeometry(0.035, h, 4, 8);
      c.translate(-0.98 + dx, 0.5 + h / 2, -0.55);
      arms.push(c);
    }
    root.add(merged(arms, mats.green));
  }

  /* ---------------------------------------------------- interior shell */
  const floor = new THREE.Mesh(new THREE.PlaneGeometry(SHOP.xR - SHOP.xL, SHOP.depth), mats.floor);
  floor.rotation.x = -Math.PI / 2;
  floor.position.set(0, 0.001, -SHOP.depth / 2);
  floor.receiveShadow = true;
  root.add(floor);

  const lw = new THREE.Mesh(new THREE.PlaneGeometry(SHOP.depth, SHOP.ceil), mats.wall);
  lw.rotation.y = Math.PI / 2;
  lw.position.set(SHOP.xL, SHOP.ceil / 2, -SHOP.depth / 2);
  lw.receiveShadow = true;
  root.add(lw);
  const rw = lw.clone();
  rw.rotation.y = -Math.PI / 2;
  rw.position.x = SHOP.xR;
  root.add(rw);
  const back = new THREE.Mesh(new THREE.PlaneGeometry(SHOP.xR - SHOP.xL, SHOP.ceil), mats.wall);
  back.position.set(0, SHOP.ceil / 2, -SHOP.depth);
  back.receiveShadow = true;
  root.add(back);

  // soft shading where the walls meet the floor and the ceiling
  for (const side of [-1, 1]) {
    const x = side < 0 ? SHOP.xL : SHOP.xR;
    // on the floor, along the wall
    edgeGeos.push(planeGeo(SHOP.depth - 1.5, 0.55, [-Math.PI / 2, 0, -Math.PI / 2 * side], [x - side * 0.275, 0.003, -SHOP.depth / 2 - 0.75]));
    // on the wall, under the ceiling
    edgeGeos.push(planeGeo(SHOP.depth - 0.4, 0.45, [0, -side * Math.PI / 2, 0], [x - side * 0.004, SHOP.ceil - 0.225, -SHOP.depth / 2 - 0.2]));
  }
  edgeGeos.push(planeGeo(SHOP.xR - SHOP.xL, 0.55, [-Math.PI / 2, 0, 0], [0, 0.003, -SHOP.depth + 0.275]));

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
    cg.rotateX(Math.PI / 2);
    const ceilMat = new THREE.MeshStandardMaterial({ color: "#f4f3f0", roughness: 0.95, side: THREE.DoubleSide });
    const ceil = new THREE.Mesh(cg, ceilMat);
    ceil.position.y = SHOP.ceil;
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
    // round recessed downlights between the coffers, as in the shop
    const dlMat = emissiveMat(warmHot, 2.0);
    addEm(dlMat, 1.6, 3.6);
    const rings = [], lens = [];
    for (const z of [-0.9, -4.5, -8.3, -12.1]) {
      for (const x of [-1.1, 1.1]) {
        const ring = new THREE.TorusGeometry(0.075, 0.012, 6, 24);
        ring.rotateX(Math.PI / 2);
        ring.translate(x, SHOP.ceil - 0.008, z);
        rings.push(ring);
        const d = new THREE.CircleGeometry(0.068, 20);
        d.rotateX(Math.PI / 2);
        d.translate(x, SHOP.ceil - 0.004, z);
        lens.push(d);
      }
    }
    root.add(merged(rings, mats.white));
    root.add(merged(lens, dlMat));
  }

  // track lighting: two black rails, heads angled at the walls, and the
  // washes they throw
  {
    const railGeos = [];
    const headGeos = [];
    const lensMat = emissiveMat(warmHot, 1.5);
    addEm(lensMat, 1.2, 3.0);
    const lensGeos = [];
    const poolMat = new THREE.MeshBasicMaterial({ map: poolTex, color: warm, transparent: true, opacity: 0.1, blending: THREE.AdditiveBlending, depthWrite: false });
    addEm(poolMat, 0.06, 0.24, "opacity");
    reg.pools.push(poolMat);
    const poolGeos = [];
    for (const side of [-1, 1]) {
      const rx = side * 1.25;
      railGeos.push(boxGeo(0.04, 0.035, 10.6, rx, SHOP.ceil - 0.02, -6.2));
      const count = lite ? 7 : 11;
      for (let i = 0; i < count; i++) {
        const z = -1.2 - (i * 10) / (count - 1);
        const can = new THREE.CylinderGeometry(0.045, 0.05, 0.17, 12);
        can.rotateZ(side * 0.62);
        can.translate(rx + side * 0.06, SHOP.ceil - 0.13, z);
        headGeos.push(can);
        headGeos.push(boxGeo(0.015, 0.06, 0.015, rx, SHOP.ceil - 0.05, z));
        const lens = new THREE.CircleGeometry(0.04, 12);
        lens.rotateY(side * Math.PI / 2);
        lens.rotateZ(-side * 0.95);
        lens.translate(rx + side * 0.115, SHOP.ceil - 0.2, z);
        lensGeos.push(lens);
        poolGeos.push(planeGeo(1.25, 2.1, [0, side > 0 ? -Math.PI / 2 : Math.PI / 2, 0], [side > 0 ? SHOP.xR - 0.012 : SHOP.xL + 0.012, 2.0, z]));
      }
    }
    root.add(merged(railGeos, mats.black));
    root.add(merged(headGeos, mats.black));
    root.add(merged(lensGeos, lensMat));
    root.add(merged(poolGeos, poolMat));
  }

  // the shop's light: three wide downlights along the middle that cast
  // real shadows (drawn once — nothing in here moves)
  {
    const spots = [
      { z: -3.0, tz: -3.2, tx: -0.2 },
      { z: -6.6, tz: -6.8, tx: 0.1 },
      { z: -10.0, tz: -10.2, tx: -0.3 },
    ];
    for (const s of spots) {
      const L = new THREE.SpotLight("#ffd8ad", 0, 8.5, 1.12, 0.9, 1.4);
      L.position.set(s.tx * 0.3, SHOP.ceil - 0.05, s.z);
      L.target.position.set(s.tx, 0, s.tz);
      // a phone gets the light without the shadows (the soft contact
      // shadows under each piece still ground it)
      L.castShadow = !lite;
      L.shadow.mapSize.set(1024, 1024);
      L.shadow.bias = -0.0008;
      L.shadow.normalBias = 0.025;
      L.shadow.radius = lite ? 2 : 5;
      L.shadow.camera.near = 0.3;
      L.shadow.camera.far = 6;
      root.add(L, L.target);
      reg.spots.push({ light: L, day: 14, night: 26 });
    }
    // and two that wash the long walls (no shadows: they only light)
    for (const [x, tx] of lite ? [] : [[0.6, SHOP.xL], [-0.6, SHOP.xR]]) {
      const L = new THREE.SpotLight("#ffe2bf", 0, 9, 0.9, 1, 1.2);
      L.position.set(x, SHOP.ceil - 0.1, -5.2);
      L.target.position.set(tx, 1.2, -5.6);
      root.add(L, L.target);
      reg.spots.push({ light: L, day: 7, night: 12 });
    }
  }

  // the entrance pillar in textured white plaster
  root.add(cast(box(0.44, SHOP.ceil, 0.8, mats.plaster, SHOP.xL + 0.22, SHOP.ceil / 2, -1.45)));

  const stacks = []; // folded stock: [x, y, z, ry, color, scale]
  const coats = [];  // hanging: [x, y, z, ry, length, color, kind]

  /* ---------------------------------------------------- the cubby wall */
  {
    const x0 = SHOP.xL, d = 0.38, z0 = -1.95, z1 = -7.35;
    const rows = 5, rowH = 0.32, y0 = 1.22, cols = 15;
    const colW = (z0 - z1) / cols;
    const geos = [];
    for (let i = 0; i <= cols; i++) geos.push(boxGeo(d, rows * rowH + 0.018, 0.018, x0 + d / 2, y0 + (rows * rowH) / 2, z0 - i * colW));
    for (let j = 0; j <= rows; j++) geos.push(boxGeo(d, 0.018, z0 - z1 + 0.018, x0 + d / 2, y0 + j * rowH, (z0 + z1) / 2));
    root.add(cast(merged(geos, mats.white)));
    // the back of the cubbies, a touch darker than the frame, shaded into
    // each corner (one small texture repeated once per cubby)
    const shade = cubbyTexture();
    shade.repeat.set(cols, rows);
    const backMat = new THREE.MeshStandardMaterial({ color: "#e4e2dd", map: shade, roughness: 0.9 });
    const backPanel = new THREE.Mesh(new THREE.PlaneGeometry(z0 - z1, rows * rowH), backMat);
    backPanel.rotation.y = Math.PI / 2;
    backPanel.position.set(x0 + 0.006, y0 + (rows * rowH) / 2, (z0 + z1) / 2);
    backPanel.receiveShadow = true;
    root.add(backPanel);
    // a shade under each shelf inside the cubbies
    for (let j = 1; j <= rows; j++) {
      edgeGeos.push(planeGeo(z0 - z1, 0.12, [0, Math.PI / 2, 0], [x0 + 0.016, y0 + j * rowH - 0.07, (z0 + z1) / 2]));
    }
    // folded stock, one colour per cubby
    const jacketCols = new Set([3, 4, 10, 11]);
    for (let i = 0; i < cols; i++) {
      for (let j = 0; j < rows; j++) {
        if (jacketCols.has(i) && (j === 2 || j === 3) && r() < 0.6) continue;
        const color = CUBBY[Math.floor(r() * CUBBY.length)];
        const n = 2 + Math.floor(r() * 4);
        const zc = z0 - colW * (i + 0.5);
        for (let k = 0; k < n; k++) stacks.push([x0 + 0.2, y0 + j * rowH + 0.03 + k * 0.045, zc + (r() - 0.5) * 0.01, Math.PI / 2 + (r() - 0.5) * 0.05, color, 0.86]);
      }
    }
    // the rail of hoodies and jackets under the cubbies
    const railX = x0 + 0.31;
    const rail = new THREE.CylinderGeometry(0.013, 0.013, z0 - z1 - 0.1, 8);
    rail.rotateX(Math.PI / 2);
    rail.translate(railX, y0 - 0.1, (z0 + z1) / 2);
    const brackets = [];
    for (const z of [z0 - 0.08, (z0 + z1) / 2, z1 + 0.08]) brackets.push(boxGeo(0.32, 0.02, 0.02, x0 + 0.16, y0 - 0.1, z));
    root.add(merged([rail, ...brackets], mats.black));
    const n = lite ? 22 : 30;
    for (let k = 0; k < n; k++) {
      const z = z0 - 0.15 - ((z0 - z1 - 0.3) * k) / (n - 1);
      coats.push([railX, y0 - 0.13, z, (r() - 0.5) * 0.2, 0.72 + r() * 0.1, HOODIES[Math.floor(r() * HOODIES.length)], "hoodie"]);
    }
    // a low white plinth under the rail
    root.add(cast(box(0.4, 0.16, z0 - z1, mats.white, x0 + 0.2, 0.08, (z0 + z1) / 2)));
    // two jackets hung out in front of the cubbies, facing the shop
    for (const [z, color] of [[z0 - colW * 4, "#262b36"], [z0 - colW * 11, "#b49c76"]]) {
      coats.push([x0 + d + 0.09, y0 + 3.6 * rowH, z, Math.PI / 2, 0.74, color, "display"]);
    }
  }

  /* ---------------------------------------------------- the racks, right */
  {
    const x0 = SHOP.xR, z0 = -1.9, z1 = -8.2;
    const bays = 4, bayW = (z0 - z1) / bays;
    const steel = [];
    for (let i = 0; i <= bays; i++) {
      steel.push(boxGeo(0.03, 2.75, 0.03, x0 - 0.44, 1.375, z0 - i * bayW));
      steel.push(boxGeo(0.03, 2.75, 0.03, x0 - 0.04, 1.375, z0 - i * bayW));
      steel.push(boxGeo(0.42, 0.025, 0.025, x0 - 0.24, 2.6, z0 - i * bayW));
    }
    const shelfTop = [];
    for (let b = 0; b < bays; b++) {
      const zc = z0 - bayW * (b + 0.5);
      for (const railY of [2.08, 1.16]) {
        const rail = new THREE.CylinderGeometry(0.014, 0.014, bayW - 0.04, 8);
        rail.rotateX(Math.PI / 2);
        rail.translate(x0 - 0.3, railY, zc);
        steel.push(rail);
        const n = lite ? 9 : 13;
        for (let k = 0; k < n; k++) {
          const z = zc - bayW / 2 + 0.12 + ((bayW - 0.24) * k) / (n - 1);
          const kind = r() < 0.3 ? "puffer" : r() < 0.5 ? "coat" : "jacket";
          const len = kind === "coat" ? 0.86 + r() * 0.06 : kind === "puffer" ? 0.7 + r() * 0.06 : 0.72 + r() * 0.08;
          coats.push([x0 - 0.3, railY - 0.03, z, (r() - 0.5) * 0.22, Math.min(len, railY - 0.42), WINTER[Math.floor(r() * WINTER.length)], kind]);
        }
      }
      // folded stock on the white shelf on top
      for (const off of [-0.45, 0, 0.45]) {
        const color = CUBBY[Math.floor(r() * CUBBY.length)];
        const n = 3 + Math.floor(r() * 3);
        for (let k = 0; k < n; k++) stacks.push([x0 - 0.22, 2.652 + k * 0.045, zc + off, -Math.PI / 2 + (r() - 0.5) * 0.06, color, 0.95]);
      }
    }
    shelfTop.push(boxGeo(0.44, 0.03, z0 - z1, x0 - 0.22, 2.615, (z0 + z1) / 2));
    root.add(cast(merged(steel, mats.black)));
    root.add(cast(merged(shelfTop, mats.white)));
    addShadow(root, shadowTex, x0 - 0.35, (z0 + z1) / 2, 1.1, z0 - z1 + 0.6, 0.5);
  }

  /* ---------------------------------------------------- the table */
  {
    const cx = -0.56, cz = -4.9, L = 2.8, W = 1.0, H = 0.92;
    const top = new RoundedBoxGeometry(W, 0.06, L, 2, 0.012);
    top.translate(cx, H, cz);
    root.add(cast(new THREE.Mesh(top, mats.whiteGloss)));
    // under the top: a shelf of folded stock on the cubby side, and a rail
    // of shirts on the aisle side
    const shelfX = cx - W / 4;
    root.add(cast(merged([boxGeo(W / 2 - 0.06, 0.025, L - 0.08, shelfX, 0.45, cz), boxGeo(W / 2 - 0.06, 0.025, L - 0.08, shelfX, 0.12, cz)], mats.white)));
    const frame = [];
    for (const sx of [-1, 1]) for (const sz of [-1, 1]) frame.push(boxGeo(0.04, H, 0.04, cx + sx * (W / 2 - 0.03), H / 2, cz + sz * (L / 2 - 0.03)));
    frame.push(boxGeo(0.03, 0.03, L, cx - W / 2 + 0.03, 0.42, cz));
    frame.push(boxGeo(0.03, 0.03, L, cx + 0.0, 0.42, cz));
    const rail = new THREE.CylinderGeometry(0.012, 0.012, L - 0.1, 8);
    rail.rotateX(Math.PI / 2);
    rail.translate(cx + W / 4, H - 0.08, cz);
    frame.push(rail);
    root.add(cast(merged(frame, mats.black)));
    addShadow(root, shadowTex, cx, cz, 1.9, 3.6, 0.6);
    for (const y of [0.475, 0.145]) {
      for (const offZ of [-1.05, -0.35, 0.35, 1.05]) {
        const color = WINTER[Math.floor(r() * WINTER.length)];
        const n = 3 + Math.floor(r() * 3);
        for (let k = 0; k < n && y + k * 0.045 < (y > 0.3 ? 0.86 : 0.4); k++) stacks.push([shelfX, y + 0.01 + k * 0.045, cz + offZ, (r() - 0.5) * 0.06, color, 0.9]);
      }
    }
    const nShirts = lite ? 14 : 20;
    for (let k = 0; k < nShirts; k++) {
      const z = cz - L / 2 + 0.12 + ((L - 0.24) * k) / (nShirts - 1);
      coats.push([cx + W / 4, H - 0.1, z, (r() - 0.5) * 0.2, 0.5 + r() * 0.06, WINTER[Math.floor(r() * WINTER.length)], "shirt"]);
    }
    // on the top: neat stacks, a pair at each end and two in the middle
    for (const offZ of [-1.08, -0.62, 0.62, 1.08]) {
      for (const offX of [-0.22, 0.22]) {
        const color = CUBBY[Math.floor(r() * CUBBY.length)];
        const n = 3 + Math.floor(r() * 3);
        for (let k = 0; k < n; k++) stacks.push([cx + offX, H + 0.052 + k * 0.045, cz + offZ, (r() - 0.5) * 0.08, color, 1]);
      }
    }
  }

  /* ---------------------------------------------------- the jeans wall */
  const jeans = [];   // [x, y, z, ry, color]
  const patches = []; // [x, y, z]
  const tags = [];    // [x, y, z]
  {
    const x0 = SHOP.xL, d = 0.36, z0 = -7.85, z1 = -11.25;
    const shelvesY = [0.32, 0.72, 1.12, 1.52, 1.92, 2.32];
    const geos = [], black = [];
    for (const y of shelvesY) geos.push(boxGeo(d, 0.028, z0 - z1, x0 + d / 2, y, (z0 + z1) / 2));
    // black standards on the wall and the brackets under each shelf
    for (const z of [z0 - 0.15, (z0 + z1) / 2, z1 + 0.15]) {
      black.push(boxGeo(0.02, 2.3, 0.03, x0 + 0.01, 1.32, z));
      for (const y of shelvesY) black.push(boxGeo(d - 0.04, 0.03, 0.018, x0 + (d - 0.04) / 2, y - 0.03, z));
    }
    root.add(cast(merged(geos, mats.white)));
    root.add(merged(black, mats.black));
    for (const y of shelvesY) {
      edgeGeos.push(planeGeo(z0 - z1, 0.14, [0, Math.PI / 2, 0], [x0 + 0.004, y - 0.09, (z0 + z1) / 2]));
    }
    // piles of jeans, one wash per pile, folded edge to the shop
    for (const y of shelvesY) {
      const top = y > 2.2;
      for (let z = z0 - 0.24; z > z1 + 0.15; z -= 0.37) {
        const color = DENIM[Math.floor(r() * DENIM.length)];
        const n = top ? 3 + Math.floor(r() * 2) : 5 + Math.floor(r() * 3);
        for (let k = 0; k < n; k++) {
          const py = y + 0.036 + k * 0.046;
          jeans.push([x0 + 0.19 + (r() - 0.5) * 0.012, py, z + (r() - 0.5) * 0.012, (r() - 0.5) * 0.04, color]);
          if (r() < 0.22) patches.push([x0 + 0.362, py + 0.004, z + 0.08 + (r() - 0.5) * 0.03]);
        }
        if (r() < 0.5) tags.push([x0 + 0.37, y + 0.09 + r() * 0.08, z - 0.06]);
      }
    }
    addShadow(root, shadowTex, x0 + 0.3, (z0 + z1) / 2, 0.9, z0 - z1 + 0.5, 0.45);
  }

  /* ---------------------------------------------------- mirror & counter */
  {
    // tall mirror on the left wall, past the jeans
    const mz = -12.45;
    root.add(box(0.03, 2.0, 0.78, mats.black, SHOP.xL + 0.015, 1.12, mz));
    const mirror = new THREE.Mesh(new THREE.PlaneGeometry(0.7, 1.92), mats.mirror);
    mirror.rotation.y = Math.PI / 2;
    mirror.position.set(SHOP.xL + 0.032, 1.12, mz);
    root.add(mirror);
    // the store photographs the room once from in front of the mirror and
    // lets the mirror reflect that (see KanaanStore.captureMirror)
    reg.mirror = { mesh: mirror, capture: new THREE.Vector3(SHOP.xL + 0.95, 1.35, mz) };
    // the counter in the back corner: white top on a black base, the till
    // screen, the card machine and two Kanaan bags
    const cx = -0.98, cz = -11.98;
    root.add(cast(box(1.5, 0.98, 0.6, mats.matteBlack, cx, 0.49, cz)));
    root.add(cast(box(1.56, 0.05, 0.66, mats.whiteGloss, cx, 1.0, cz)));
    // the logo on the counter's front, in white
    {
      const t = logoCanvasTexture({ width: 1024, color: "#f2f1ee", pad: 0.03 });
      const w = 0.86;
      const front = new THREE.Mesh(new THREE.PlaneGeometry(w, w / t.userData.aspect), new THREE.MeshBasicMaterial({ map: t, transparent: true, depthWrite: false }));
      front.position.set(cx, 0.58, cz + 0.302);
      root.add(front);
    }
    addShadow(root, shadowTex, cx, cz, 2.2, 1.2, 0.5);
    const top = 1.025;
    root.add(box(0.06, 0.16, 0.06, mats.black, cx + 0.42, top + 0.08, cz - 0.12));
    const screen = box(0.52, 0.33, 0.03, mats.matteBlack, cx + 0.42, top + 0.31, cz - 0.12);
    screen.rotation.y = 0.2;
    root.add(screen);
    root.add(box(0.09, 0.035, 0.17, mats.matteBlack, cx - 0.1, top + 0.018, cz + 0.1));
    const bagLogo = logoCanvasTexture({ width: 512, color: "#151517", pad: 0.04, parts: ["letters", "shop"] });
    const bagLogoMat = new THREE.MeshBasicMaterial({ map: bagLogo, transparent: true, depthWrite: false });
    const handle = new THREE.MeshStandardMaterial({ color: "#151517", roughness: 0.7 });
    for (const [bx, bz, sc, ry] of [[cx - 0.5, cz + 0.06, 1, 0.18], [cx - 0.28, cz + 0.16, 0.82, -0.12]]) {
      const bag = new THREE.Group();
      bag.add(box(0.32, 0.38, 0.12, mats.white, 0, 0.19, 0));
      const decal = new THREE.Mesh(new THREE.PlaneGeometry(0.25, 0.25 / bagLogo.userData.aspect), bagLogoMat);
      decal.position.set(0, 0.22, 0.061);
      bag.add(decal);
      for (const hx of [-0.07, 0.07]) {
        const h = new THREE.Mesh(new THREE.TorusGeometry(0.045, 0.004, 4, 12, Math.PI), handle);
        h.position.set(hx, 0.38, 0);
        h.rotation.y = Math.PI / 2;
        bag.add(h);
      }
      bag.position.set(bx, top, bz);
      bag.rotation.y = ry;
      bag.scale.setScalar(sc);
      root.add(bag);
    }
    // the back door behind its striped curtain
    root.add(merged([
      boxGeo(0.06, 2.42, 0.08, -1.5, 1.21, -SHOP.depth + 0.03),
      boxGeo(0.06, 2.42, 0.08, -0.5, 1.21, -SHOP.depth + 0.03),
      boxGeo(1.06, 0.06, 0.08, -1.0, 2.42, -SHOP.depth + 0.03),
    ], mats.black));
    const cg = new THREE.PlaneGeometry(0.98, 2.36, 40, 1);
    const cp = cg.attributes.position;
    for (let i = 0; i < cp.count; i++) cp.setZ(i, Math.sin(cp.getX(i) * 31) * 0.025);
    cg.computeVertexNormals();
    const curtain = new THREE.Mesh(cg, mats.curtain);
    curtain.position.set(-1.0, 1.2, -SHOP.depth + 0.08);
    root.add(curtain);
  }

  /* ---------------------------------------------------- the shoe wall */
  const shoes = []; // [x, y, z, ry, color]
  {
    const x0 = SHOP.xR, z0 = -8.6, z1 = -10.35, d = 0.3;
    const shelvesY = [0.48, 0.84, 1.2, 1.56, 1.92];
    const geos = [];
    for (const y of shelvesY) geos.push(boxGeo(d, 0.022, z0 - z1, x0 - d / 2, y, (z0 + z1) / 2));
    root.add(cast(merged(geos, mats.white)));
    // one shoe of each pair, side-on, toe to the front of the shop — the way
    // a shoe wall shows them
    for (const y of shelvesY) {
      for (let k = 0; k < 4; k++) {
        const z = z0 - 0.38 - k * 0.42;
        const color = SHOES[Math.floor(r() * SHOES.length)];
        shoes.push([x0 - 0.16, y + 0.011, z, (r() - 0.5) * 0.12, color]);
      }
    }
  }

  /* ---------------------------------------------------- the partition */
  // dark wall across the back right, the shop's neon on it, the sock wall
  // and a rail of trousers under it
  {
    const pz = -10.62, x0 = -0.02, x1 = SHOP.xR;
    const wall = box(x1 - x0, SHOP.ceil, 0.12, mats.partition, (x0 + x1) / 2, SHOP.ceil / 2, pz);
    wall.receiveShadow = true;
    root.add(wall);
    const face = pz + 0.061;
    // neon
    // the sign lights up once its script face has loaded (the store swaps
    // the real texture in); until then it is simply off
    const nt = new THREE.Texture();
    nt.userData = { aspect: 1024 / 900 };
    reg.neonFont = { url: "/home/neon-script.woff2", family: "KanaanNeonScript", lines: ["Your", "Happy", "Place"], color: "#ffcf5a" };
    const neonMat = new THREE.MeshBasicMaterial({ map: nt, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false, fog: false });
    neonMat.color.setScalar(1.6);
    const nw = 0.95;
    const neon = new THREE.Mesh(new THREE.PlaneGeometry(nw, nw / nt.userData.aspect), neonMat);
    neon.position.set(1.0, 2.28, face + 0.01);
    root.add(neon);
    reg.neon = neon;
    const neonGlowMat = new THREE.MeshBasicMaterial({ map: poolTex, color: "#ffc45a", transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false });
    const ng = new THREE.Mesh(new THREE.PlaneGeometry(2.0, 1.6), neonGlowMat);
    ng.position.set(1.0, 2.2, face + 0.005);
    root.add(ng);
    reg.neonGlow = neonGlowMat;
    // the sock wall: packs on hooks, white mostly, some black and grey
    const variants = [["#f4f4f2", "#1c1c1f"], ["#1c1c1f", "#8d8e93"], ["#8d8e93", "#f4f4f2"]];
    const cols = 8, rows = 4;
    const sx0 = 0.22, sy0 = 1.86;
    const hooks = [];
    const packGeo = new THREE.PlaneGeometry(0.11, 0.18);
    const byVariant = variants.map(() => []);
    for (let i = 0; i < cols; i++) {
      for (let j = 0; j < rows; j++) {
        const v = r() < 0.62 ? 0 : r() < 0.6 ? 1 : 2;
        const x = sx0 + i * 0.135, y = sy0 - j * 0.24;
        byVariant[v].push([x, y]);
        hooks.push(boxGeo(0.006, 0.006, 0.08, x, y + 0.085, face + 0.04));
      }
    }
    variants.forEach(([sock, band], v) => {
      const t = sockPackTexture(sock, band);
      const m = new THREE.MeshStandardMaterial({ map: t, transparent: true, alphaTest: 0.4, roughness: 0.85 });
      const im = new THREE.InstancedMesh(packGeo, m, byVariant[v].length);
      const m4 = new THREE.Matrix4();
      byVariant[v].forEach(([x, y], i) => {
        m4.makeTranslation(x, y, face + 0.02 + (i % 3) * 0.004);
        im.setMatrixAt(i, m4);
      });
      root.add(im);
    });
    root.add(merged(hooks, mats.black));
    // trousers on a rail along the partition, under the socks
    const railY = 0.98;
    const rail = new THREE.CylinderGeometry(0.012, 0.012, x1 - x0 - 0.2, 8);
    rail.rotateZ(Math.PI / 2);
    rail.translate((x0 + x1) / 2, railY, face + 0.22);
    const br = [boxGeo(0.02, 0.02, 0.24, x0 + 0.15, railY, face + 0.11), boxGeo(0.02, 0.02, 0.24, x1 - 0.15, railY, face + 0.11)];
    root.add(merged([rail, ...br], mats.black));
    const nT = lite ? 18 : 26;
    for (let k = 0; k < nT; k++) {
      const x = x0 + 0.22 + ((x1 - x0 - 0.44) * k) / (nT - 1);
      coats.push([x, railY - 0.02, face + 0.22, Math.PI / 2 + (r() - 0.5) * 0.15, 0.6 + r() * 0.06, TROUSERS[Math.floor(r() * TROUSERS.length)], "trousers"]);
    }
  }

  // the plant by the door: a tall snake plant in a white pot
  {
    const px = 1.95, pz = -1.75;
    const pot = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.16, 0.46, 24), mats.whiteGloss);
    pot.position.set(px, 0.23, pz);
    root.add(cast(pot));
    const leaves = [];
    for (let i = 0; i < 9; i++) {
      const h = 0.55 + r() * 0.6;
      const c = new THREE.BoxGeometry(0.05, h, 0.012);
      c.translate(0, h / 2, 0);
      c.rotateZ((r() - 0.5) * 0.35);
      c.rotateY(r() * Math.PI);
      c.translate(px + (r() - 0.5) * 0.14, 0.46, pz + (r() - 0.5) * 0.14);
      leaves.push(c);
    }
    root.add(cast(merged(leaves, mats.green)));
    addShadow(root, shadowTex, px, pz, 0.7, 0.7, 0.5);
  }

  /* ---------------------------------------------------- instanced stock */
  {
    const geo = new RoundedBoxGeometry(0.34, 0.042, 0.28, 2, 0.014);
    const im = new THREE.InstancedMesh(geo, mats.fold, stacks.length);
    const m4 = new THREE.Matrix4();
    const q = new THREE.Quaternion();
    const c = new THREE.Color();
    const up = new THREE.Vector3(0, 1, 0);
    stacks.forEach(([x, y, z, ry, color, sc = 1], i) => {
      q.setFromAxisAngle(up, ry);
      const s = sc * (0.96 + r() * 0.07);
      m4.compose(new THREE.Vector3(x, y, z), q, new THREE.Vector3(s, 1, s));
      im.setMatrixAt(i, m4);
      // each piece in a pile a shade off its neighbours: real cloth
      c.set(color || WINTER[Math.floor(r() * WINTER.length)]).multiplyScalar(0.92 + r() * 0.14);
      im.setColorAt(i, c);
    });
    root.add(cast(im));
  }
  {
    const geo = new RoundedBoxGeometry(0.3, 0.044, 0.34, 2, 0.016);
    const im = new THREE.InstancedMesh(geo, mats.jeans, jeans.length);
    const m4 = new THREE.Matrix4();
    const q = new THREE.Quaternion();
    const c = new THREE.Color();
    const up = new THREE.Vector3(0, 1, 0);
    jeans.forEach(([x, y, z, ry, color], i) => {
      q.setFromAxisAngle(up, ry);
      m4.compose(new THREE.Vector3(x, y, z), q, new THREE.Vector3(1, 1, 1));
      im.setMatrixAt(i, m4);
      c.set(color).multiplyScalar(0.93 + r() * 0.12);
      im.setColorAt(i, c);
    });
    root.add(cast(im));
    // the leather patches on the waistbands, and paper price tags
    const pg = new THREE.PlaneGeometry(0.045, 0.024);
    pg.rotateY(Math.PI / 2);
    const pm = new THREE.InstancedMesh(pg, new THREE.MeshStandardMaterial({ color: "#7a4a28", roughness: 0.75 }), patches.length);
    patches.forEach(([x, y, z], i) => { m4.makeTranslation(x, y, z); pm.setMatrixAt(i, m4); });
    root.add(pm);
    const tg = new THREE.PlaneGeometry(0.04, 0.06);
    tg.rotateY(Math.PI / 2);
    const tm = new THREE.InstancedMesh(tg, new THREE.MeshStandardMaterial({ color: "#f6f4ee", roughness: 0.8 }), tags.length);
    tags.forEach(([x, y, z], i) => { m4.makeTranslation(x, y, z); tm.setMatrixAt(i, m4); });
    root.add(tm);
  }
  {
    // hanging garments: jackets, coats and puffers on the racks, hoodies
    // under the cubbies, shirts under the table, the two display jackets,
    // trousers under the socks — each kind its own shape, two cuts of each
    // so neighbours' folds don't line up
    const shapes = {
      jacket: [0, 2.1].map((phase) => topGeometry({ thick: 0.056, sleeve: 0.05, cuff: 0.72, phase })),
      coat: [0.7, 3.1].map((phase) => topGeometry({ thick: 0.05, sleeve: 0.047, cuff: 0.66, phase, width: 0.205 })),
      puffer: [1.3, 4].map((phase) => topGeometry({ thick: 0.085, sleeve: 0.058, cuff: 0.76, quilt: 0.22, phase })),
      hoodie: [0.4, 2.6].map((phase) => topGeometry({ thick: 0.064, sleeve: 0.052, cuff: 0.8, hood: true, phase })),
      shirt: [1.1, 3.5].map((phase) => topGeometry({ thick: 0.028, sleeve: 0.033, cuff: 0.74, phase, width: 0.2 })),
      display: [0.9].map((phase) => topGeometry({ thick: 0.1, sleeve: 0.064, cuff: 0.76, quilt: 0.3, phase })),
      trousers: [0.3, 1.9].map((phase) => trousersGeometry({ phase })),
    };
    const lists = {};
    coats.forEach((c, i) => {
      const cuts = shapes[c[6]];
      const key = `${c[6]}:${i % cuts.length}`;
      (lists[key] = lists[key] || []).push(c);
    });
    const m4 = new THREE.Matrix4();
    const q = new THREE.Quaternion();
    const c = new THREE.Color();
    const hooks = [];
    for (const [key, list] of Object.entries(lists)) {
      const [kind, cut] = key.split(":");
      const im = new THREE.InstancedMesh(shapes[kind][+cut], mats.fabric, list.length);
      list.forEach(([x, y, z, rot, len, color], i) => {
        q.setFromEuler(new THREE.Euler(0, rot, 0));
        m4.compose(new THREE.Vector3(x - (kind === "display" ? 0 : 0.03), y - 0.05, z), q, new THREE.Vector3(1, len, 1));
        im.setMatrixAt(i, m4);
        c.set(color).multiplyScalar(0.94 + r() * 0.1);
        im.setColorAt(i, c);
        // the hanger: a hook over the rail and the bar across the shoulders
        const hk = new THREE.TorusGeometry(0.026, 0.0035, 4, 10, Math.PI * 1.3);
        hk.rotateY(rot);
        hk.translate(x - (kind === "display" ? 0 : 0.03), y + 0.0, z);
        hooks.push(hk);
      });
      root.add(cast(im));
    }
    Object.values(shapes).flat().forEach((g) => {
      if (!Object.keys(lists).some((k) => shapes[k.split(":")[0]][+k.split(":")[1]] === g)) g.dispose();
    });
    root.add(merged(hooks, mats.black));
  }
  {
    const { sole, upper, collar } = sneakerGeometries();
    const soles = new THREE.InstancedMesh(sole, mats.shoeWhite, shoes.length);
    const uppers = new THREE.InstancedMesh(upper, new THREE.MeshStandardMaterial({ color: "#ffffff", roughness: 0.62 }), shoes.length);
    const inner = new THREE.InstancedMesh(collar, mats.matteBlack, shoes.length);
    const m4 = new THREE.Matrix4();
    const q = new THREE.Quaternion();
    const c = new THREE.Color();
    const up = new THREE.Vector3(0, 1, 0);
    shoes.forEach(([x, y, z, ry, color], i) => {
      q.setFromAxisAngle(up, ry);
      // the shoe's heel is its origin: centre it on its spot
      m4.compose(new THREE.Vector3(x, y, z - 0.145), q, new THREE.Vector3(1, 1, 1));
      soles.setMatrixAt(i, m4);
      uppers.setMatrixAt(i, m4);
      inner.setMatrixAt(i, m4);
      uppers.setColorAt(i, c.set(color));
    });
    root.add(cast(soles), cast(uppers), inner);
  }

  root.add(merged(edgeGeos, edgeMat));

  // contact shadows along the walls
  addShadow(root, shadowTex, SHOP.xL + 0.3, -4.7, 0.9, 6.0, 0.4);

  /* ---------------------------------------------------- hang tags */
  // No frames on the walls: each section's pieces hang on paper swing tags
  // in the shop itself (hangtags.js). Where each tag is tied — on a cubby
  // shelf, on a hoodie, on the jackets' rail, on a jeans shelf, on a shoe
  // shelf — and how much string it hangs on: [x, y, z, string]. A few cm
  // proud of the shelf, so a tag can turn on its string without touching.
  reg.tagSpots = {
    // a computer's stops look at each wall side-on, the page's words on one side
    wide: {
      knit: [[-1.84, 1.86, -3.2, 0.05], [-1.84, 2.18, -3.55, 0.05], [-1.84, 1.86, -3.85, 0.05], [-1.84, 2.18, -4.2, 0.05]],
      hoodies: [[-1.66, 1.02, -3.9, 0.06], [-1.66, 1.02, -4.15, 0.06], [-1.66, 1.02, -4.4, 0.06], [-1.66, 1.02, -4.65, 0.06]],
      jackets: [[1.6, 1.98, -5.1, 0.06], [1.6, 1.98, -5.3, 0.06], [1.6, 1.98, -5.5, 0.06], [1.6, 1.98, -5.7, 0.06]],
      pants: [[-1.86, 1.52, -8.3, 0.03], [-1.86, 1.92, -8.7, 0.03], [-1.86, 1.52, -9.05, 0.03], [-1.86, 1.92, -9.45, 0.03]],
      shoes: [[1.92, 1.2, -9.0, 0.03], [1.92, 1.56, -9.35, 0.03], [1.92, 1.2, -9.7, 0.03], [1.92, 1.56, -10.05, 0.03]],
    },
    // a phone's stops look along the walls, the words at the bottom
    tall: {
      knit: [[-1.84, 1.86, -3.8, 0.05], [-1.84, 2.18, -4.35, 0.05], [-1.84, 1.86, -4.85, 0.05], [-1.84, 2.18, -5.4, 0.05]],
      hoodies: [[-1.66, 1.02, -4.45, 0.06], [-1.66, 1.02, -4.8, 0.06], [-1.66, 1.02, -5.15, 0.06], [-1.66, 1.02, -5.5, 0.06]],
      jackets: [[1.6, 1.98, -6.1, 0.06], [1.6, 1.98, -6.45, 0.06], [1.6, 1.98, -6.85, 0.06], [1.6, 1.98, -7.15, 0.06]],
      pants: [[-1.86, 1.52, -9.5, 0.03], [-1.86, 1.92, -9.95, 0.03], [-1.86, 1.52, -10.4, 0.03], [-1.86, 1.92, -10.85, 0.03]],
      shoes: [[1.92, 1.2, -8.9, 0.03], [1.92, 1.56, -9.15, 0.03], [1.92, 1.2, -9.45, 0.03], [1.92, 1.56, -9.7, 0.03]],
    },
  };


  // daylight shadow on the street side of the glass
  root.traverse((o) => {
    if (!o.isMesh) return;
    const wp = new THREE.Vector3();
    o.getWorldPosition(wp);
    if (wp.z > -1.4 && !o.material.transparent && !(o.material.isMeshBasicMaterial)) {
      o.castShadow = true;
      o.receiveShadow = true;
    }
  });
  // and the shop's own: furniture casts, everything solid inside receives
  for (const o of shadowed) {
    o.castShadow = true;
    o.receiveShadow = true;
  }
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
