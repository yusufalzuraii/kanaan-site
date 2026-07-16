/* ============================================================
   KANAAN SHOP — COLOUR PALETTE
   ------------------------------------------------------------
   One source of truth, imported by both the shop (App.jsx) and
   the admin panel (Admin.jsx).

   Rules for editing:
   - NEVER rename or delete an existing key. Products in the
     database refer to these keys; removing one would blank out
     that product's colour.
   - Adding new colours is always safe.
   - `group` decides where the colour appears in the admin picker.
     "basic" colours are shown first, the rest are grouped below.
   ============================================================ */

export const COLOR_GROUPS = [
  { id: "basic", label: "Basics" },
  { id: "neutral", label: "Neutrals & greys" },
  { id: "earth", label: "Earth & browns" },
  { id: "red", label: "Reds & pinks" },
  { id: "orange", label: "Oranges & yellows" },
  { id: "green", label: "Greens" },
  { id: "blue", label: "Blues & teals" },
  { id: "purple", label: "Purples" },
  { id: "special", label: "Prints & multi" },
];

export const COLORS = {
  /* ---------- Basics: the ones used most often ---------- */
  black: { label: "Black", hex: "#141414", group: "basic" },
  white: { label: "White", hex: "#F1EFE9", group: "basic" },
  gray: { label: "Gray", hex: "#9AA0A6", group: "basic" },
  navy: { label: "Navy", hex: "#1F2A44", group: "basic" },
  beige: { label: "Beige", hex: "#E3D6BE", group: "basic" },
  brown: { label: "Brown", hex: "#6B4A2B", group: "basic" },
  red: { label: "Red", hex: "#C6362F", group: "basic" },
  blue: { label: "Blue", hex: "#2F6FE0", group: "basic" },
  green: { label: "Green", hex: "#3F8F5B", group: "basic" },
  coral: { label: "Coral", hex: "#FF4522", group: "basic" },

  /* ---------- Neutrals & greys ---------- */
  charcoal: { label: "Charcoal", hex: "#36393F", group: "neutral" },
  graphite: { label: "Graphite", hex: "#4A4E54", group: "neutral" },
  slate: { label: "Slate", hex: "#6B7280", group: "neutral" },
  silver: { label: "Silver", hex: "#C7CBD1", group: "neutral" },
  lightgray: { label: "Light gray", hex: "#D9DCE0", group: "neutral" },
  offwhite: { label: "Off-white", hex: "#F7F5F0", group: "neutral" },
  ivory: { label: "Ivory", hex: "#F5EFE0", group: "neutral" },
  cream: { label: "Cream", hex: "#EFE7D3", group: "neutral" },

  /* ---------- Earth & browns ---------- */
  oatmeal: { label: "Oatmeal", hex: "#E0D5C3", group: "earth" },
  sand: { label: "Sand", hex: "#D8CBB3", group: "earth" },
  stone: { label: "Stone", hex: "#C2BBAF", group: "earth" },
  taupe: { label: "Taupe", hex: "#B9A99A", group: "earth" },
  khaki: { label: "Khaki", hex: "#B8A98A", group: "earth" },
  tan: { label: "Tan", hex: "#D2A679", group: "earth" },
  camel: { label: "Camel", hex: "#C19A6B", group: "earth" },
  mocha: { label: "Mocha", hex: "#8B6F5C", group: "earth" },
  coffee: { label: "Coffee", hex: "#6F4E37", group: "earth" },
  chocolate: { label: "Chocolate", hex: "#4A2F23", group: "earth" },

  /* ---------- Reds & pinks ---------- */
  crimson: { label: "Crimson", hex: "#A8202B", group: "red" },
  rust: { label: "Rust", hex: "#A6412A", group: "red" },
  terracotta: { label: "Terracotta", hex: "#C05F3C", group: "red" },
  maroon: { label: "Maroon", hex: "#7A2E2E", group: "red" },
  burgundy: { label: "Burgundy", hex: "#5C1F2E", group: "red" },
  wine: { label: "Wine", hex: "#6E2639", group: "red" },
  oxblood: { label: "Oxblood", hex: "#4C1C24", group: "red" },
  salmon: { label: "Salmon", hex: "#F08A72", group: "red" },
  blush: { label: "Blush", hex: "#F2C9C2", group: "red" },
  pink: { label: "Pink", hex: "#E58AA6", group: "red" },
  dustyrose: { label: "Dusty rose", hex: "#C9868A", group: "red" },
  hotpink: { label: "Hot pink", hex: "#E8397E", group: "red" },
  fuchsia: { label: "Fuchsia", hex: "#D62B85", group: "red" },
  magenta: { label: "Magenta", hex: "#C2185B", group: "red" },

  /* ---------- Oranges & yellows ---------- */
  orange: { label: "Orange", hex: "#E8863B", group: "orange" },
  apricot: { label: "Apricot", hex: "#F2A65A", group: "orange" },
  peach: { label: "Peach", hex: "#F7B79A", group: "orange" },
  copper: { label: "Copper", hex: "#B06A3B", group: "orange" },
  amber: { label: "Amber", hex: "#D99A20", group: "orange" },
  mustard: { label: "Mustard", hex: "#C9A227", group: "orange" },
  gold: { label: "Gold", hex: "#C9A64B", group: "orange" },
  yellow: { label: "Yellow", hex: "#E9C63B", group: "orange" },
  lemon: { label: "Lemon", hex: "#EFD84A", group: "orange" },
  butter: { label: "Butter", hex: "#F0E1A0", group: "orange" },

  /* ---------- Greens ---------- */
  olive: { label: "Olive", hex: "#556B2F", group: "green" },
  army: { label: "Army green", hex: "#4B5320", group: "green" },
  forest: { label: "Forest", hex: "#2E4A34", group: "green" },
  emerald: { label: "Emerald", hex: "#1E7A52", group: "green" },
  sage: { label: "Sage", hex: "#A3B18A", group: "green" },
  pistachio: { label: "Pistachio", hex: "#C2D6A0", group: "green" },
  mint: { label: "Mint", hex: "#A8E0C5", group: "green" },
  lime: { label: "Lime", hex: "#A9CF3C", group: "green" },
  chartreuse: { label: "Chartreuse", hex: "#C8E04A", group: "green" },

  /* ---------- Blues & teals ---------- */
  teal: { label: "Teal", hex: "#12B3A0", group: "blue" },
  turquoise: { label: "Turquoise", hex: "#2CC7CB", group: "blue" },
  aqua: { label: "Aqua", hex: "#7FD8DA", group: "blue" },
  petrol: { label: "Petrol", hex: "#1F5F6B", group: "blue" },
  sky: { label: "Sky", hex: "#7FB2F0", group: "blue" },
  babyblue: { label: "Baby blue", hex: "#B9D6F2", group: "blue" },
  denim: { label: "Denim", hex: "#4A6FA5", group: "blue" },
  cobalt: { label: "Cobalt", hex: "#1B4FD8", group: "blue" },
  royal: { label: "Royal blue", hex: "#2A46C0", group: "blue" },
  indigo: { label: "Indigo", hex: "#2A3A66", group: "blue" },
  midnight: { label: "Midnight", hex: "#141B2E", group: "blue" },

  /* ---------- Purples ---------- */
  lavender: { label: "Lavender", hex: "#C3B2E0", group: "purple" },
  lilac: { label: "Lilac", hex: "#C9A6D9", group: "purple" },
  mauve: { label: "Mauve", hex: "#A87CA0", group: "purple" },
  violet: { label: "Violet", hex: "#7C4DBE", group: "purple" },
  purple: { label: "Purple", hex: "#6E5BFF", group: "purple" },
  plum: { label: "Plum", hex: "#5E2A52", group: "purple" },
  aubergine: { label: "Aubergine", hex: "#3D2233", group: "purple" },

  /* ---------- Prints & multi ---------- */
  multicolor: {
    label: "Multicolour",
    hex: "#8A8A8A",
    group: "special",
    swatch: "conic-gradient(from 210deg, #FF4522, #E9C63B, #3F8F5B, #2F6FE0, #6E5BFF, #FF4522)",
  },
  striped: {
    label: "Striped",
    hex: "#5A5A5A",
    group: "special",
    swatch: "repeating-linear-gradient(45deg, #2A2A2A 0 5px, #F1EFE9 5px 10px)",
  },
  printed: {
    label: "Printed",
    hex: "#7A7A7A",
    group: "special",
    swatch: "radial-gradient(circle at 30% 30%, #F1EFE9 2px, transparent 3px), radial-gradient(circle at 70% 70%, #F1EFE9 2px, transparent 3px), #3A3A3A",
  },
};

export const COLOR_KEYS = Object.keys(COLORS);

// What to paint a swatch with: a plain colour, or a pattern for
// multicolour / striped / printed.
export function swatchBackground(key) {
  const c = COLORS[key];
  if (!c) return "#888";
  return c.swatch || c.hex;
}

export function colorLabel(key) {
  return COLORS[key]?.label || key;
}

// Colours grouped for the admin picker, basics first.
export function groupedColors() {
  return COLOR_GROUPS.map((g) => ({
    ...g,
    keys: COLOR_KEYS.filter((k) => COLORS[k].group === g.id),
  })).filter((g) => g.keys.length > 0);
}
