import React, {
  createContext,
  useContext,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  ShoppingBag,
  ShoppingCart,
  X,
  Plus,
  Minus,
  Menu,
  MapPin,
  Truck,
  RotateCcw,
  ShieldCheck,
  MessageCircle,
  Shirt,
  Footprints,
  Check,
  AtSign,
  Sun,
  Moon,
  Sparkles,
  BadgeCheck,
  Heart,
  Share2,
  Link2,
  Smartphone,
  Search,
  ChevronDown,
  Tag,
  ArrowRight,
  ArrowLeft,
  Bell,
  Flame,
  Home as HomeIcon,
} from "lucide-react";
import Admin from "./Admin.jsx";
import { COLORS as PALETTE, swatchBackground } from "./palette.js";
import {
  isNativeApp,
  hapticLight,
  hapticSuccess,
  registerBackButtonHandler,
  syncStatusBar,
  hideSplashScreen,
  nativeShare,
  saveCheckoutInfo,
  loadCheckoutInfo,
  registerPushNotifications,
  addRecentlyViewed,
  getRecentlyViewed,
  registerEdgeSwipeBack,
  playSuccessChime,
  updateAppBadge,
  hasSeenWelcome,
  markWelcomeSeen,
  playTapChime,
  registerNetworkListener,
  subscribeToRestock,
} from "./native.js";

/* ============================================================
   SETTINGS — edit before publishing
   ============================================================ */
const WHATSAPP_NUMBER = "96181445681"; // shop's order number, intl format, no + or leading 0
const STORE_NAME = "Kanaan Shop";
const SITE_URL = "https://kanaanshop.com"; // update once the real domain is connected

/* بالتطبيق (Capacitor)، المحتوى بيتحمّل من عنوان داخلي وهمي
   (https://localhost)، مش من kanaanshop.com — فمسارات نسبية زي
   "/api/products" أو "/img/..." ما بتلاقي وجهتها الحقيقية. بالموقع
   العادي apiBase فاضي وكل شي بيضل يشتغل زي ما كان (نسبي لنفس النطاق).
   بالتطبيق بس، منحط الدومين الحقيقي قبل أي مسار يبلش بـ "/". */
const apiBase = isNativeApp ? SITE_URL : "";
const DELIVERY_FEE = 5;
const INSTAGRAM_URL = "https://www.instagram.com/kanaan.shop";
const INSTAGRAM_HANDLE = "@kanaan.shop";
// Real logo files live in /public/logo-compact.png and /public/logo-full.png.

/* ============================================================
   PRODUCT DATA
   ============================================================ */
/* Ordered deliberately: tops, bottoms, sets & underwear, footwear,
   then accessories and the Old Money edit. Keep in sync with
   CATEGORY_IDS in functions/_shared/util.js. */
const FALLBACK_CATEGORIES = [
  { id: "tshirts", label: "T-Shirts" },
  { id: "shirts", label: "Shirts" },
  { id: "jeans", label: "Jeans" },
  { id: "pants", label: "Pants" },
  { id: "shorts", label: "Shorts" },
  { id: "sets", label: "Sets" },
  { id: "underwear", label: "Underwear" },
  { id: "shoes", label: "Shoes" },
  { id: "slippers", label: "Slippers" },
  { id: "accessories", label: "Accessories" },
  { id: "oldmoney", label: "Old Money Collection" },
];

/* Fits. Only these two categories are split; the rest have none. */
const SUBCATEGORIES = {
  tshirts: [
    { id: "oversized", label: "Oversized" },
    { id: "regular", label: "Regular fit" },
  ],
  jeans: [
    { id: "baggy", label: "Baggy" },
    { id: "regular", label: "Regular" },
  ],
};
const subsFor = (cat) => SUBCATEGORIES[cat] || [];
const subLabel = (cat, sub) => subsFor(cat).find((s) => s.id === sub)?.label || sub;

// The full palette lives in src/palette.js so the shop and the admin
// panel can never drift apart.
const FALLBACK_COLORS = PALETTE;

function slugify(str) {
  return str
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}


/* Colors and categories are fixed sets (used by the shop and the admin form).
   Products themselves come live from the database via /api/products. */
const CATEGORIES = FALLBACK_CATEGORIES;

// ترتيب مخصص لشبكة "Browse" بالتطبيق: القطع الأكتر تصفّحاً أول (صف
// أول)، والباقي بصف تاني — و"Old Money Collection" مستثناة عمداً
// لأنها كولكشن منسّق إلها بطاقة خاصة، مش فئة عادية بالشبكة. هيك
// الشبكة بتضل 10 عناصر بالضبط = 5 أعمدة × صفّين متوازنين تماماً.
const BROWSE_GRID_CATEGORIES = [
  "tshirts", "shirts", "jeans", "pants", "shorts",
  "sets", "shoes", "slippers", "underwear", "accessories",
]
  .map((id) => CATEGORIES.find((c) => c.id === id))
  .filter(Boolean);
const COLORS = FALLBACK_COLORS;

const LEBANON_GOVERNORATES = [
  "Beirut",
  "Mount Lebanon",
  "North Lebanon",
  "Akkar",
  "Beqaa",
  "Baalbek-Hermel",
  "South Lebanon",
  "Nabatieh",
  "Keserwan-Jbeil",
];

/* ============================================================
   THEME CONTEXT
   ============================================================ */
const AppContext = createContext(null);
const useApp = () => useContext(AppContext);

// Live product catalog (loaded from the database via /api/products).
const ProductsContext = createContext([]);
const useProducts = () => useContext(ProductsContext);

function AppProvider({ children }) {
  const [theme, setTheme] = useState("light");
  const [reducedMotion, setReducedMotion] = useState(false);

  useEffect(() => {
    try {
      const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
      setReducedMotion(mq.matches);
      const handler = (e) => setReducedMotion(e.matches);
      mq.addEventListener?.("change", handler);
      return () => mq.removeEventListener?.("change", handler);
    } catch (e) {
      /* ignore */
    }
  }, []);

  // Keep the browser's own chrome (status bar / address bar tint on
  // Android) matching whichever theme the person picked, instead of
  // leaving it on the light default from index.html.
  useEffect(() => {
    try {
      const meta = document.querySelector('meta[name="theme-color"]');
      if (meta) meta.setAttribute("content", theme === "dark" ? "#0B0B0E" : "#F2F2F4");
    } catch (e) {
      /* ignore */
    }
  }, [theme]);

  return <AppContext.Provider value={{ theme, setTheme, reducedMotion }}>{children}</AppContext.Provider>;
}

/* ============================================================
   TINY ROUTER — gives every category and product a real,
   shareable, indexable URL without adding a router dependency
   ============================================================ */
function useRouter() {
  const [path, setPath] = useState(() => {
    try {
      return window.location.pathname || "/";
    } catch (e) {
      return "/";
    }
  });
  // اتجاه آخر تنقّل — 'forward' لما نفتح صفحة جديدة، 'back' لما نرجع.
  // بيستخدمه مكوّن الانتقال بين الصفحات ليقرر اتجاه الحركة (يمين/يسار).
  const [direction, setDirection] = useState("none");

  useEffect(() => {
    // نعطي أول صفحة "عمق = 0" — هيك منقدر نميّز "القاعدة" (الصفحة
    // الأولى يلي فتح عليها التطبيق) عن أي صفحة توصلها عبر navigate().
    // هاد بالضبط الأساس يلي زر الرجوع الفيزيائي بأندرويد بيعتمد عليه
    // ليقرر "ارجع جوا التطبيق" أو "اطلع من التطبيق".
    if (!window.history.state || typeof window.history.state.depth !== "number") {
      try { window.history.replaceState({ depth: 0 }, "", window.location.pathname); } catch (e) { /* ignore */ }
    }

    const onPop = () => {
      setDirection("back");
      setPath(window.location.pathname || "/");
    };
    window.addEventListener("popstate", onPop);
    return () => window.removeEventListener("popstate", onPop);
  }, []);

  const navigate = (to) => {
    const depth = (window.history.state?.depth || 0) + 1;
    try {
      window.history.pushState({ depth }, "", to);
    } catch (e) {
      /* ignore */
    }
    setDirection("forward");
    setPath(to);
    // Jump, don't glide: smooth-scrolling from deep down a long catalog
    // took a visible moment and left people mid-page on the new one.
    window.scrollTo(0, 0);
  };

  // true إذا فيه صفحات فوق بالتاريخ نقدر نرجعلها جوا التطبيق نفسو —
  // false يعني إحنا بالصفحة الأولى، وزر الرجوع لازم يطلع من التطبيق.
  const canGoBack = () => (window.history.state?.depth || 0) > 0;

  return [path, navigate, direction, canGoBack];
}

function parseRoute(path) {
  if (path === "/") return { type: "home" };
  if (path.startsWith("/admin")) return { type: "admin" };
  if (path === "/sale") return { type: "sale" };
  if (path === "/favorites") return { type: "favorites" };
  if (path === "/exclusives") return { type: "exclusives" };
  if (path === "/privacy") return { type: "privacy" };
  if (path === "/shop") return { type: "catalog", category: "all", sub: null };
  if (path.startsWith("/shop/")) {
    const [category, sub] = path.slice(6).split("/").filter(Boolean);
    return { type: "catalog", category: category || "all", sub: sub || null };
  }
  if (path.startsWith("/product/")) return { type: "product", slug: path.slice(9) };
  if (path === "/checkout") return { type: "checkout" };
  return { type: "home" };
}

/* ============================================================
   HELPERS
   ============================================================ */
const money = (n) => `$${n.toFixed(0)}`;
const effectivePrice = (p) => (p.discount > 0 ? Math.round(p.price * (1 - p.discount / 100)) : p.price);

function useReveal() {
  const ref = useRef(null);
  const [visible, setVisible] = useState(false);
  const { reducedMotion } = useApp();

  useEffect(() => {
    if (reducedMotion) {
      setVisible(true);
      return;
    }
    const el = ref.current;
    if (!el) return;
    const obs = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setVisible(true);
          obs.disconnect();
        }
      },
      // Start revealing ~450px before the element enters view, so by the time
      // the user scrolls to it it's already there — no pop-in lag.
      { threshold: 0, rootMargin: "0px 0px 450px 0px" }
    );
    obs.observe(el);
    return () => obs.disconnect();
  }, [reducedMotion]);

  return [ref, visible];
}

function Reveal({ children, delay = 0, className = "" }) {
  const [ref, visible] = useReveal();
  return (
    <div
      ref={ref}
      className={className}
      style={{
        opacity: visible ? 1 : 0,
        transform: visible ? "translateY(0)" : "translateY(14px)",
        transition: `opacity 0.5s ease ${delay}ms, transform 0.5s cubic-bezier(0.16,1,0.3,1) ${delay}ms`,
      }}
    >
      {children}
    </div>
  );
}

function Magnetic({ children, strength = 16, className = "" }) {
  const ref = useRef(null);
  const { reducedMotion } = useApp();
  const [pos, setPos] = useState({ x: 0, y: 0 });

  const onMove = (e) => {
    if (reducedMotion || !ref.current) return;
    const rect = ref.current.getBoundingClientRect();
    const relX = (e.clientX - rect.left - rect.width / 2) / rect.width;
    const relY = (e.clientY - rect.top - rect.height / 2) / rect.height;
    setPos({ x: relX * strength, y: relY * strength });
  };
  const onLeave = () => setPos({ x: 0, y: 0 });

  return (
    <div
      ref={ref}
      onMouseMove={onMove}
      onMouseLeave={onLeave}
      className={className}
      style={{
        transform: `translate(${pos.x}px, ${pos.y}px)`,
        transition: pos.x === 0 && pos.y === 0 ? "transform 0.5s cubic-bezier(0.16,1,0.3,1)" : "transform 0.1s linear",
        display: "inline-block",
      }}
    >
      {children}
    </div>
  );
}

/* ============================================================
   MESH BACKGROUND — animated only in dark mode; calm and
   static in light mode, per the brief
   ============================================================ */
function MeshBackground({ variant = "hero" }) {
  const { reducedMotion, theme } = useApp();
  const animate = theme === "dark" && !reducedMotion;
  const baseOpacity = theme === "dark" ? 0.35 : 0.16;

  const blobs =
    variant === "hero"
      ? [
          { color: "#FF4522", top: "-10%", left: "5%", size: 420, delay: "0s", dur: "22s" },
          { color: "#12B3A0", top: "10%", left: "60%", size: 380, delay: "-6s", dur: "26s" },
          { color: "#6E5BFF", top: "55%", left: "20%", size: 340, delay: "-12s", dur: "30s" },
        ]
      : [
          { color: "#FF4522", top: "10%", left: "70%", size: 260, delay: "0s", dur: "24s" },
          { color: "#12B3A0", top: "60%", left: "10%", size: 220, delay: "-9s", dur: "28s" },
        ];
  return (
    <div className="absolute inset-0 overflow-hidden pointer-events-none" aria-hidden="true" style={{ contain: "paint" }}>
      {blobs.map((b, i) => (
        <span
          key={i}
          className={animate ? "mesh-blob" : ""}
          style={{
            position: "absolute",
            top: b.top,
            left: b.left,
            width: b.size,
            height: b.size,
            background: b.color,
            borderRadius: "50%",
            filter: "blur(60px)",
            opacity: baseOpacity,
            animationDuration: b.dur,
            animationDelay: b.delay,
            // Promote each blob to its own GPU layer so its blur is rendered
            // once and cached — scrolling just moves the texture (smooth on mobile).
            willChange: "transform",
            transform: "translateZ(0)",
            backfaceVisibility: "hidden",
          }}
        />
      ))}
      <div className="grain-overlay" />
    </div>
  );
}

/* ============================================================
   GLASS CHIP
   ============================================================ */
function GlassChip({ children, tone = "default", className = "" }) {
  const toneColor = tone === "coral" ? "var(--coral)" : tone === "teal" ? "var(--teal)" : "var(--fg)";
  return (
    <span
      className={`glass inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-num ${className}`}
      style={{ color: toneColor, letterSpacing: "0.03em" }}
    >
      <span style={{ width: 5, height: 5, borderRadius: "50%", background: toneColor, display: "inline-block" }} />
      {children}
    </span>
  );
}

/* ============================================================
   SEGMENTED TOGGLE — light/dark
   ============================================================ */
function SegmentedToggle() {
  const { theme, setTheme } = useApp();
  const isDark = theme === "dark";
  return (
    <div className="glass relative flex items-center rounded-full p-1" style={{ width: 64, height: 34 }}>
      <span
        className="absolute rounded-full"
        style={{
          width: 26,
          height: 26,
          top: 4,
          left: isDark ? 34 : 4,
          background: "var(--fg)",
          transition: "left 0.35s cubic-bezier(0.2,0.9,0.2,1)",
          boxShadow: "0 2px 8px rgba(0,0,0,0.25)",
        }}
      />
      <button onClick={() => setTheme("light")} className="relative z-10 flex-1 flex items-center justify-center tap-scale" aria-label="Light mode" style={{ color: !isDark ? "var(--bg)" : "var(--fg-muted)" }}>
        <Sun className="w-3.5 h-3.5" />
      </button>
      <button onClick={() => setTheme("dark")} className="relative z-10 flex-1 flex items-center justify-center tap-scale" aria-label="Dark mode" style={{ color: isDark ? "var(--bg)" : "var(--fg-muted)" }}>
        <Moon className="w-3.5 h-3.5" />
      </button>
    </div>
  );
}

/* Placeholder icons shown when a product has no photo yet.
   Lucide has no trousers/underwear glyphs, so those two are drawn
   here by hand in the same 24px stroked line style. */
function IconFor({ type, className, style }) {
  const stroke = {
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: 1.6,
    strokeLinecap: "round",
    strokeLinejoin: "round",
  };
  if (type === "shoe") return <Footprints className={className} style={style} />;
  if (type === "pants") {
    return (
      <svg className={className} style={style} {...stroke} xmlns="http://www.w3.org/2000/svg">
        <path d="M6.5 3h11l1 18h-4.5L12 10l-2 11H5.5z" />
        <path d="M6.5 6.5h11" />
      </svg>
    );
  }
  if (type === "underwear") {
    return (
      <svg className={className} style={style} {...stroke} xmlns="http://www.w3.org/2000/svg">
        <path d="M4 8h16v2.5c0 4-3.4 5.5-5.2 8.5h-1.4C12 15 12 15 12 15s0 0-1.4 4H9.2C7.4 16 4 14.5 4 10.5z" />
        <path d="M4 8h16" />
      </svg>
    );
  }
  if (type === "accessory") {
    return (
      <svg className={className} style={style} {...stroke} xmlns="http://www.w3.org/2000/svg">
        <path d="M3.5 16.5c0-4.7 3.8-8.5 8.5-8.5s8.5 3.8 8.5 8.5" />
        <path d="M2 16.5h16.5a2.5 2.5 0 0 1 0 5H4a2 2 0 0 1-2-2z" />
        <path d="M12 8V5.5" />
      </svg>
    );
  }
  if (type === "shirt-button") {
    return (
      <svg className={className} style={style} {...stroke} xmlns="http://www.w3.org/2000/svg">
        <path d="M8.5 2 12 5.5 15.5 2l4.9 1.6a2 2 0 0 1 1.3 2.2l-.6 3.4a1 1 0 0 1-1 .8H18v10a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2V10H3.9a1 1 0 0 1-1-.8l-.6-3.4a2 2 0 0 1 1.3-2.2z" />
        <path d="M12 8v13" />
      </svg>
    );
  }
  return <Shirt className={className} style={style} />;
}

// Keep in sync with iconForCategory() in functions/_shared/util.js
function iconForCategory(category) {
  if (category === "shoes" || category === "slippers") return "shoe";
  if (category === "shirts" || category === "oldmoney") return "shirt-button";
  if (category === "underwear") return "underwear";
  if (category === "accessories") return "accessory";
  if (category === "jeans" || category === "pants" || category === "shorts") return "pants";
  return "shirt";
}

/* ============================================================
   LOGO MARK — the real Kanaan Shop wordmark. "compact" (just
   the KANAAN + SHOP lockup) is used in tight nav spaces, "full"
   (includes the MEN'S FASHION WEAR line) where there's more
   room to breathe, like the footer. The PNG is monochrome, so
   dark mode flips it with a CSS filter instead of needing a
   second asset.
   ============================================================ */
function LogoMark({ variant = "compact", className = "" }) {
  const [ok, setOk] = useState(true);
  const src = variant === "full" ? "/logo-full.png" : "/logo-compact.png";

  if (!ok) {
    return (
      <span className="rounded-xl flex items-center justify-center font-display font-bold w-8 h-8" style={{ background: "linear-gradient(135deg, var(--coral), #ff7a52)", color: "#141414" }}>
        K
      </span>
    );
  }

  return (
    <img
      src={src}
      alt={STORE_NAME}
      className={className}
      style={{ objectFit: "contain", filter: "var(--logo-filter)" }}
      onError={() => setOk(false)}
    />
  );
}

/* ============================================================
   LIKE BUTTON — small glass heart, reusable on cards + detail
   ============================================================ */
function LikeButton({ liked, onToggle, size = "sm" }) {
  const dim = size === "lg" ? 40 : 32;
  return (
    <button
      onClick={(e) => {
        e.stopPropagation();
        onToggle();
      }}
      className="glass rounded-full flex items-center justify-center tap-scale"
      style={{ width: dim, height: dim }}
      aria-label={liked ? "Remove from favorites" : "Add to favorites"}
    >
      <Heart className={size === "lg" ? "w-5 h-5" : "w-4 h-4"} fill={liked ? "var(--coral)" : "none"} style={{ color: liked ? "var(--coral)" : "var(--fg-muted)" }} />
    </button>
  );
}

/* ============================================================
   SWATCH ART
   ============================================================ */
function productImageSrc(image) {
  if (!image) return null;
  const v = String(image).trim();
  if (!v) return null;
  // Full URL, or an absolute path like /img/... (served from R2), is used as-is.
  if (/^https?:\/\//i.test(v)) return v;
  if (v.startsWith("/")) return `${apiBase}${v}`;
  return `${apiBase}/products/${v.replace(/^\/+/, "")}`;
}

// A product's photos, normalized to a clean array of usable image URLs.
// Accepts an array, or a single comma-separated string (from the sheet).
/* A product's photos, normalized to [{ url, color }].
   Accepts the new color-tagged format, a plain array, or a legacy
   comma-separated string — so old and new products both work. */
function getImageList(product) {
  const raw = product.images != null ? product.images : product.image;
  let list = [];
  if (Array.isArray(raw)) list = raw;
  else if (typeof raw === "string") list = raw.split(",");
  return list
    .map((x) => (typeof x === "string" ? { url: productImageSrc(x), color: null } : { url: productImageSrc(x.url), color: x.color || null }))
    .filter((x) => x.url);
}

// Photos for a specific color. If none are tagged with that color, fall back
// to the untagged ones (or all of them) so the gallery is never empty.
function getImagesForColor(product, colorKey) {
  const all = getImageList(product);
  if (!colorKey || all.length === 0) return all;
  const matching = all.filter((x) => x.color === colorKey);
  if (matching.length > 0) return matching;
  const untagged = all.filter((x) => !x.color);
  return untagged.length > 0 ? untagged : all;
}

function getImages(product) {
  return getImageList(product).map((x) => x.url);
}

/* ---------- stock helpers ----------
   product.tracked is true only when the owner entered quantities.
   Untracked products behave exactly as before: always available. */
function stockFor(product, colorKey, size) {
  if (!product || !product.tracked || !product.stock) return Infinity;
  return product.stock[`${colorKey}|${size}`] || 0;
}
function colorHasStock(product, colorKey) {
  if (!product || !product.tracked || !product.stock) return true;
  return product.sizes.some((s) => stockFor(product, colorKey, s) > 0);
}
function productHasStock(product) {
  if (!product || !product.tracked || !product.stock) return true;
  return product.colors.some((c) => colorHasStock(product, c));
}

function SoldOutBadge() {
  return (
    <div className="absolute inset-0 flex items-center justify-center" aria-hidden="true">
      <span
        className="rounded-full px-4 py-1.5 font-num text-sm"
        style={{ background: "rgba(18,18,24,0.82)", color: "#fff", letterSpacing: "0.05em", backdropFilter: "blur(2px)" }}
      >
        Sold out
      </span>
    </div>
  );
}

function SwatchPanel({ product, big, liked, onToggleLike, forceSoldOut }) {
  const c1 = COLORS[product.colors[0]]?.hex || "#141414";
  const c2 = COLORS[product.colors[1]]?.hex || c1;
  const [imgOk, setImgOk] = useState(true);
  const imgSrc = imgOk ? getImages(product)[0] || null : null;
  return (
    <div
      className="relative w-full flex items-center justify-center overflow-hidden"
      style={{
        aspectRatio: "4/5",
        borderRadius: big ? "28px" : "20px",
        background: `radial-gradient(120% 120% at 15% 15%, ${c1} 0%, transparent 55%), radial-gradient(120% 120% at 85% 85%, ${c2} 0%, transparent 55%), #1A1A1E`,
      }}
    >
      {imgSrc ? (
        <img
          src={imgSrc}
          alt={product.name}
          loading="lazy"
          className="absolute inset-0 w-full h-full"
          style={{ objectFit: "cover" }}
          onError={() => setImgOk(false)}
        />
      ) : (
        <>
          <div className="grain-overlay" style={{ opacity: 0.05 }} />
          <IconFor type={product.icon || iconForCategory(product.category)} className={big ? "w-24 h-24" : "w-12 h-12"} style={{ color: "rgba(255,255,255,0.5)" }} />
        </>
      )}
      {product.badge && (
        <div className="absolute top-3 right-3">
          <GlassChip tone={product.badge === "sale" ? "coral" : "teal"}>
            {product.badge === "sale" ? `−${product.discount}%` : "New"}
          </GlassChip>
        </div>
      )}
      {(forceSoldOut || product.soldOut) && <SoldOutBadge />}
      {onToggleLike && (
        <div className="absolute top-3 left-3">
          <LikeButton liked={liked} onToggle={onToggleLike} />
        </div>
      )}
    </div>
  );
}

/* ============================================================
   PRODUCT GALLERY — main image + thumbnails (product page).
   Falls back to the mesh art when a product has no photos, so
   the look is identical to before for image-less products.
   ============================================================ */
function ProductGallery({ product, liked, onToggleLike, activeColor }) {
  // Memoised: without this the list was rebuilt on every render, which
  // remounted the <img> and made colour switching feel sluggish.
  const images = useMemo(
    () => getImagesForColor(product, activeColor).map((x) => x.url),
    [product, activeColor]
  );
  const allUrls = useMemo(() => getImageList(product).map((x) => x.url), [product]);

  // Warm the browser cache with every photo of this product as soon as the
  // page opens, so tapping a colour swaps instantly instead of waiting on
  // a fresh download.
  useEffect(() => {
    const imgs = allUrls.map((url) => {
      const im = new Image();
      im.src = url;
      return im;
    });
    return () => imgs.forEach((im) => { im.src = ""; });
  }, [allUrls]);

  const c1 = COLORS[activeColor]?.hex || COLORS[product.colors[0]]?.hex || "#141414";
  const c2 = COLORS[product.colors[1]]?.hex || c1;
  const [active, setActive] = useState(0);
  const [broken, setBroken] = useState({});
  const touchX = useRef(null);

  // Back to the first photo whenever the product or the chosen colour changes.
  useEffect(() => {
    setActive(0);
  }, [product.id, activeColor]);

  const idx = Math.min(active, Math.max(0, images.length - 1));
  const activeSrc = images[idx] && !broken[images[idx]] ? images[idx] : null;
  const go = (dir) => {
    if (images.length < 2) return;
    setActive((i) => (i + dir + images.length) % images.length);
  };

  return (
    <div className="min-w-0 w-full">
      <div
        className="relative w-full flex items-center justify-center overflow-hidden"
        onTouchStart={(e) => { touchX.current = e.touches[0].clientX; }}
        onTouchEnd={(e) => {
          if (touchX.current == null) return;
          const dx = e.changedTouches[0].clientX - touchX.current;
          if (Math.abs(dx) > 40) go(dx < 0 ? 1 : -1);
          touchX.current = null;
        }}
        style={{
          aspectRatio: "4/5",
          borderRadius: "28px",
          background: `radial-gradient(120% 120% at 15% 15%, ${c1} 0%, transparent 55%), radial-gradient(120% 120% at 85% 85%, ${c2} 0%, transparent 55%), #1A1A1E`,
        }}
      >
        {activeSrc ? (
          <img
            key={activeSrc}
            src={activeSrc}
            alt={product.name}
            className="absolute inset-0 w-full h-full"
            style={{ objectFit: "cover" }}
            onError={() => setBroken((b) => ({ ...b, [activeSrc]: true }))}
          />
        ) : (
          <>
            <div className="grain-overlay" style={{ opacity: 0.05 }} />
            <IconFor type={product.icon || iconForCategory(product.category)} className="w-24 h-24" style={{ color: "rgba(255,255,255,0.5)" }} />
          </>
        )}
        {product.badge && (
          <div className="absolute top-3 right-3">
            <GlassChip tone={product.badge === "sale" ? "coral" : "teal"}>
              {product.badge === "sale" ? `−${product.discount}%` : "New"}
            </GlassChip>
          </div>
        )}
        {(product.soldOut || !productHasStock(product)) && <SoldOutBadge />}
        <div className="absolute top-3 left-3">
          <LikeButton liked={liked} onToggle={onToggleLike} size="lg" />
        </div>
      </div>

      {images.length > 1 && (
        <div className="flex gap-2 mt-3 overflow-x-auto pb-1 max-w-full" style={{ WebkitOverflowScrolling: "touch" }}>
          {images.map((src, i) =>
            broken[src] ? null : (
              <button
                key={src}
                onClick={() => setActive(i)}
                className="relative flex-shrink-0 rounded-xl overflow-hidden tap-scale"
                style={{ width: 64, height: 80, border: idx === i ? "2px solid var(--coral)" : "1px solid var(--border)" }}
                aria-label={`Photo ${i + 1}`}
              >
                <img
                  src={src}
                  alt=""
                  className="w-full h-full"
                  style={{ objectFit: "cover" }}
                  onError={() => setBroken((b) => ({ ...b, [src]: true }))}
                />
              </button>
            )
          )}
        </div>
      )}
    </div>
  );
}

/* ============================================================
   PRODUCT CARD
   ============================================================ */
function ProductCard({ product, onOpen, liked, onToggleLike }) {
  const isOut = product.soldOut || !productHasStock(product);
  return (
    <button onClick={() => onOpen(product)} className="text-left group focus:outline-none w-full">
      <div
        className="transition-transform duration-500 group-hover:-translate-y-2"
        style={{ transitionTimingFunction: "cubic-bezier(0.16,1,0.3,1)", opacity: isOut ? 0.7 : 1 }}
      >
        <SwatchPanel product={product} liked={liked} onToggleLike={onToggleLike} forceSoldOut={isOut} />
      </div>
      <div className="mt-3.5 space-y-1">
        <p className="font-body font-medium text-fg text-sm">{product.name}</p>
        <div className="flex items-center gap-2">
          {isOut ? (
            <span className="font-num text-muted text-base">Sold out</span>
          ) : product.discount > 0 ? (
            <>
              <span className="font-num text-coral text-base">{money(effectivePrice(product))}</span>
              <span className="font-num text-muted text-xs line-through">{money(product.price)}</span>
            </>
          ) : (
            <span className="font-num text-fg text-base">{money(product.price)}</span>
          )}
        </div>
        <div className="flex items-center gap-1 pt-1">
          {product.colors.map((key) => (
            <span key={key} className="w-3 h-3 rounded-full border" style={{ background: swatchBackground(key), borderColor: "var(--border)" }} />
          ))}
        </div>
      </div>
    </button>
  );
}

/* ============================================================
   SEARCH OVERLAY
   ------------------------------------------------------------
   Opens from the header (or ⌘K / Ctrl-K). Filters as you type across
   product names, categories and colours, and shows real thumbnails so
   you recognise the piece before you click. Arrow keys + Enter work
   on desktop; it's a full-height sheet on a phone.
   ============================================================ */
function scoreProduct(product, q) {
  const name = product.name.toLowerCase();
  if (name === q) return 100;
  if (name.startsWith(q)) return 80;
  if (name.includes(q)) return 60;

  const category = (CATEGORIES.find((c) => c.id === product.category)?.label || "").toLowerCase();
  if (category.includes(q)) return 40;

  const colorNames = product.colors.map((k) => (COLORS[k]?.label || k).toLowerCase());
  if (colorNames.some((c) => c.includes(q))) return 30;

  // last resort: match against the description
  if ((product.desc || "").toLowerCase().includes(q)) return 10;
  return 0;
}

function SearchOverlay({ open, onClose, products, openProduct, goCatalog, goSale }) {
  const [q, setQ] = useState("");
  const [cursor, setCursor] = useState(0);
  const inputRef = useRef(null);

  useEffect(() => {
    if (open) {
      setQ("");
      setCursor(0);
      // let the sheet mount before focusing, or mobile keyboards misfire
      const t = setTimeout(() => inputRef.current?.focus(), 60);
      return () => clearTimeout(t);
    }
  }, [open]);

  // Don't let the page scroll behind the sheet.
  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = prev; };
  }, [open]);

  const query = q.trim().toLowerCase();
  const results = useMemo(() => {
    if (!query) return [];
    return products
      .map((p) => ({ p, score: scoreProduct(p, query) }))
      .filter((x) => x.score > 0)
      .sort((a, b) => b.score - a.score)
      .slice(0, 8)
      .map((x) => x.p);
  }, [query, products]);

  useEffect(() => setCursor(0), [query]);

  if (!open) return null;

  const pick = (p) => {
    onClose();
    openProduct(p);
  };

  const onKeyDown = (e) => {
    if (e.key === "Escape") { onClose(); return; }
    if (results.length === 0) return;
    if (e.key === "ArrowDown") { e.preventDefault(); setCursor((c) => (c + 1) % results.length); }
    if (e.key === "ArrowUp") { e.preventDefault(); setCursor((c) => (c - 1 + results.length) % results.length); }
    if (e.key === "Enter") { e.preventDefault(); pick(results[cursor]); }
  };

  return (
    <div className="fixed inset-0 z-50 search-fade" onClick={onClose}>
      <div className="absolute inset-0" style={{ background: "rgba(8,8,12,0.55)", backdropFilter: "blur(6px)", WebkitBackdropFilter: "blur(6px)" }} />
      <div
        className="relative mx-auto px-4 search-rise"
        style={{ maxWidth: 560, paddingTop: "12vh" }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="glass glass-sheen rounded-3xl overflow-hidden" style={{ boxShadow: "0 24px 60px rgba(0,0,0,0.35)" }}>
          <div className="flex items-center gap-3 px-4" style={{ height: 58 }}>
            <Search className="w-5 h-5 text-muted flex-shrink-0" />
            <input
              ref={inputRef}
              value={q}
              onChange={(e) => setQ(e.target.value)}
              onKeyDown={onKeyDown}
              placeholder="Search for a piece, a colour, a category…"
              className="flex-1 bg-transparent border-0 font-body outline-none"
              style={{ fontSize: 16, color: "var(--fg)" }}
            />
            <button onClick={onClose} className="p-1.5 rounded-full tap-scale text-muted hover:text-coral flex-shrink-0" aria-label="Close search">
              <X className="w-4 h-4" />
            </button>
          </div>

          {query && (
            <div style={{ borderTop: "1px solid var(--glass-border)", maxHeight: "56vh", overflowY: "auto" }}>
              {results.length === 0 ? (
                <div className="px-4 py-8 text-center">
                  <p className="font-body text-sm text-muted mb-3">Nothing matched “{q}”.</p>
                  <button
                    onClick={() => { onClose(); goCatalog("all"); }}
                    className="font-body text-sm text-coral hover:underline"
                  >
                    Browse the full shop instead →
                  </button>
                </div>
              ) : (
                results.map((p, i) => {
                  const out = p.soldOut || !productHasStock(p);
                  return (
                    <button
                      key={p.id}
                      onClick={() => pick(p)}
                      onMouseEnter={() => setCursor(i)}
                      className="w-full flex items-center gap-3 px-3 py-2.5 text-left transition-colors"
                      style={{ background: cursor === i ? "var(--glass-bg)" : "transparent" }}
                    >
                      <SearchThumb product={p} />
                      <span className="flex-1 min-w-0">
                        <span className="block font-body text-sm truncate">{p.name}</span>
                        <span className="block font-body text-xs text-muted">
                          {CATEGORIES.find((c) => c.id === p.category)?.label}
                          {out ? " · Sold out" : ""}
                        </span>
                      </span>
                      <span className="font-num text-sm flex-shrink-0" style={{ color: p.discount > 0 ? "var(--coral)" : "var(--fg)" }}>
                        {money(effectivePrice(p))}
                      </span>
                    </button>
                  );
                })
              )}
            </div>
          )}

          {!query && (
            <div className="px-4 pb-4" style={{ borderTop: "1px solid var(--glass-border)", paddingTop: 14 }}>
              <p className="font-body text-xs text-muted mb-2.5">Jump to</p>
              <div className="flex flex-wrap gap-2">
                <button
                  onClick={() => { onClose(); goSale(); }}
                  className="font-body text-xs px-3 py-1.5 rounded-full tap-scale flex items-center gap-1"
                  style={{ background: "rgba(255,69,34,0.14)", border: "1px solid rgba(255,69,34,0.4)", color: "var(--coral)" }}
                >
                  <Tag className="w-3 h-3" /> Sale
                </button>
                {CATEGORIES.map((c) => (
                  <button
                    key={c.id}
                    onClick={() => { onClose(); goCatalog(c.id); }}
                    className="font-body text-xs px-3 py-1.5 rounded-full tap-scale"
                    style={{ background: "var(--glass-bg)", border: "1px solid var(--glass-border)" }}
                  >
                    {c.label}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function SearchThumb({ product }) {
  const [ok, setOk] = useState(true);
  const src = getImages(product)[0];
  if (src && ok) {
    return (
      <span className="rounded-lg overflow-hidden flex-shrink-0 block" style={{ width: 40, height: 50, border: "1px solid var(--glass-border)" }}>
        <img src={src} alt="" className="w-full h-full" style={{ objectFit: "cover" }} onError={() => setOk(false)} />
      </span>
    );
  }
  const c1 = COLORS[product.colors[0]]?.hex || "#141414";
  return (
    <span
      className="rounded-lg flex-shrink-0 flex items-center justify-center block"
      style={{ width: 40, height: 50, border: "1px solid var(--glass-border)", background: `radial-gradient(120% 120% at 25% 25%, ${c1} 0%, transparent 70%), #1A1A1E` }}
    >
      <IconFor type={product.icon || iconForCategory(product.category)} className="w-4 h-4" style={{ color: "rgba(255,255,255,0.5)" }} />
    </span>
  );
}

/* ============================================================
   COLOUR PICKER
   ------------------------------------------------------------
   Rendered twice on the product page: directly under the gallery on
   mobile (so you can see the photos change as you tap a colour), and
   in the details column on desktop.
   ============================================================ */
function ColorPicker({ product, color, onPick }) {
  return (
    <>
      <p className="font-body text-sm font-medium mb-2">
        Color: {COLORS[color]?.label || color}
        {!colorHasStock(product, color) && <span className="text-muted"> — out of stock</span>}
      </p>
      <div className="flex gap-2 flex-wrap">
        {product.colors.map((key) => {
          const inStock = colorHasStock(product, key);
          return (
            <button
              key={key}
              onClick={() => onPick(key)}
              disabled={!inStock}
              className="relative w-9 h-9 rounded-full border-2 tap-scale"
              style={{
                borderColor: color === key ? "var(--coral)" : "transparent",
                boxShadow: "0 0 0 1px var(--border)",
                opacity: inStock ? 1 : 0.35,
                cursor: inStock ? "pointer" : "not-allowed",
              }}
              aria-label={`${COLORS[key]?.label || key}${inStock ? "" : " (out of stock)"}`}
              title={inStock ? COLORS[key]?.label || key : `${COLORS[key]?.label || key} — out of stock`}
            >
              <span className="block w-full h-full rounded-full" style={{ background: swatchBackground(key) }} />
              {!inStock && (
                <span className="absolute inset-0 flex items-center justify-center" aria-hidden="true">
                  <span style={{ width: "120%", height: 1.5, background: "var(--fg)", transform: "rotate(-45deg)", opacity: 0.7 }} />
                </span>
              )}
            </button>
          );
        })}
      </div>
    </>
  );
}

/* A product counts as "on sale" only if it's really cheaper than its
   list price — a 0% sale badge shouldn't pull anyone in. */
function isOnSale(p) {
  return p.discount > 0 && effectivePrice(p) < p.price;
}

/* ============================================================
   SHOP MENU (desktop)
   ------------------------------------------------------------
   Eleven categories won't sit in a row without turning the header
   into a wall of text, so they live in one calm panel — with fits
   listed under the categories that have them.
   ============================================================ */
function ShopMenu({ goCatalog }) {
  const [open, setOpen] = useState(false);
  const wrapRef = useRef(null);

  useEffect(() => {
    if (!open) return;
    const onDown = (e) => { if (wrapRef.current && !wrapRef.current.contains(e.target)) setOpen(false); };
    const onEsc = (e) => { if (e.key === "Escape") setOpen(false); };
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onEsc);
    return () => { document.removeEventListener("mousedown", onDown); document.removeEventListener("keydown", onEsc); };
  }, [open]);

  const pick = (cat, sub) => { setOpen(false); goCatalog(cat, sub); };

  return (
    <div
      ref={wrapRef}
      className="relative"
      onMouseEnter={() => setOpen(true)}
      onMouseLeave={() => setOpen(false)}
    >
      <button
        onClick={() => setOpen((v) => !v)}
        className="hover:text-coral transition-colors flex items-center gap-1"
        aria-expanded={open}
        aria-haspopup="true"
      >
        Shop
        <ChevronDown className="w-3.5 h-3.5" style={{ transform: open ? "rotate(180deg)" : "none", transition: "transform 0.2s" }} />
      </button>

      {open && (
        <div className="absolute left-1/2 pt-3 search-fade" style={{ transform: "translateX(-50%)", top: "100%", zIndex: 60 }}>
          <div className="glass glass-sheen rounded-2xl p-4" style={{ width: 460, boxShadow: "0 20px 50px rgba(0,0,0,0.3)" }}>
            <button
              onClick={() => pick("all")}
              className="w-full text-left font-body text-sm px-3 py-2 rounded-xl hover:text-coral transition-colors flex items-center justify-between"
              style={{ background: "var(--glass-bg)" }}
            >
              All products <ArrowRight className="w-3.5 h-3.5" />
            </button>

            <div className="grid grid-cols-2 gap-x-4 gap-y-0.5 mt-3">
              {CATEGORIES.map((c) => {
                const subs = subsFor(c.id);
                return (
                  <div key={c.id} className="py-1">
                    <button
                      onClick={() => pick(c.id)}
                      className="font-body text-sm hover:text-coral transition-colors block text-left"
                    >
                      {c.label}
                    </button>
                    {subs.length > 0 && (
                      <div className="flex gap-2 mt-0.5">
                        {subs.map((sb) => (
                          <button
                            key={sb.id}
                            onClick={() => pick(c.id, sb.id)}
                            className="font-body text-muted hover:text-coral transition-colors"
                            style={{ fontSize: "0.7rem" }}
                          >
                            {sb.label}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

/* ============================================================
   SALE CARD — the permanent hook on the home page
   ------------------------------------------------------------
   Uses the house glass + mesh language, but flips the weighting:
   coral is the surface here instead of an accent, so it stands out
   from the calm cards around it without inventing a new style.
   ============================================================ */
function SaleCard({ onOpen, count, maxDiscount }) {
  return (
    <button
      onClick={onOpen}
      className="glass glass-sheen sale-card group rounded-3xl p-6 h-full w-full flex flex-col justify-between relative overflow-hidden text-left tap-scale"
      style={{ minHeight: 150, borderColor: "rgba(255,69,34,0.45)" }}
      aria-label={`Sale — ${count} pieces, up to ${maxDiscount}% off`}
    >
      {/* coral wash + slow drifting glow, same family as MeshBackground */}
      <span className="absolute inset-0 pointer-events-none" aria-hidden="true" style={{ background: "linear-gradient(135deg, rgba(255,69,34,0.22), rgba(255,69,34,0.04) 60%)" }} />
      <span className="sale-glow" aria-hidden="true" />
      <span className="grain-overlay" aria-hidden="true" />

      <span className="relative flex items-start justify-between gap-4 w-full">
        <span className="block min-w-0">
          <Tag className="w-5 h-5 text-coral mb-3" />
          <span className="block font-display font-bold text-xl leading-snug">
            On sale now
          </span>
          <span className="block font-body text-xs text-muted mt-1.5">
            {count} {count === 1 ? "piece" : "pieces"} across the shop
          </span>
        </span>

        <span
          className="font-num font-bold flex-shrink-0 rounded-2xl text-center flex flex-col items-center justify-center"
          style={{ background: "var(--coral)", color: "#fff", width: 86, height: 62, boxShadow: "0 8px 20px rgba(255,69,34,0.35)" }}
        >
          <span className="block text-2xl leading-none">−{maxDiscount}%</span>
          <span className="block font-body" style={{ fontSize: "0.55rem", letterSpacing: "0.12em", marginTop: 3, opacity: 0.9 }}>UP TO</span>
        </span>
      </span>

      <span className="relative font-body text-sm font-medium text-coral mt-5 inline-flex items-center gap-1.5">
        Shop the sale
        <ArrowRight className="w-4 h-4 transition-transform duration-300 group-hover:translate-x-1" />
      </span>
    </button>
  );
}

/* ============================================================
   SALE VIEW — its own page, deliberately louder than the shop
   ------------------------------------------------------------
   Same glass/mesh vocabulary as the rest of the site, but coral leads
   instead of accents, cards carry the saving in money (not just a %),
   and the biggest discounts come first.
   ============================================================ */
function SaleView({ products, loading, goCatalog, openProduct, likes, toggleLike }) {
  const [shown, setShown] = useState(PAGE_SIZE);

  useEffect(() => {
    document.title = `Sale — ${STORE_NAME}`;
  }, []);

  // Deepest discounts first — that's what people came for.
  const items = useMemo(
    () => products.filter(isOnSale).sort((a, b) => b.discount - a.discount),
    [products]
  );
  const visible = items.slice(0, shown);
  const remaining = items.length - visible.length;
  const maxDiscount = items.length ? items[0].discount : 0;
  const biggestSaving = items.length
    ? Math.max(...items.map((p) => p.price - effectivePrice(p)))
    : 0;

  return (
    <div>
      {/* Hero */}
      <section className="relative overflow-hidden">
        <MeshBackground variant="hero" />
        <div className="absolute inset-0 pointer-events-none" aria-hidden="true" style={{ background: "linear-gradient(180deg, rgba(255,69,34,0.14), transparent 70%)" }} />
        <div className="relative max-w-6xl mx-auto px-4 sm:px-6 pt-12 pb-12 text-center">
          <div className="hero-fade-1 mb-5 flex justify-center">
            <GlassChip tone="coral"><Tag className="w-3 h-3" /> Limited time</GlassChip>
          </div>
          <h1 className="font-display font-bold text-6xl sm:text-7xl leading-[0.95] mb-3 hero-fade-2 text-coral" style={{ letterSpacing: "-0.02em" }}>
            Sale
          </h1>
          <p className="font-body text-muted text-sm sm:text-base hero-fade-3 mx-auto leading-7" style={{ maxWidth: 400 }}>
            Every discounted piece in the shop, gathered in one place.
            <span className="block font-medium" style={{ color: "var(--fg)" }}>When it's gone, it's gone.</span>
          </p>

          {items.length > 0 && (
            <div className="flex items-center justify-center gap-2.5 mt-7 hero-fade-4 flex-wrap">
              <SaleStat value={`${items.length}`} label={items.length === 1 ? "piece" : "pieces"} />
              <SaleStat value={`−${maxDiscount}%`} label="up to" accent />
              <SaleStat value={money(biggestSaving)} label="biggest saving" />
            </div>
          )}
        </div>
      </section>

      <div className="max-w-6xl mx-auto px-4 sm:px-6 pb-16">
        {loading && items.length === 0 ? (
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4 sm:gap-6">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="rounded-2xl glass" style={{ aspectRatio: "4/5", opacity: 0.5 }} />
            ))}
          </div>
        ) : items.length === 0 ? (
          <div className="glass rounded-3xl py-16 px-6 text-center">
            <Tag className="w-8 h-8 text-muted mx-auto mb-4" style={{ opacity: 0.5 }} />
            <p className="font-display font-bold text-lg mb-2">No sale on right now</p>
            <p className="font-body text-sm text-muted mb-5">
              Nothing is discounted at the moment — but pieces go on sale often, so keep an eye here.
            </p>
            <button onClick={() => goCatalog("all")} className="glass glass-btn rounded-full font-body font-medium px-6 py-3 tap-scale">
              Browse the shop
            </button>
          </div>
        ) : (
          <>
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4 sm:gap-6">
              {visible.map((p, i) => (
                <Reveal key={p.id} delay={(i % 8) * 50}>
                  <SaleProductCard product={p} onOpen={openProduct} liked={likes.includes(p.id)} onToggleLike={() => toggleLike(p.id)} />
                </Reveal>
              ))}
            </div>

            {remaining > 0 && (
              <div className="flex flex-col items-center gap-3 mt-10">
                <p className="font-body text-xs text-muted">Showing {visible.length} of {items.length}</p>
                <button
                  onClick={() => setShown((n) => n + PAGE_SIZE)}
                  className="glass glass-btn rounded-full font-body font-medium px-8 py-3 tap-scale flex items-center gap-2"
                >
                  Load {Math.min(remaining, PAGE_SIZE)} more
                  <ChevronDown className="w-4 h-4" />
                </button>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}

function SaleStat({ value, label, accent }) {
  return (
    <div
      className="glass rounded-2xl py-3 text-center"
      style={{
        minWidth: 104,
        ...(accent ? { borderColor: "rgba(255,69,34,0.5)", background: "rgba(255,69,34,0.07)" } : {}),
      }}
    >
      <p className="font-num font-bold text-xl leading-tight" style={accent ? { color: "var(--coral)" } : undefined}>{value}</p>
      <p className="font-body text-muted uppercase" style={{ fontSize: "0.62rem", letterSpacing: "0.09em", marginTop: 2 }}>{label}</p>
    </div>
  );
}

/* Like ProductCard, but the saving is spelled out in money — a shopper
   shouldn't have to do the percentage maths in their head. */
function SaleProductCard({ product, onOpen, liked, onToggleLike }) {
  const isOut = product.soldOut || !productHasStock(product);
  const saving = product.price - effectivePrice(product);
  return (
    <button onClick={() => onOpen(product)} className="text-left group focus:outline-none w-full">
      <div
        className="transition-transform duration-500 group-hover:-translate-y-2"
        style={{ transitionTimingFunction: "cubic-bezier(0.16,1,0.3,1)", opacity: isOut ? 0.7 : 1 }}
      >
        <SwatchPanel product={product} liked={liked} onToggleLike={onToggleLike} forceSoldOut={isOut} />
      </div>
      <div className="mt-3.5 space-y-1">
        <p className="font-body font-medium text-fg text-sm truncate">{product.name}</p>
        {isOut ? (
          <span className="font-num text-sm text-muted">Sold out</span>
        ) : (
          <div className="flex items-baseline gap-2">
            <span className="font-num text-base text-coral">{money(effectivePrice(product))}</span>
            <span className="font-num text-xs text-muted line-through">{money(product.price)}</span>
            <span className="font-body rounded-full ml-auto flex-shrink-0" style={{ fontSize: "0.62rem", padding: "2px 8px", background: "rgba(255,69,34,0.12)", border: "1px solid rgba(255,69,34,0.25)", color: "var(--coral)" }}>
              save {money(saving)}
            </span>
          </div>
        )}
      </div>
    </button>
  );
}

/* ============================================================
   ROOT
   ============================================================ */
export default function KanaanShopRoot() {
  return (
    <AppProvider>
      <KanaanShop />
    </AppProvider>
  );
}

function KanaanShop() {
  const { theme } = useApp();
  const [path, navigate, navDirection, canGoBack] = useRouter();
  const route = parseRoute(path);

  const [cart, setCart] = useState([]);
  const [likes, setLikes] = useState([]);
  const [cartOpen, setCartOpen] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [storageReady, setStorageReady] = useState(false);
  const [lastOrder, setLastOrder] = useState(null);
  const [orderPlaced, setOrderPlaced] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);

  // شريط الحالة بيتبع الثيم الحالي (بس جوا التطبيق — على الموقع ما في تأثير)
  useEffect(() => {
    syncStatusBar(theme);
  }, [theme]);

  // أول ما التطبيق يخلص أول رندر، منخفي شاشة الـ splash — هيك ما في
  // ومضة شاشة بيضا بين الـ splash والمحتوى الحقيقي
  useEffect(() => {
    hideSplashScreen();
  }, []);

  // شاشة الترحيب الأولى — تظهر مرة وحدة بس، أول تشغيل للتطبيق
  const [showWelcome, setShowWelcome] = useState(() => isNativeApp && !hasSeenWelcome());

  // حالة الاتصال — بانر بسيط بدل ما نسكت أو نخلي المستخدم يشوف
  // شاشة خطأ المتصفح المزعجة
  const [isOffline, setIsOffline] = useState(false);
  useEffect(() => {
    return registerNetworkListener((connected) => setIsOffline(!connected));
  }, []);

  // إشعار داخلي بسيط لما يوصل إشعار والتطبيق مفتوح قدام المستخدم
  const [inAppNotification, setInAppNotification] = useState(null);

  // إشعارات Push — بنسأل الإذن بعد ما شاشة الترحيب تتقفل (أو فوراً
  // لو المستخدم شافها قبل)، مش فجأة بلا سياق أول ما التطبيق يفتح
  useEffect(() => {
    if (!showWelcome) {
      const openNotificationUrl = (url) => {
        // نستخرج بس المسار من الرابط الكامل ("/sale" من
        // "https://kanaanshop.com/sale") ونفتحو بالراوتر الداخلي —
        // هيك ما في نقلة صفحة كاملة لنطاق تاني (يلي كانت بتفتح
        // متصفح خارجي بدل التطبيق).
        try {
          const path = new URL(url, SITE_URL).pathname;
          navigate(path || "/");
        } catch {
          navigate("/");
        }
      };

      registerPushNotifications(
        apiBase,
        openNotificationUrl,
        (n) => {
          hapticLight();
          setInAppNotification(n);
          setTimeout(() => setInAppNotification(null), 5000);
        }
      );
    }
  }, [showWelcome]);

  const dismissWelcome = () => {
    markWelcomeSeen();
    setShowWelcome(false);
  };

  // سحب من حافة الشاشة اليسرى للرجوع — بس إذا في فعلاً وين نرجع
  useEffect(() => {
    return registerEdgeSwipeBack(() => {
      if (canGoBack()) {
        hapticLight();
        window.history.back();
      }
    });
  }, []);

  // Belt and braces on the scroll reset: navigate() jumps immediately, and
  // this runs again once the new page has actually rendered, so a tall
  // catalog can't leave you stranded halfway down the product page.
  useLayoutEffect(() => {
    window.scrollTo(0, 0);
  }, [path]);

  // ⌘K / Ctrl-K opens search, the way people expect on desktop.
  useEffect(() => {
    const onKey = (e) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setSearchOpen(true);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  // Persist the cart + likes in the browser's localStorage so they survive
  // page reloads on the live site. (The earlier window.storage API only
  // existed inside the AI preview sandbox and did nothing once deployed.)
  useEffect(() => {
    try {
      const savedCart = localStorage.getItem("kanaan-cart");
      if (savedCart) setCart(JSON.parse(savedCart));
    } catch {}
    try {
      const savedLikes = localStorage.getItem("kanaan-likes");
      if (savedLikes) setLikes(JSON.parse(savedLikes));
    } catch {}
    setStorageReady(true);
  }, []);

  useEffect(() => {
    if (!storageReady) return;
    try {
      localStorage.setItem("kanaan-cart", JSON.stringify(cart));
    } catch {}
  }, [cart, storageReady]);

  useEffect(() => {
    if (!storageReady) return;
    try {
      localStorage.setItem("kanaan-likes", JSON.stringify(likes));
    } catch {}
  }, [likes, storageReady]);

  const [products, setProducts] = useState([]);
  const [catalogLoading, setCatalogLoading] = useState(true);
  const [storyRings, setStoryRings] = useState([]);
  const [appExclusiveCount, setAppExclusiveCount] = useState(0);

  const refreshProducts = async () => {
    try {
      const res = await fetch(`${apiBase}/api/products`, {
        headers: isNativeApp ? { "X-Kanaan-Client": "app" } : {},
      });
      const data = await res.json();
      if (Array.isArray(data.products)) setProducts(data.products);
      if (typeof data.appExclusiveCount === "number") setAppExclusiveCount(data.appExclusiveCount);
    } catch { /* offline or API not ready */ }
  };

  useEffect(() => {
    let alive = true;
    (async () => {
      await refreshProducts();
      if (alive) setCatalogLoading(false);
    })();
    return () => { alive = false; };
  }, []);

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const res = await fetch(`${apiBase}/api/stories`);
        const data = await res.json();
        if (alive && Array.isArray(data.rings)) setStoryRings(data.rings);
      } catch { /* The Edit is a bonus feature — never block the shop on it */ }
    })();
    return () => { alive = false; };
  }, []);

  const goHome = () => navigate("/");
  const goCatalog = (cat, sub) => {
    if (!cat || cat === "all") navigate("/shop");
    else navigate(sub ? `/shop/${cat}/${sub}` : `/shop/${cat}`);
    setMenuOpen(false);
  };
  const goSale = () => { navigate("/sale"); setMenuOpen(false); };
  const goFavorites = () => { navigate("/favorites"); setMenuOpen(false); };
  const goExclusives = () => { navigate("/exclusives"); setMenuOpen(false); };
  const openProduct = (product) => navigate(`/product/${product.slug}`);
  const goCheckout = () => { setCartOpen(false); setOrderPlaced(false); navigate("/checkout"); };

  const toggleLike = (id) => {
    hapticLight();
    playTapChime();
    setLikes((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  };

  const cartKey = (pid, size, colorKey) => `${pid}-${size}-${colorKey}`;

  // Which ring "The Edit" viewer is showing, if any. Storing the ring id
  // (not the object) means it always reflects the freshest fetched data.
  const [openRingId, setOpenRingId] = useState(null);
  const openStory = (ringId) => setOpenRingId(ringId);
  const closeStory = () => setOpenRingId(null);

  // زر الرجوع الفيزيائي بأندرويد — عندو أولويات بالترتيب:
  // 1) لو في نافذة منبثقة مفتوحة (سلة/بحث/ستوري/قائمة)، سكّرها بس
  // 2) لو لأ، بس لسا في صفحات نرجعلها جوا الراوتر، ارجع
  // 3) لو لأ (إحنا بالصفحة الأولى وما في نوافذ مفتوحة)، اطلع من التطبيق
  // بدون هالترتيب، كانت أي نافذة منبثقة مفتوحة بتخلي زر الرجوع يطلع
  // من التطبيق كامل بدل ما يسكّر النافذة بس — بالظبط المشكلة يلي صارت.
  useEffect(() => {
    let cleanup = () => {};
    const hasOpenOverlay = cartOpen || searchOpen || !!openRingId || menuOpen;
    registerBackButtonHandler({
      canGoBack: () => hasOpenOverlay || canGoBack(),
      onBackWithinApp: () => {
        if (cartOpen) { setCartOpen(false); return; }
        if (searchOpen) { setSearchOpen(false); return; }
        if (openRingId) { closeStory(); return; }
        if (menuOpen) { setMenuOpen(false); return; }
        window.history.back();
      },
      onExitApp: () => {
        import("@capacitor/app").then(({ App }) => App.exitApp());
      },
    }).then((fn) => { cleanup = fn; });
    return () => cleanup();
  }, [cartOpen, searchOpen, openRingId, menuOpen]);

  // colorKey = the palette key we track stock against ("black")
  // colorLabel = what the shopper reads ("Black")
  const addToCart = (product, size, colorKey, colorLabel, qty) => {
    setCart((prev) => {
      const key = cartKey(product.id, size, colorKey);
      const limit = stockFor(product, colorKey, size); // Infinity when untracked
      const existing = prev.find((i) => i.key === key);
      if (existing) {
        const capped = Math.min(existing.qty + qty, limit);
        return prev.map((i) => (i.key === key ? { ...i, qty: capped } : i));
      }
      return [...prev, {
        key, productId: product.id, name: product.name, price: effectivePrice(product),
        size, colorKey, color: colorLabel, qty: Math.min(qty, limit),
      }];
    });
    hapticLight();
    playTapChime();
    setCartOpen(true);
  };

  const updateQty = (key, delta) => {
    setCart((prev) => prev.map((i) => {
      if (i.key !== key) return i;
      const product = products.find((p) => p.id === i.productId);
      const limit = product ? stockFor(product, i.colorKey, i.size) : Infinity;
      const next = Math.max(1, Math.min(i.qty + delta, limit));
      return { ...i, qty: next };
    }).filter((i) => i.qty > 0));
  };
  const removeFromCart = (key) => setCart((prev) => prev.filter((i) => i.key !== key));

  const cartCount = cart.reduce((sum, i) => sum + i.qty, 0);

  useEffect(() => {
    updateAppBadge(cartCount);
  }, [cartCount]);
  const cartTotal = cart.reduce((sum, i) => sum + i.qty * i.price, 0);

  const filteredProducts = useMemo(() => {
    if (route.type !== "catalog") return products;
    let list = route.category === "all" ? products : products.filter((p) => p.category === route.category);
    if (route.sub) list = list.filter((p) => p.subcategory === route.sub);
    return list;
  }, [route.type, route.category, route.sub, products]);

  const currentProduct = route.type === "product" ? products.find((p) => p.slug === route.slug) : null;

  if (route.type === "admin") {
    return (
      <div data-theme={theme} className="min-h-screen bg-app text-fg font-body">
        <GlobalStyles />
        <Admin onExit={goHome} />
      </div>
    );
  }

  return (
    <ProductsContext.Provider value={products}>
    <div
      data-theme={theme}
      className="min-h-screen bg-app text-fg font-body relative"
      style={isNativeApp ? { paddingBottom: "calc(84px + env(safe-area-inset-bottom))" } : undefined}
    >
      <GlobalStyles />
      {isNativeApp ? (
        route.type !== "home" && (
          <AppTopBar
            title={routeTitle(route, currentProduct)}
            canGoBack={canGoBack()}
            onBack={() => window.history.back()}
            cartCount={cartCount}
            onCart={() => setCartOpen(true)}
          />
        )
      ) : (
        <Header cartCount={cartCount} onHome={goHome} onCart={() => setCartOpen(true)} onSearch={() => setSearchOpen(true)} onSale={goSale} menuOpen={menuOpen} setMenuOpen={setMenuOpen} goCatalog={goCatalog} />
      )}
      {isNativeApp && isOffline && (
        <div className="px-4 sm:px-6" style={{ paddingTop: route.type === "home" ? "calc(0.75rem + env(safe-area-inset-top, 0px))" : 8 }}>
          <div className="glass rounded-2xl px-4 py-2.5 flex items-center gap-2">
            <span style={{ width: 7, height: 7, borderRadius: "50%", background: "var(--coral)", flexShrink: 0 }} />
            <p className="font-body text-xs text-muted">You're offline — showing what's saved on your phone.</p>
          </div>
        </div>
      )}
      <main>
        <PageTransition path={path} direction={navDirection}>
        {route.type === "home" && isNativeApp && (
          <NativeHomeView products={products} loading={catalogLoading} goCatalog={goCatalog} goSale={goSale} goExclusives={goExclusives} openProduct={openProduct} likes={likes} toggleLike={toggleLike} storyRings={storyRings} openStory={openStory} goFavorites={goFavorites} onCart={() => setCartOpen(true)} cartCount={cartCount} />
        )}
        {route.type === "home" && !isNativeApp && (
          <HomeView products={products} loading={catalogLoading} goCatalog={goCatalog} goSale={goSale} openProduct={openProduct} likes={likes} toggleLike={toggleLike} storyRings={storyRings} openStory={openStory} appExclusiveCount={appExclusiveCount} />
        )}
        {route.type === "sale" && (
          <SaleView products={products} loading={catalogLoading} goCatalog={goCatalog} openProduct={openProduct} likes={likes} toggleLike={toggleLike} />
        )}
        {route.type === "catalog" && (
          <CatalogView activeCategory={route.category} activeSub={route.sub} loading={catalogLoading} goCatalog={goCatalog} products={filteredProducts} openProduct={openProduct} likes={likes} toggleLike={toggleLike} />
        )}
        {route.type === "favorites" && (
          <FavoritesView products={products} loading={catalogLoading} likes={likes} openProduct={openProduct} toggleLike={toggleLike} goCatalog={goCatalog} />
        )}
        {route.type === "exclusives" && (
          <ExclusivesView products={products} loading={catalogLoading} likes={likes} openProduct={openProduct} toggleLike={toggleLike} />
        )}
        {route.type === "privacy" && <PrivacyPolicyView />}
        {route.type === "product" && currentProduct && (
          <ProductView product={currentProduct} products={products} addToCart={addToCart} openProduct={openProduct} liked={likes.includes(currentProduct.id)} toggleLike={() => toggleLike(currentProduct.id)} />
        )}
        {route.type === "product" && !currentProduct && catalogLoading && (
          <div className="max-w-lg mx-auto px-6 py-24 text-center">
            <p className="font-body text-muted">Loading…</p>
          </div>
        )}
        {route.type === "product" && !currentProduct && !catalogLoading && (
          <div className="max-w-lg mx-auto px-6 py-24 text-center">
            <p className="font-body text-muted mb-4">We couldn't find that product.</p>
            <button onClick={() => goCatalog("all")} className="text-coral font-body hover:underline">Back to shop</button>
          </div>
        )}
        {route.type === "checkout" && !orderPlaced && (
          <CheckoutView
            cart={cart}
            total={cartTotal}
            onSubmitted={(orderInfo) => {
              setLastOrder(orderInfo);
              setCart([]);
              setOrderPlaced(true);
              window.scrollTo({ top: 0, behavior: "smooth" });
            }}
          />
        )}
        {route.type === "checkout" && orderPlaced && <ConfirmationView order={lastOrder} goHome={goHome} />}
        </PageTransition>
      </main>

      <StoryViewer
        rings={storyRings}
        openRingId={openRingId}
        onClose={closeStory}
        products={products}
        addToCart={addToCart}
        openProduct={(p) => { closeStory(); openProduct(p); }}
        goCatalog={(cat, sub) => { closeStory(); goCatalog(cat, sub); }}
      />
      {isNativeApp ? <AppFootnote /> : <Footer goCatalog={goCatalog} goSale={goSale} />}
      <WhatsAppFab raised={route.type === "product"} />
      <SearchOverlay
        open={searchOpen}
        onClose={() => setSearchOpen(false)}
        products={products}
        openProduct={openProduct}
        goCatalog={goCatalog}
        goSale={goSale}
      />
      <CartDrawer
        open={cartOpen}
        onClose={() => setCartOpen(false)}
        cart={cart}
        updateQty={updateQty}
        removeFromCart={removeFromCart}
        total={cartTotal}
        onCheckout={goCheckout}
      />
      {isNativeApp && route.type !== "checkout" && (
        <BottomTabBar
          activeType={route.type}
          goHome={goHome}
          goCatalog={goCatalog}
          onSearch={() => setSearchOpen(true)}
          goFavorites={goFavorites}
          onCart={() => setCartOpen(true)}
          cartCount={cartCount}
          likesCount={likes.length}
        />
      )}
      {showWelcome && <WelcomeSheet onDismiss={dismissWelcome} />}
      <InAppNotificationBanner
        notification={inAppNotification}
        onDismiss={() => setInAppNotification(null)}
        onTap={() => {
          if (inAppNotification?.url) {
            try {
              const path = new URL(inAppNotification.url, SITE_URL).pathname;
              navigate(path || "/");
            } catch { /* ignore */ }
          }
        }}
      />
    </div>
    </ProductsContext.Provider>
  );
}

/* ============================================================
   GLOBAL STYLES
   ============================================================ */
function GlobalStyles() {
  return (
    <style>{`
      [data-theme="dark"] {
        color-scheme: dark;
        --bg: #0B0B0E;
        --bg-soft: #101014;
        --fg: #F5F5F7;
        --fg-muted: rgba(245,245,247,0.6);
        --border: rgba(245,245,247,0.12);
        --glass-bg: rgba(255,255,255,0.06);
        --glass-border: rgba(255,255,255,0.14);
        --glass-shadow: 0 8px 32px rgba(0,0,0,0.35);
        --field-bg: rgba(255,255,255,0.05);
        --logo-filter: invert(1) brightness(1.1);
      }
      [data-theme="light"] {
        color-scheme: light;
        --bg: #F2F2F4;
        --bg-soft: #FFFFFF;
        --fg: #14141A;
        --fg-muted: rgba(20,20,26,0.58);
        --border: rgba(20,20,26,0.1);
        --glass-bg: rgba(255,255,255,0.55);
        --glass-border: rgba(255,255,255,0.9);
        --glass-shadow: 0 8px 32px rgba(20,20,26,0.08);
        --field-bg: rgba(255,255,255,0.7);
        --logo-filter: none;
      }
      :root { --coral: #FF4522; --teal: #12B3A0; }

      /* This site's light/dark mode is a manual toggle only, never tied to
         the OS setting (see the header switch) — so this block doesn't
         redefine any colours. Its only job is to make an actual
         @media (prefers-color-scheme) rule exist in the stylesheet, because
         some Android browsers use "does this page reference
         prefers-color-scheme at all" as their signal for "this site already
         handles its own dark mode, don't force one on top of it." */
      @media (prefers-color-scheme: dark) {
        html { color-scheme: light dark; }
      }

      .font-display { font-family: 'Space Grotesk', sans-serif; }
      .font-body { font-family: 'Inter', sans-serif; }
      .font-num { font-family: 'Space Grotesk', sans-serif; }

      .bg-app { background-color: var(--bg); }
      .bg-soft { background-color: var(--bg-soft); }
      .text-fg { color: var(--fg); }
      .text-muted { color: var(--fg-muted); }
      .border-app { border-color: var(--border); }
      .text-coral { color: var(--coral); }
      .bg-coral { background-color: var(--coral); }
      .text-teal { color: var(--teal); }
      .bg-teal { background-color: var(--teal); }
      .text-required { color: #E0392B; }

      .glass {
        background: var(--glass-bg);
        backdrop-filter: blur(20px) saturate(180%);
        -webkit-backdrop-filter: blur(20px) saturate(180%);
      }
      @media (max-width: 640px) {
        .glass {
          backdrop-filter: blur(14px) saturate(170%);
          -webkit-backdrop-filter: blur(14px) saturate(170%);
        }
      }
      .glass {
        border: 1px solid var(--glass-border);
        box-shadow: var(--glass-shadow),
                    inset 0 1px 0 rgba(255,255,255,0.28),
                    inset 0 -1px 1px rgba(255,255,255,0.04);
      }
      /* A soft top-edge specular sheen makes the "liquid glass" read as glass. */
      .glass-sheen { position: relative; }
      .glass-sheen::before {
        content: '';
        position: absolute;
        inset: 0;
        border-radius: inherit;
        pointer-events: none;
        background: linear-gradient(160deg, rgba(255,255,255,0.22) 0%, rgba(255,255,255,0.05) 22%, transparent 45%);
        opacity: 0.7;
      }

      .glass-btn { position: relative; overflow: hidden; }
      .glass-btn::after {
        content: '';
        position: absolute;
        top: 0; left: -60%;
        width: 40%; height: 100%;
        background: linear-gradient(120deg, transparent, rgba(255,255,255,0.35), transparent);
        transform: skewX(-20deg);
        transition: left 0.7s ease;
      }
      .glass-btn:hover::after { left: 130%; }

      @keyframes meshFloat {
        0%   { transform: translate(0,0) scale(1) translateZ(0); }
        33%  { transform: translate(30px,-25px) scale(1.08) translateZ(0); }
        66%  { transform: translate(-20px,20px) scale(0.95) translateZ(0); }
        100% { transform: translate(0,0) scale(1) translateZ(0); }
      }
      .mesh-blob { animation-name: meshFloat; animation-timing-function: ease-in-out; animation-iteration-count: infinite; }

      /* Floating help button */
      @keyframes fabPulse {
        0%   { box-shadow: 0 0 0 0 rgba(255,69,34,0.45); }
        70%  { box-shadow: 0 0 0 14px rgba(255,69,34,0); }
        100% { box-shadow: 0 0 0 0 rgba(255,69,34,0); }
      }
      .fab-pulse { animation: fabPulse 2.6s cubic-bezier(0.4,0,0.6,1) infinite; }
      .fab-label {
        max-width: 0; opacity: 0; overflow: hidden; white-space: nowrap;
        transition: max-width 0.45s cubic-bezier(0.16,1,0.3,1), opacity 0.3s ease, margin 0.45s ease;
      }
      .fab-wrap:hover .fab-label { max-width: 160px; opacity: 1; margin-left: 2px; }

      .grain-overlay {
        position: absolute;
        inset: 0;
        opacity: 0.05;
        mix-blend-mode: overlay;
        background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='120' height='120'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='2' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E");
      }

      @keyframes fadeUp { from { opacity: 0; transform: translateY(16px); } to { opacity: 1; transform: translateY(0); } }
      .hero-fade-1 { animation: fadeUp 0.8s cubic-bezier(0.16,1,0.3,1) both; }
      .hero-fade-2 { animation: fadeUp 0.8s cubic-bezier(0.16,1,0.3,1) 0.1s both; }
      .hero-fade-3 { animation: fadeUp 0.8s cubic-bezier(0.16,1,0.3,1) 0.22s both; }
      .hero-fade-4 { animation: fadeUp 0.8s cubic-bezier(0.16,1,0.3,1) 0.34s both; }

      @keyframes dockIn { from { opacity: 0; transform: translateY(20px); } to { opacity: 1; transform: translateY(0); } }
      .dock-in { animation: dockIn 0.5s cubic-bezier(0.16,1,0.3,1) both; }

      /* Search overlay */
      @keyframes searchFade { from { opacity: 0; } to { opacity: 1; } }
      @keyframes searchRise { from { opacity: 0; transform: translateY(-10px) scale(0.98); } to { opacity: 1; transform: translateY(0) scale(1); } }
      .search-fade { animation: searchFade 0.18s ease both; }
      .search-rise { animation: searchRise 0.32s cubic-bezier(0.16,1,0.3,1) both; }

      /* Hero promise chips — slide in one after the other, then a slow
         breathing glow keeps them alive without shouting. */
      @keyframes chipIn {
        from { opacity: 0; transform: translateY(10px) scale(0.96); }
        to { opacity: 1; transform: translateY(0) scale(1); }
      }
      @keyframes chipBreath {
        0%, 100% { box-shadow: var(--glass-shadow), inset 0 1px 0 rgba(255,255,255,0.12), 0 0 0 0 rgba(18,179,160,0); }
        50% { box-shadow: var(--glass-shadow), inset 0 1px 0 rgba(255,255,255,0.12), 0 0 18px 2px rgba(18,179,160,0.18); }
      }
      .promise-chip { opacity: 0; }
      .promise-chip-1 { animation: chipIn 0.6s cubic-bezier(0.16,1,0.3,1) 0.45s both, chipBreath 5s ease-in-out 1.2s infinite; }
      .promise-chip-2 { animation: chipIn 0.6s cubic-bezier(0.16,1,0.3,1) 0.62s both, chipBreath 5s ease-in-out 3.7s infinite; }
      .promise-divider {
        width: 18px; height: 1px; flex-shrink: 0;
        background: linear-gradient(90deg, transparent, var(--fg-muted), transparent);
        opacity: 0; animation: chipIn 0.5s ease 0.8s both;
      }

      /* The Edit — story tag dot + compare-slide chip */
      @keyframes tagPing {
        0% { transform: translate(-50%,-50%) scale(0.6); opacity: 0.55; }
        70%, 100% { transform: translate(-50%,-50%) scale(2.2); opacity: 0; }
      }
      .tag-dot-ping {
        position: absolute; top: 50%; left: 50%; width: 22px; height: 22px;
        border-radius: 9999px; background: rgba(255,255,255,0.9);
        animation: tagPing 1.8s ease-out infinite;
      }
      .tag-dot {
        position: absolute; top: 50%; left: 50%; width: 22px; height: 22px;
        border-radius: 9999px; transform: translate(-50%,-50%);
        background: rgba(255,255,255,0.95);
        border: 1.5px solid rgba(0,0,0,0.15);
        box-shadow: 0 2px 10px rgba(0,0,0,0.35);
      }
      .tag-dot::after {
        content: ''; position: absolute; inset: 6px; border-radius: 9999px; background: var(--coral);
      }
      .a-story-chip {
        display: inline-block; padding: 4px 12px; border-radius: 9999px; font-family: 'Inter', sans-serif;
        font-size: 0.7rem; font-weight: 500; color: #fff; background: rgba(0,0,0,0.4);
        backdrop-filter: blur(6px); border: 1px solid rgba(255,255,255,0.25);
      }

      /* Sale card */
      @keyframes saleGlow {
        0%, 100% { transform: translate(-10%, -10%) scale(1); opacity: 0.55; }
        50% { transform: translate(10%, 10%) scale(1.25); opacity: 0.8; }
      }
      .sale-glow {
        position: absolute; right: -20%; bottom: -40%;
        width: 70%; padding-bottom: 70%;
        border-radius: 9999px;
        background: radial-gradient(circle, rgba(255,69,34,0.55) 0%, transparent 70%);
        filter: blur(30px);
        animation: saleGlow 9s ease-in-out infinite;
        will-change: transform, opacity;
        pointer-events: none;
      }
      .sale-card { transition: transform 0.4s cubic-bezier(0.16,1,0.3,1), border-color 0.3s ease; }
      .sale-card:hover { transform: translateY(-3px); border-color: rgba(255,69,34,0.9); }

      @media (prefers-reduced-motion: reduce) {
        .mesh-blob, .hero-fade-1, .hero-fade-2, .hero-fade-3, .hero-fade-4, .dock-in, .fab-pulse, .search-fade, .search-rise, .sale-glow, .promise-divider, .tag-dot-ping { animation: none !important; }
        .promise-chip { animation: none !important; opacity: 1 !important; }
        .promise-divider { opacity: 1 !important; }
      }

      .tap-scale { transition: transform 0.15s ease; }

      /* شريط التنقل السفلي — حصري للتطبيق. env(safe-area-inset-bottom)
         بيحسب مساحة أزرار التنقل الأصلية بأندرويد (gesture bar) حتى
         الشريط ما يضل ملزوق تحتها مباشرة. */
      .native-tab-bar {
        height: 60px;
      }

      /* انتقالات الصفحات — حصري للتطبيق. الصفحة الجديدة بتنزلق من
         اليمين لما نفتح شي جديد، ومن اليسار لما نرجع، بدل ما تظهر
         فجأة. */
      @keyframes pageSlideForward {
        from { opacity: 0; transform: translateX(28px); }
        to   { opacity: 1; transform: translateX(0); }
      }
      @keyframes pageSlideBack {
        from { opacity: 0; transform: translateX(-28px); }
        to   { opacity: 1; transform: translateX(0); }
      }
      .page-slide-forward { animation: pageSlideForward 0.32s cubic-bezier(0.16,1,0.3,1) both; }
      .page-slide-back { animation: pageSlideBack 0.32s cubic-bezier(0.16,1,0.3,1) both; }
      .tap-scale:active { transform: scale(0.94); }

      ::selection { background: var(--coral); color: #fff; }
    `}</style>
  );
}

/* ============================================================
   HEADER
   ============================================================ */
function Header({ cartCount, onHome, onCart, onSearch, onSale, menuOpen, setMenuOpen, goCatalog }) {
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 12);
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <div className="sticky top-0 z-40 px-3 sm:px-6 pt-3">
      <header className="glass max-w-6xl mx-auto rounded-2xl transition-all duration-300" style={{ paddingTop: scrolled ? 8 : 12, paddingBottom: scrolled ? 8 : 12, transform: "translateZ(0)", willChange: "transform" }}>
        <div className="flex items-center justify-between px-4 sm:px-5">
          <button onClick={onHome} className="flex items-center tap-scale" aria-label={STORE_NAME}>
            <LogoMark variant="compact" className="h-6 sm:h-8 w-auto" />
          </button>

          <nav className="hidden lg:flex items-center gap-5 font-body text-sm">
            <button onClick={onHome} className="hover:text-coral transition-colors">Home</button>
            <ShopMenu goCatalog={goCatalog} />
            <button onClick={onSale} className="hover:opacity-80 transition-opacity flex items-center gap-1.5" style={{ color: "var(--coral)" }}>
              <Tag className="w-3.5 h-3.5" /> Sale
            </button>
          </nav>

          <div className="flex items-center gap-2.5">
            <SegmentedToggle />
            <button onClick={onSearch} className="p-2 tap-scale hover:text-coral transition-colors" aria-label="Search products">
              <Search className="w-5 h-5" />
            </button>
            <button onClick={onCart} className="relative p-2 tap-scale hover:text-coral transition-colors" aria-label="Cart">
              <ShoppingBag className="w-5 h-5" />
              {cartCount > 0 && (
                <span className="absolute -top-1 -right-1 bg-coral text-white text-[10px] font-num rounded-full flex items-center justify-center" style={{ minWidth: 18, height: 18 }}>
                  {cartCount}
                </span>
              )}
            </button>
            <button className="lg:hidden p-2 tap-scale" onClick={() => setMenuOpen((v) => !v)} aria-label="Menu">
              {menuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
            </button>
          </div>
        </div>

        {menuOpen && (
          <div className="lg:hidden px-5 pb-3 pt-2 flex flex-col gap-2.5 font-body text-sm border-t mt-2" style={{ borderColor: "var(--border)", maxHeight: "70vh", overflowY: "auto" }}>
            <button onClick={onHome} className="text-left hover:text-coral">Home</button>
            <button onClick={() => goCatalog("all")} className="text-left hover:text-coral">Shop — all products</button>
            <button onClick={onSale} className="text-left flex items-center gap-1.5" style={{ color: "var(--coral)" }}>
              <Tag className="w-3.5 h-3.5" /> Sale
            </button>
            <div className="border-t pt-2.5 mt-0.5 flex flex-col gap-2.5" style={{ borderColor: "var(--border)" }}>
              {CATEGORIES.map((c) => {
                const subs = subsFor(c.id);
                return (
                  <div key={c.id}>
                    <button onClick={() => goCatalog(c.id)} className="text-left text-muted hover:text-coral block">
                      {c.label}
                    </button>
                    {subs.length > 0 && (
                      <div className="flex gap-3 mt-1 ml-3">
                        {subs.map((sb) => (
                          <button
                            key={sb.id}
                            onClick={() => goCatalog(c.id, sb.id)}
                            className="text-muted hover:text-coral"
                            style={{ fontSize: "0.7rem" }}
                          >
                            {sb.label}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </header>
    </div>
  );
}

/* ============================================================
   HOME
   ============================================================ */
/* ============================================================
   THE EDIT — story rail + full-screen viewer
   ------------------------------------------------------------
   Deliberately NOT an Instagram clone: tiles are 4:5 (the same ratio
   as every product photo on the site, not circles), the ring colour
   tells you what kind of content it is before you even tap, and the
   viewer itself is a second storefront — every tagged garment can be
   added to the cart without ever leaving the story.
   ============================================================ */
const RING_ACCENT = {
  sale: { border: "var(--coral)", label: "coral" },
  new: { border: "var(--teal)", label: "teal" },
  compare: { border: "var(--teal)", label: "teal" },
  editorial: { border: "var(--fg-muted)", label: "neutral" },
};

function StoryRail({ rings, onOpen }) {
  return (
    <section className="px-4 sm:px-6 pt-1 pb-3">
      <div className="max-w-6xl mx-auto">
        <div className="flex gap-3.5 overflow-x-auto pb-1" style={{ WebkitOverflowScrolling: "touch" }}>
          {rings.map((ring, i) => (
            <Reveal key={ring.id} delay={i * 60} className="flex-shrink-0">
              <StoryTile ring={ring} onOpen={() => onOpen(ring.id)} />
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  );
}

function StoryTile({ ring, onOpen }) {
  const accent = RING_ACCENT[ring.kind] || RING_ACCENT.editorial;
  const cover = ring.slides[0];
  const [ok, setOk] = useState(true);

  return (
    <button onClick={onOpen} className="text-left tap-scale flex-shrink-0" style={{ width: 96 }}>
      <div
        className="relative rounded-2xl overflow-hidden"
        style={{ aspectRatio: "4/5", border: `2px solid ${accent.border}`, padding: 3 }}
      >
        <div className="relative w-full h-full rounded-xl overflow-hidden" style={{ background: "#1A1A1E" }}>
          {cover.kind === "compare" ? (
            <div className="absolute inset-0 flex">
              <div className="w-1/2 h-full overflow-hidden">{ok && <img src={productImageSrc(cover.image)} alt="" className="w-full h-full" style={{ objectFit: "cover" }} onError={() => setOk(false)} />}</div>
              <div className="w-1/2 h-full overflow-hidden">{ok && <img src={productImageSrc(cover.imageB)} alt="" className="w-full h-full" style={{ objectFit: "cover" }} onError={() => setOk(false)} />}</div>
            </div>
          ) : ok ? (
            <img src={productImageSrc(cover.image)} alt="" className="absolute inset-0 w-full h-full" style={{ objectFit: "cover" }} loading="lazy" onError={() => setOk(false)} />
          ) : (
            <div className="absolute inset-0 flex items-center justify-center"><Sparkles className="w-6 h-6" style={{ color: "rgba(255,255,255,0.4)" }} /></div>
          )}
          <div className="absolute inset-0" style={{ background: "linear-gradient(180deg, transparent 50%, rgba(0,0,0,0.55))" }} />
        </div>
      </div>
      <p className="font-body text-xs text-center mt-1.5 truncate">{ring.title}</p>
    </button>
  );
}

/* ---------- Full-screen viewer ---------- */
const SLIDE_MS = 5000;

function StoryViewer({ rings, openRingId, onClose, products, addToCart, openProduct, goCatalog }) {
  const [ringIdx, setRingIdx] = useState(0);
  const [slideIdx, setSlideIdx] = useState(0);
  const [paused, setPaused] = useState(false);
  const [activeTag, setActiveTag] = useState(null); // { productId } | null
  const [progress, setProgress] = useState(0); // 0..1 within the current slide
  const rafRef = useRef(null);
  const startRef = useRef(0);
  const pausedAtRef = useRef(0);
  const touchStartY = useRef(null);
  const touchStartX = useRef(null);

  const openIdx = openRingId ? rings.findIndex((r) => r.id === openRingId) : -1;
  const open = openIdx !== -1;

  // Sync to whichever ring was requested.
  useEffect(() => {
    if (open) { setRingIdx(openIdx); setSlideIdx(0); setActiveTag(null); }
  }, [openRingId]); // eslint-disable-line

  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = prev; };
  }, [open]);

  const ring = open ? rings[ringIdx] : null;
  const slide = ring ? ring.slides[slideIdx] : null;

  const goNextSlide = () => {
    if (!ring) return;
    if (slideIdx < ring.slides.length - 1) { setSlideIdx((i) => i + 1); setActiveTag(null); return; }
    // last slide of this ring — roll into the next ring, or close.
    if (ringIdx < rings.length - 1) { setRingIdx((i) => i + 1); setSlideIdx(0); setActiveTag(null); }
    else onClose();
  };
  const goPrevSlide = () => {
    if (!ring) return;
    if (slideIdx > 0) { setSlideIdx((i) => i - 1); setActiveTag(null); return; }
    if (ringIdx > 0) { const prevRing = rings[ringIdx - 1]; setRingIdx((i) => i - 1); setSlideIdx(prevRing.slides.length - 1); setActiveTag(null); }
  };

  // Auto-advance progress (rAF, pausable). A held tap or an open product
  // sheet pauses it — nobody wants the story to run away while they're
  // reading a price.
  useEffect(() => {
    if (!open || paused || activeTag) return;
    setProgress(0);
    startRef.current = performance.now();
    const tick = (t) => {
      const elapsed = t - startRef.current;
      const p = Math.min(1, elapsed / SLIDE_MS);
      setProgress(p);
      if (p >= 1) { goNextSlide(); return; }
      rafRef.current = requestAnimationFrame(tick);
    };
    rafRef.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(rafRef.current);
  }, [open, ringIdx, slideIdx, paused, activeTag]); // eslint-disable-line

  const onKeyDown = (e) => {
    if (e.key === "Escape") onClose();
    if (e.key === "ArrowRight") goNextSlide();
    if (e.key === "ArrowLeft") goPrevSlide();
  };

  const onTouchStart = (e) => { touchStartY.current = e.touches[0].clientY; touchStartX.current = e.touches[0].clientX; setPaused(true); };
  const onTouchEnd = (e) => {
    setPaused(false);
    if (touchStartY.current == null) return;
    const dy = e.changedTouches[0].clientY - touchStartY.current;
    const dx = e.changedTouches[0].clientX - touchStartX.current;
    if (dy > 80 && Math.abs(dx) < 60) { onClose(); return; } // swipe down closes
    if (Math.abs(dx) > 50 && Math.abs(dx) > Math.abs(dy)) { dx < 0 ? goNextSlide() : goPrevSlide(); }
  };

  if (!open || !slide) return null;

  const taggedProduct = activeTag ? products.find((p) => p.id === activeTag) : null;

  return (
    <div
      className="fixed inset-0 z-[70] search-fade"
      style={{ background: "#050505" }}
      onKeyDown={onKeyDown}
      tabIndex={-1}
      ref={(el) => el?.focus()}
    >
      <div
        className="relative w-full h-full mx-auto overflow-hidden"
        style={{ maxWidth: 460 }}
        onTouchStart={onTouchStart}
        onTouchEnd={onTouchEnd}
      >
        <StorySlideView slide={slide} onTagTap={(pid) => { setActiveTag(pid); setPaused(true); }} />

        {/* Progress bars — one segment per slide in the current ring */}
        <div className="absolute top-3 left-3 right-3 flex gap-1.5 z-10">
          {ring.slides.map((_, i) => (
            <div key={i} className="flex-1 rounded-full overflow-hidden" style={{ height: 2.5, background: "rgba(255,255,255,0.28)" }}>
              <div
                className="h-full rounded-full"
                style={{
                  width: i < slideIdx ? "100%" : i === slideIdx ? `${progress * 100}%` : "0%",
                  background: "#fff",
                  transition: i === slideIdx ? "none" : "width 0.2s",
                }}
              />
            </div>
          ))}
        </div>

        {/* Header: ring title + close */}
        <div className="absolute top-7 left-3 right-3 flex items-center justify-between z-10">
          <div className="flex items-center gap-2">
            <span className="font-body text-white text-sm font-medium" style={{ textShadow: "0 1px 4px rgba(0,0,0,0.5)" }}>{ring.title}</span>
          </div>
          <button onClick={onClose} className="rounded-full p-2 tap-scale" style={{ background: "rgba(0,0,0,0.35)" }} aria-label="Close">
            <X className="w-4 h-4 text-white" />
          </button>
        </div>

        {/* Tap zones for prev/next — kept below the tag layer via z-index */}
        <button className="absolute top-0 left-0 h-full z-[5]" style={{ width: "35%" }} onClick={goPrevSlide} aria-label="Previous" />
        <button className="absolute top-0 right-0 h-full z-[5]" style={{ width: "35%" }} onClick={goNextSlide} aria-label="Next" />

        {/* Caption */}
        {slide.caption && (
          <div className="absolute left-4 right-4 z-10" style={{ bottom: taggedProduct ? "auto" : 84 }}>
            <p className="font-body text-white text-sm" style={{ textShadow: "0 1px 6px rgba(0,0,0,0.6)" }}>{slide.caption}</p>
          </div>
        )}

        {/* Complete the look — related pieces, shown whenever this slide has a tag */}
        {slide.tags.length > 0 && !activeTag && (
          <CompleteTheLook slide={slide} products={products} onPick={(pid) => { setActiveTag(pid); setPaused(true); }} />
        )}

        {/* Quick-add bottom sheet for the tapped product */}
        {taggedProduct && (
          <StoryQuickAdd
            product={taggedProduct}
            onClose={() => { setActiveTag(null); setPaused(false); }}
            addToCart={addToCart}
            openProduct={openProduct}
          />
        )}
      </div>
    </div>
  );
}

function StorySlideView({ slide, onTagTap }) {
  if (slide.kind === "compare") return <CompareSlide slide={slide} />;
  return (
    <div className="absolute inset-0">
      <img src={productImageSrc(slide.image)} alt="" className="absolute inset-0 w-full h-full" style={{ objectFit: "cover" }} />
      <div className="absolute inset-0" style={{ background: "linear-gradient(180deg, rgba(0,0,0,0.35) 0%, transparent 20%, transparent 60%, rgba(0,0,0,0.55) 100%)" }} />
      {slide.tags.map((tag) => (
        <TagDot key={tag.productId + tag.x + tag.y} tag={tag} onTap={() => onTagTap(tag.productId)} />
      ))}
    </div>
  );
}

function TagDot({ tag, onTap }) {
  return (
    <button
      onClick={(e) => { e.stopPropagation(); onTap(); }}
      className="absolute z-[6] tap-scale"
      style={{ left: `${tag.x}%`, top: `${tag.y}%`, transform: "translate(-50%, -50%)" }}
      aria-label="Shop this piece"
    >
      <span className="tag-dot-ping" aria-hidden="true" />
      <span className="tag-dot" aria-hidden="true" />
    </button>
  );
}

/* Comparison slide: drag the vertical handle to reveal Oversized vs Regular
   (or Baggy vs Regular) on the same garment — the one thing here nobody
   else can build, since it needs the fit/subcategory data this shop already
   tracks. */
function CompareSlide({ slide }) {
  const [pos, setPos] = useState(50); // 0..100, % revealed of image B from the right
  const wrapRef = useRef(null);
  const dragging = useRef(false);

  const setFromClientX = (clientX) => {
    const el = wrapRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const pct = ((clientX - rect.left) / rect.width) * 100;
    setPos(Math.max(6, Math.min(94, pct)));
  };

  return (
    <div
      ref={wrapRef}
      className="absolute inset-0 select-none"
      onMouseDown={(e) => { dragging.current = true; setFromClientX(e.clientX); }}
      onMouseMove={(e) => { if (dragging.current) setFromClientX(e.clientX); }}
      onMouseUp={() => { dragging.current = false; }}
      onMouseLeave={() => { dragging.current = false; }}
      onTouchMove={(e) => setFromClientX(e.touches[0].clientX)}
    >
      <img src={productImageSrc(slide.image)} alt={slide.labelA} className="absolute inset-0 w-full h-full" style={{ objectFit: "cover" }} draggable={false} />
      <div className="absolute inset-0" style={{ clipPath: `inset(0 0 0 ${pos}%)` }}>
        <img src={productImageSrc(slide.imageB)} alt={slide.labelB} className="absolute inset-0 w-full h-full" style={{ objectFit: "cover" }} draggable={false} />
      </div>
      <div className="absolute inset-0" style={{ background: "linear-gradient(180deg, rgba(0,0,0,0.3) 0%, transparent 25%, transparent 65%, rgba(0,0,0,0.5) 100%)" }} />

      {/* Handle */}
      <div className="absolute top-0 bottom-0 z-[6]" style={{ left: `${pos}%`, transform: "translateX(-50%)", width: 2, background: "rgba(255,255,255,0.85)" }}>
        <div
          className="absolute top-1/2 left-1/2 rounded-full flex items-center justify-center"
          style={{ width: 40, height: 40, transform: "translate(-50%,-50%)", background: "rgba(255,255,255,0.95)", boxShadow: "0 4px 14px rgba(0,0,0,0.35)" }}
        >
          <span style={{ fontSize: 14 }}>↔</span>
        </div>
      </div>

      {/* Labels */}
      <div className="absolute top-16 left-4 z-[6]"><span className="a-story-chip">{slide.labelA}</span></div>
      <div className="absolute top-16 right-4 z-[6]"><span className="a-story-chip">{slide.labelB}</span></div>

      {slide.ctaCategory && (
        <div className="absolute left-4 right-4 z-[6] flex gap-2" style={{ bottom: 84 }}>
          <a href={`/shop/${slide.ctaCategory}${slide.ctaSubcategory ? `/${slide.ctaSubcategory}` : ""}`} className="flex-1 text-center rounded-full font-body text-xs py-2.5 tap-scale" style={{ background: "rgba(255,255,255,0.16)", backdropFilter: "blur(8px)", color: "#fff", border: "1px solid rgba(255,255,255,0.3)" }}>
            Shop {slide.labelA}
          </a>
        </div>
      )}
    </div>
  );
}

// Small strip suggesting nearby pieces so the story keeps the shopping
// going, not just a single pop-up sheet.
function CompleteTheLook({ slide, products, onPick }) {
  const tagged = slide.tags.map((t) => products.find((p) => p.id === t.productId)).filter(Boolean);
  if (tagged.length === 0) return null;
  const category = tagged[0].category;
  const excludeIds = new Set(tagged.map((p) => p.id));
  const more = products.filter((p) => p.category === category && !excludeIds.has(p.id)).slice(0, 4);
  const strip = [...tagged, ...more].slice(0, 5);

  return (
    <div
      className="absolute left-0 right-0 z-[6] px-4"
      style={{ bottom: isNativeApp ? "calc(20px + env(safe-area-inset-bottom, 0px))" : 20 }}
    >
      <p className="font-body text-white text-xs mb-2" style={{ opacity: 0.85, textShadow: "0 1px 4px rgba(0,0,0,0.5)" }}>Shop this look</p>
      <div className="flex gap-2 overflow-x-auto pb-1" style={{ WebkitOverflowScrolling: "touch" }}>
        {strip.map((p) => (
          <button key={p.id} onClick={(e) => { e.stopPropagation(); onPick(p.id); }} className="flex-shrink-0 rounded-xl overflow-hidden tap-scale" style={{ width: 52, height: 65, border: "1.5px solid rgba(255,255,255,0.5)" }}>
            {p.images?.[0]?.url ? (
              <img src={productImageSrc(p.images[0].url)} alt="" className="w-full h-full" style={{ objectFit: "cover" }} />
            ) : (
              <div className="w-full h-full flex items-center justify-center" style={{ background: "#222" }}><Shirt className="w-4 h-4 text-white" style={{ opacity: 0.5 }} /></div>
            )}
          </button>
        ))}
      </div>
    </div>
  );
}

// Bottom sheet: colour/size/qty/Add to cart, without leaving the story.
function StoryQuickAdd({ product, onClose, addToCart, openProduct }) {
  const [color, setColor] = useState(() => product.colors.find((c) => colorHasStock(product, c)) || product.colors[0]);
  const [size, setSize] = useState(() => product.sizes.find((s) => stockFor(product, color, s) > 0) || product.sizes[0]);
  const [added, setAdded] = useState(false);

  useEffect(() => {
    if (stockFor(product, color, size) <= 0) {
      const s = product.sizes.find((sz) => stockFor(product, color, sz) > 0);
      if (s) setSize(s);
    }
  }, [color]); // eslint-disable-line

  const available = stockFor(product, color, size);
  const outOfStock = product.soldOut || !productHasStock(product);
  const canAdd = !outOfStock && available > 0;

  const handleAdd = () => {
    if (!canAdd) return;
    addToCart(product, size, color, COLORS[color]?.label || color, 1);
    setAdded(true);
    setTimeout(() => setAdded(false), 1400);
  };

  return (
    <div className="absolute inset-x-0 bottom-0 z-20 search-rise" onClick={(e) => e.stopPropagation()}>
      <div className="glass rounded-t-3xl px-4 pt-4 pb-5" style={{ background: "rgba(20,20,24,0.88)", backdropFilter: "blur(20px)", borderColor: "rgba(255,255,255,0.14)" }}>
        <div className="flex justify-center mb-3"><span style={{ width: 36, height: 4, borderRadius: 4, background: "rgba(255,255,255,0.25)" }} /></div>
        <div className="flex items-center gap-3 mb-3">
          {product.images?.[0]?.url && (
            <img src={productImageSrc(product.images[0].url)} alt="" className="rounded-xl flex-shrink-0" style={{ width: 52, height: 65, objectFit: "cover" }} />
          )}
          <div className="flex-1 min-w-0">
            <p className="font-body text-white text-sm font-medium truncate">{product.name}</p>
            <p className="font-num text-white text-base">{money(effectivePrice(product))}
              {product.discount > 0 && <span className="font-num text-xs ml-2" style={{ color: "rgba(255,255,255,0.5)", textDecoration: "line-through" }}>{money(product.price)}</span>}
            </p>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-full tap-scale flex-shrink-0" style={{ background: "rgba(255,255,255,0.1)" }} aria-label="Close"><X className="w-3.5 h-3.5 text-white" /></button>
        </div>

        <div className="flex gap-1.5 mb-3 flex-wrap">
          {product.colors.map((c) => {
            const inStock = colorHasStock(product, c);
            return (
              <button key={c} onClick={() => inStock && setColor(c)} disabled={!inStock} className="rounded-full tap-scale" style={{ width: 26, height: 26, border: color === c ? "2px solid #fff" : "1px solid rgba(255,255,255,0.3)", opacity: inStock ? 1 : 0.3 }}>
                <span className="block w-full h-full rounded-full" style={{ background: swatchBackground(c) }} />
              </button>
            );
          })}
        </div>
        <div className="flex gap-1.5 mb-4 flex-wrap">
          {product.sizes.map((s) => {
            const inStock = stockFor(product, color, s) > 0;
            return (
              <button key={s} onClick={() => inStock && setSize(s)} disabled={!inStock} className="font-num text-xs px-3 py-1.5 rounded-full tap-scale" style={size === s ? { background: "#fff", color: "#111" } : { background: "rgba(255,255,255,0.1)", color: "#fff", opacity: inStock ? 1 : 0.35, textDecoration: inStock ? "none" : "line-through" }}>
                {s}
              </button>
            );
          })}
        </div>

        <div className="flex gap-2">
          <button onClick={() => openProduct(product)} className="rounded-full font-body text-sm px-4 py-3 tap-scale" style={{ border: "1px solid rgba(255,255,255,0.3)", color: "#fff" }}>
            View
          </button>
          <button onClick={handleAdd} disabled={!canAdd} className="flex-1 rounded-full font-body font-medium text-sm py-3 tap-scale flex items-center justify-center gap-2" style={{ background: canAdd ? "var(--coral)" : "rgba(255,255,255,0.15)", color: "#fff", opacity: canAdd ? 1 : 0.6 }}>
            {added ? <><Check className="w-4 h-4" /> Added</> : outOfStock || !canAdd ? "Out of stock" : <><ShoppingCart className="w-4 h-4" /> Add to cart</>}
          </button>
        </div>
      </div>
    </div>
  );
}

function HomeView({ products, loading, goCatalog, goSale, openProduct, likes, toggleLike, storyRings, openStory, appExclusiveCount }) {
  useEffect(() => {
    document.title = `${STORE_NAME} — Menswear from Saida, Lebanon`;
  }, []);

  const featured = products.slice(0, 8);
  const onSale = useMemo(() => products.filter(isOnSale), [products]);
  const saleCount = onSale.length;
  const maxDiscount = saleCount ? Math.max(...onSale.map((p) => p.discount)) : 0;
  const [spot, setSpot] = useState({ x: 50, y: 50 });

  const onHeroMove = (e) => {
    const rect = e.currentTarget.getBoundingClientRect();
    setSpot({ x: ((e.clientX - rect.left) / rect.width) * 100, y: ((e.clientY - rect.top) / rect.height) * 100 });
  };

  return (
    <div>
      <section onMouseMove={onHeroMove} className="relative px-4 sm:px-6 pt-10 sm:pt-16 pb-14 sm:pb-20 overflow-hidden">
        <MeshBackground variant="hero" />
        <div className="pointer-events-none absolute inset-0 transition-opacity duration-300" style={{ background: `radial-gradient(600px circle at ${spot.x}% ${spot.y}%, rgba(255,255,255,0.06), transparent 60%)` }} />
        <div className="max-w-6xl mx-auto relative">
          <div className="mb-6 hero-fade-1">
            <GlassChip tone="coral">
              <MapPin className="w-3 h-3" /> Saida, Lebanon
            </GlassChip>
          </div>
          <h1 className="font-display font-bold text-5xl sm:text-7xl leading-[1.05] max-w-3xl hero-fade-2">
            Kanaan Shop
            <span className="block text-coral">Everyday wear, refined</span>
          </h1>
          <p className="font-body text-muted text-base sm:text-lg max-w-xl mt-5 hero-fade-3">
            Timeless everyday pieces, thoughtfully selected with quality fabrics and flattering cuts.
          </p>
          {/* The promise line gets its own row: two glass chips that slide in
              one after the other, with a soft breathing glow — the first thing
              a Lebanese shopper wants to know, made unmissable. */}
          <div className="flex items-center gap-2.5 mt-4 flex-wrap">
            <span className="glass promise-chip promise-chip-1 inline-flex items-center gap-2 rounded-full px-4 py-2 font-body text-sm">
              <Truck className="w-4 h-4 text-teal" /> Delivery across Lebanon
            </span>
            <span className="promise-divider" aria-hidden="true" />
            <span className="glass promise-chip promise-chip-2 inline-flex items-center gap-2 rounded-full px-4 py-2 font-body text-sm">
              <ShieldCheck className="w-4 h-4 text-teal" /> Cash on delivery
            </span>
          </div>
          <div className="flex items-center gap-3 mt-8 hero-fade-4">
            <Magnetic>
              <button onClick={() => goCatalog("all")} className="glass glass-btn rounded-full font-body font-medium px-6 py-3 tap-scale" style={{ background: "var(--coral)", color: "#fff", borderColor: "var(--coral)" }}>
                Shop now
              </button>
            </Magnetic>
            <button onClick={() => goCatalog("sets")} className="glass rounded-full font-body px-6 py-3 tap-scale hover:opacity-80 transition-opacity">
              Explore pairings
            </button>
          </div>
        </div>
      </section>

      {storyRings.length > 0 && <StoryRail rings={storyRings} onOpen={openStory} />}

      <section className="max-w-6xl mx-auto px-4 sm:px-6 py-10">
        <div className="grid grid-cols-2 lg:grid-cols-4 lg:grid-rows-2 gap-4">
          <Reveal className="col-span-2">
            <div className="glass glass-sheen rounded-3xl p-6 h-full flex flex-col justify-between relative overflow-hidden" style={{ minHeight: 150 }}>
              <MeshBackground variant="card" />
              <div className="relative">
                <Sparkles className="w-5 h-5 text-coral mb-3" />
                <p className="font-display font-bold text-xl leading-snug">New season<br />just landed</p>
              </div>
              <button onClick={() => goCatalog("all")} className="relative font-body text-sm text-coral hover:underline self-start mt-4">
                Explore the drop →
              </button>
            </div>
          </Reveal>

          {/* Sits directly under "New season", same width. Only appears when
              something is actually discounted — a Sale door opening onto an
              empty room does more harm than good. */}
          {saleCount > 0 && (
            <Reveal className="col-span-2 lg:row-start-2" delay={60}>
              <SaleCard onOpen={goSale} count={saleCount} maxDiscount={maxDiscount} />
            </Reveal>
          )}
          {[
            { icon: Truck, label: "Delivery all over Lebanon" },
            { icon: ShieldCheck, label: "Cash on delivery" },
            { icon: RotateCcw, label: "Easy 3-day returns" },
            { icon: BadgeCheck, label: "Premium. Fresh. Always." },
          ].map(({ icon: Icon, label }, i) => (
            <Reveal key={label} delay={i * 80}>
              <div className="glass rounded-3xl p-5 h-full flex flex-col justify-between" style={{ minHeight: 150 }}>
                <Icon className="w-5 h-5 text-teal" />
                <span className="font-body text-sm text-muted mt-3">{label}</span>
              </div>
            </Reveal>
          ))}
        </div>
      </section>

      <section className="max-w-6xl mx-auto px-4 sm:px-6 pb-14">
        <div className="flex items-center justify-between mb-6">
          <h2 className="font-display font-bold text-2xl">New in</h2>
          <button onClick={() => goCatalog("all")} className="font-body text-sm text-coral hover:underline">See all</button>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 sm:gap-6">
          {loading && featured.length === 0
            ? Array.from({ length: 4 }).map((_, i) => (
                <div key={i} className="rounded-2xl glass" style={{ aspectRatio: "4/5", opacity: 0.5 }} />
              ))
            : featured.map((p, i) => (
                <Reveal key={p.id} delay={i * 60}>
                  <ProductCard product={p} onOpen={openProduct} liked={likes.includes(p.id)} onToggleLike={() => toggleLike(p.id)} />
                </Reveal>
              ))}
        </div>
        {!loading && featured.length === 0 && (
          <p className="font-body text-muted text-sm text-center py-8">Products are on their way — check back soon.</p>
        )}
      </section>

      {/* Mobile app teaser — bento-style, moved here from the footer */}
      <section className="max-w-6xl mx-auto px-4 sm:px-6 pb-20">
        <Reveal>
          <div className="glass glass-sheen rounded-3xl p-8 sm:p-10 relative overflow-hidden text-center sm:text-left">
            <MeshBackground variant="card" />
            <div className="relative flex flex-col sm:flex-row items-center sm:items-center gap-5 justify-between">
              <div className="flex flex-col sm:flex-row items-center gap-4">
                <div className="glass rounded-2xl p-3">
                  <Smartphone className="w-7 h-7 text-coral" />
                </div>
                <div>
                  <p className="font-display font-bold text-xl">
                    {appExclusiveCount > 0 ? "🔥 App-only prices, waiting" : "Coming soon"}
                  </p>
                  <p className="font-body text-sm text-muted mt-1 max-w-sm">
                    {appExclusiveCount > 0
                      ? `${appExclusiveCount} piece${appExclusiveCount === 1 ? "" : "s"} are priced lower right now — visible only in the Kanaan Shop app.`
                      : "The Kanaan Shop app is on its way — a faster, native way to shop from your phone."}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <GlassChip>Android</GlassChip>
                <GlassChip>iPhone</GlassChip>
              </div>
            </div>
          </div>
        </Reveal>
      </section>
    </div>
  );
}

/* ============================================================
   NATIVE HOME — الصفحة الرئيسية الحصرية للتطبيق (أندرويد/آيفون).
   عمداً مبنية مختلفة تماماً عن هوم الموقع: مش صفحة تسويقية بمقدمة
   وشرح، إنما "dashboard" سريع بأسلوب تطبيقات التسوق الحقيقية —
   ترحيب، وصول سريع لكل قسم ببلاطات، وشريط "جديد" أفقي. أول ثانية
   بتفتح فيها التطبيق لازم تحس فرق واضح عن فتح الموقع بالمتصفح.
   ============================================================ */
/* ============================================================
   SPOTLIGHT CARD — بطاقة تحريرية بمنتج واحد مميز، بصورة حقيقية
   كبيرة، بدل ما كل شي عالهوم يبين متل بعضه بشبكة موحّدة.
   ============================================================ */
function SpotlightCard({ product, onOpen }) {
  const img = getImages(product)[0];
  return (
    <button
      onClick={() => onOpen(product)}
      className="relative w-full rounded-3xl overflow-hidden text-left tap-scale block"
      style={{ aspectRatio: "16/11" }}
    >
      {img ? (
        <img src={img} alt={product.name} className="absolute inset-0 w-full h-full object-cover" />
      ) : (
        <div className="absolute inset-0" style={{ background: "linear-gradient(135deg, var(--coral), #ff7a52)" }} />
      )}
      <div className="absolute inset-0" style={{ background: "linear-gradient(to top, rgba(10,10,12,0.85), rgba(10,10,12,0.05) 60%)" }} />
      <div className="absolute bottom-0 left-0 right-0 p-4">
        <GlassChip tone="coral">Just landed</GlassChip>
        <p className="font-display font-bold text-xl mt-2 leading-tight" style={{ color: "#fff" }}>{product.name}</p>
        <p className="font-num text-base mt-0.5" style={{ color: "rgba(255,255,255,0.9)" }}>{money(effectivePrice(product))}</p>
      </div>
    </button>
  );
}

function NativeHomeView({ products, loading, goCatalog, goSale, goExclusives, openProduct, likes, toggleLike, storyRings, openStory, goFavorites, onCart, cartCount }) {
  useEffect(() => {
    document.title = `${STORE_NAME} — Menswear from Saida, Lebanon`;
  }, []);

  const hour = new Date().getHours();
  const greeting = hour < 5 ? "Still up?" : hour < 12 ? "Good morning" : hour < 18 ? "Good afternoon" : "Good evening";

  const spotlight = products.find((p) => p.isSpotlight) || products.find((p) => p.badge === "new") || products[0] || null;
  const featured = products.filter((p) => !spotlight || p.id !== spotlight.id).slice(0, 10);
  const onSale = useMemo(() => products.filter(isOnSale), [products]);
  const saleCount = onSale.length;
  const maxDiscount = saleCount ? Math.max(...onSale.map((p) => p.discount)) : 0;
  const exclusives = useMemo(() => products.filter((p) => p.appExclusive), [products]);

  const recentIds = getRecentlyViewed();
  const recentProducts = recentIds.map((id) => products.find((p) => p.id === id)).filter(Boolean).slice(0, 8);

  return (
    <div className="pb-4" style={{ paddingTop: "env(safe-area-inset-top, 0px)" }}>
      {/* ترحيب — بديل الهيرو التسويقي، هوية "أنا تطبيق" فوراً. توهج
          خفيف دايم خلف الترحيب (بغض النظر عن الثيم) — إشارة بصرية
          صغيرة بس ثابتة إنو هاد تطبيق إلو شخصيته، مش نسخة من الموقع. */}
      <section className="relative px-4 sm:px-6 pt-6 pb-4 overflow-hidden">
        <div
          className="absolute pointer-events-none"
          style={{
            top: -60, right: -40, width: 220, height: 220, borderRadius: "50%",
            background: "radial-gradient(circle, var(--coral) 0%, transparent 70%)",
            opacity: 0.16, filter: "blur(40px)",
          }}
        />
        <div className="relative flex items-center justify-between">
          <div>
            <p className="font-body text-sm text-muted">{greeting} 👋</p>
            <h1 className="font-display font-bold text-2xl mt-0.5">What are you after today?</h1>
          </div>
          <LogoMark variant="compact" className="h-7 w-auto opacity-90" />
        </div>
      </section>

      {/* بلاطتين سريعتين — سلة ومفضلة، بدل ما تدور عليهم بالهيدر */}
      <section className="px-4 sm:px-6 pb-7">
        <div className="grid grid-cols-2 gap-3">
          <button onClick={goFavorites} className="glass rounded-2xl p-4 flex items-center gap-3 tap-scale text-left">
            <div className="glass rounded-xl p-2" style={{ background: "rgba(255,69,34,0.12)" }}>
              <Heart className="w-5 h-5 text-coral" />
            </div>
            <div>
              <p className="font-display font-bold text-lg leading-none">{likes.length}</p>
              <p className="font-body text-xs text-muted mt-1">Favorites</p>
            </div>
          </button>
          <button onClick={onCart} className="glass rounded-2xl p-4 flex items-center gap-3 tap-scale text-left">
            <div className="glass rounded-xl p-2" style={{ background: "rgba(18,179,160,0.12)" }}>
              <ShoppingCart className="w-5 h-5 text-teal" />
            </div>
            <div>
              <p className="font-display font-bold text-lg leading-none">{cartCount}</p>
              <p className="font-body text-xs text-muted mt-1">In your cart</p>
            </div>
          </button>
        </div>
      </section>

      {storyRings.length > 0 && <StoryRail rings={storyRings} onOpen={openStory} />}

      {/* بطاقة Spotlight — منتج واحد مميز بصورة حقيقية كبيرة */}
      {spotlight && !loading && (
        <section className="px-4 sm:px-6 pb-7">
          <SpotlightCard product={spotlight} onOpen={openProduct} />
        </section>
      )}

      {/* شبكة فئات بصفّين، بألوان متبادلة كورال/تيل — أحيا بصرياً
          من رمادي موحّد، وبنفس ألوان الهوية بدون إضافة لون جديد */}
      <section className="pb-7">
        <div className="px-4 sm:px-6 flex items-center justify-between mb-3">
          <h2 className="font-display font-bold text-lg">Browse</h2>
          <button onClick={() => goCatalog("all")} className="font-body text-sm text-coral">See all</button>
        </div>
        <div className="px-4 sm:px-6 grid grid-cols-5 gap-2">
          {BROWSE_GRID_CATEGORIES.map((c, i) => {
            const coral = i % 2 === 0;
            return (
              <button
                key={c.id}
                onClick={() => goCatalog(c.id)}
                className="glass rounded-xl flex flex-col items-center justify-center gap-1.5 tap-scale"
                style={{ aspectRatio: "1/1" }}
              >
                <span
                  className="rounded-lg flex items-center justify-center"
                  style={{ width: 26, height: 26, background: coral ? "rgba(255,69,34,0.14)" : "rgba(18,179,160,0.14)" }}
                >
                  <IconFor type={iconForCategory(c.id)} className="w-3.5 h-3.5" style={{ color: coral ? "var(--coral)" : "var(--teal)" }} />
                </span>
                <span className="font-body text-[9px] text-center leading-tight px-0.5">{c.label}</span>
              </button>
            );
          })}
        </div>
        {/* "Old Money Collection" مو فئة عادية زي الباقي — هي كولكشن
            منسّق، فبتستاهل بطاقة خاصة أوضح بدل ما تضيع بنفس شبكة
            الفئات (وهيك كمان الشبكة فوق بتصير متوازنة 5+5 تماماً). */}
        {(() => {
          const oldMoney = CATEGORIES.find((c) => c.id === "oldmoney");
          return oldMoney ? (
            <button
              onClick={() => goCatalog(oldMoney.id)}
              className="glass rounded-2xl mx-4 sm:mx-6 mt-3 p-4 flex items-center gap-3 tap-scale text-left"
              style={{ background: "linear-gradient(120deg, rgba(20,20,20,0.06), rgba(255,69,34,0.06))" }}
            >
              <span className="rounded-xl flex items-center justify-center flex-shrink-0" style={{ width: 40, height: 40, background: "rgba(20,20,20,0.08)" }}>
                <IconFor type={iconForCategory(oldMoney.id)} className="w-5 h-5" style={{ color: "var(--fg)" }} />
              </span>
              <div className="min-w-0">
                <p className="font-display font-bold text-sm">Old Money Collection</p>
                <p className="font-body text-xs text-muted">A curated edit, not just another category</p>
              </div>
            </button>
          ) : null;
        })()}
      </section>

      {saleCount > 0 && (
        <section className="px-4 sm:px-6 pb-7">
          <SaleCard onOpen={goSale} count={saleCount} maxDiscount={maxDiscount} />
        </section>
      )}

      {/* App Exclusives — حصري 100% للتطبيق، هوية بصرية غامقة مميّزة
          (مش نفس أسلوب باقي الصفحة) حتى يحس المستخدم إنو داخل "منطقة
          خاصة" ما بيوصلها أي حدا عالموقع. */}
      {exclusives.length > 0 && (
        <section className="pb-7">
          <div className="px-4 sm:px-6 flex items-center justify-between mb-3">
            <h2 className="font-display font-bold text-lg flex items-center gap-1.5">
              🔥 App Exclusives
            </h2>
            <button onClick={goExclusives} className="font-body text-sm text-coral">See all</button>
          </div>
          <div
            className="mx-4 sm:mx-6 rounded-3xl p-4 pb-5"
            style={{ background: "#141416" }}
          >
            <p className="font-body text-xs mb-3" style={{ color: "rgba(255,255,255,0.55)" }}>
              Prices you won't find on the website — app only.
            </p>
            <div className="flex gap-3 overflow-x-auto pb-1" style={{ scrollbarWidth: "none" }}>
              {exclusives.slice(0, 8).map((p) => (
                <button key={p.id} onClick={() => openProduct(p)} className="flex-shrink-0 text-left tap-scale" style={{ width: 118 }}>
                  <div className="relative rounded-xl overflow-hidden" style={{ aspectRatio: "4/5", background: "#232326" }}>
                    {getImages(p)[0] ? (
                      <img src={getImages(p)[0]} alt={p.name} className="absolute inset-0 w-full h-full object-cover" />
                    ) : (
                      <div className="absolute inset-0 flex items-center justify-center">
                        <IconFor type={p.icon} className="w-8 h-8" style={{ color: "rgba(255,255,255,0.3)" }} />
                      </div>
                    )}
                    <span
                      className="absolute top-2 left-2 rounded-full px-2 py-0.5 font-num text-[9px]"
                      style={{ background: "var(--coral)", color: "#fff" }}
                    >
                      🔥 App only
                    </span>
                  </div>
                  <p className="font-body text-xs mt-2 truncate" style={{ color: "rgba(255,255,255,0.9)" }}>{p.name}</p>
                  <p className="font-num text-sm" style={{ color: "var(--coral)" }}>{money(effectivePrice(p))}</p>
                </button>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* "شفتها مؤخراً" — تخصيص حقيقي، حصري للتطبيق، ما بيظهر أبداً
          إذا ما في تاريخ تصفّح لسا */}
      {recentProducts.length > 0 && (
        <section className="pb-7">
          <div className="px-4 sm:px-6 flex items-center gap-2 mb-3">
            <RotateCcw className="w-4 h-4 text-muted" />
            <h2 className="font-display font-bold text-lg">Recently viewed</h2>
          </div>
          <div className="flex gap-4 overflow-x-auto px-4 sm:px-6 pb-1" style={{ scrollbarWidth: "none" }}>
            {recentProducts.map((p) => (
              <div key={p.id} className="flex-shrink-0" style={{ width: 130 }}>
                <ProductCard product={p} onOpen={openProduct} liked={likes.includes(p.id)} onToggleLike={() => toggleLike(p.id)} />
              </div>
            ))}
          </div>
        </section>
      )}

      {/* شريط "جديد" أفقي — قابل للسحب، بدل شبكة ثابتة، إحساس تطبيق أكتر */}
      <section className="pb-7">
        <div className="px-4 sm:px-6 flex items-center justify-between mb-3">
          <h2 className="font-display font-bold text-lg">New in</h2>
          <button onClick={() => goCatalog("all")} className="font-body text-sm text-coral">See all</button>
        </div>
        {loading && products.length === 0 ? (
          <div className="flex gap-4 px-4 sm:px-6 overflow-x-hidden">
            {Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="rounded-2xl glass flex-shrink-0" style={{ width: 150, aspectRatio: "4/5", opacity: 0.5 }} />
            ))}
          </div>
        ) : featured.length === 0 ? (
          <p className="font-body text-sm text-muted px-4 sm:px-6">Products are on their way — check back soon.</p>
        ) : (
          <div className="flex gap-4 overflow-x-auto px-4 sm:px-6 pb-1" style={{ scrollbarWidth: "none" }}>
            {featured.map((p) => (
              <div key={p.id} className="flex-shrink-0" style={{ width: 150 }}>
                <ProductCard product={p} onOpen={openProduct} liked={likes.includes(p.id)} onToggleLike={() => toggleLike(p.id)} />
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}

/* ============================================================
   PRIVACY POLICY — صفحة حقيقية منشورة، مطلوبة من Google Play
   (ومن Apple لاحقاً) كرابط فعلي بصفحة المتجر. النص بيعكس فعلياً
   شو البيانات يلي بيجمعها الموقع/التطبيق — ما في شي مبالغ فيه أو
   ناقص عن الواقع.
   ============================================================ */
function PrivacyPolicyView() {
  useEffect(() => {
    document.title = `Privacy Policy — ${STORE_NAME}`;
  }, []);

  const Section = ({ title, children }) => (
    <div className="mb-7">
      <h2 className="font-display font-bold text-lg mb-2">{title}</h2>
      <div className="font-body text-sm text-muted leading-7 space-y-2">{children}</div>
    </div>
  );

  return (
    <div className="max-w-2xl mx-auto px-4 sm:px-6 py-10">
      <h1 className="font-display font-bold text-3xl mb-1">Privacy Policy</h1>
      <p className="font-body text-sm text-muted mb-8">Last updated: {new Date().toLocaleDateString("en-GB", { year: "numeric", month: "long", day: "numeric" })}</p>

      <Section title="Who we are">
        <p>{STORE_NAME} is a menswear brand based in Saida, Lebanon, operating this website and mobile app. This policy explains what information we collect when you use either, and how it's used.</p>
      </Section>

      <Section title="Information we collect">
        <p><strong>When you place an order:</strong> your name, phone number, delivery address, and any notes you add. This is sent as a WhatsApp message to our order number and stored in our order system so we can prepare and track your delivery.</p>
        <p><strong>Cart, favorites, and recently viewed items:</strong> stored only on your own device (browser or app storage), not on our servers, except for the items in your cart at the moment you check out.</p>
        <p><strong>Push notifications (app only):</strong> if you allow notifications, we store a device identifier (not tied to your name) so we can send you updates about sales and new arrivals. You can turn this off anytime in your phone's settings.</p>
        <p><strong>Basic technical data:</strong> standard web request information (like IP address and browser type), handled by our hosting provider for security and performance — not used to build advertising profiles.</p>
      </Section>

      <Section title="What we don't collect">
        <p>We don't require an account, a password, or an email address to shop. We don't process online payments — all orders are cash on delivery — so we never see or store card details.</p>
      </Section>

      <Section title="Who we share information with">
        <p>Your order details are shared with our delivery process only. We use the following services to run the store, each governed by their own privacy policy: Cloudflare (hosting), Google Firebase (push notification delivery), and WhatsApp (order communication). We do not sell personal information to anyone, and we don't use advertising or tracking networks.</p>
      </Section>

      <Section title="How long we keep it">
        <p>Order information is kept for as long as needed for business and inventory records. Push notification identifiers are removed automatically if the app is uninstalled or notifications are disabled.</p>
      </Section>

      <Section title="Children">
        <p>{STORE_NAME} is not directed at children, and we don't knowingly collect information from anyone under 13.</p>
      </Section>

      <Section title="Your choices">
        <p>You can ask us to delete your order history or stop contacting you at any time by reaching out on WhatsApp. You can also clear your cart, favorites, and browsing history at any time by clearing your browser or app storage.</p>
      </Section>

      <Section title="Contact us">
        <p>Questions about this policy or your information? Message us on WhatsApp — the number is on our homepage and checkout page — and we'll get back to you.</p>
      </Section>
    </div>
  );
}

/* ============================================================
   APP EXCLUSIVES — صفحة "See all" للمنتجات الحصرية. بما إنو الـ
   API أصلاً بتصفّي هالمنتجات عن غير التطبيق (هيدر X-Kanaan-Client)،
   هاي الصفحة عملياً ما رح توصلها فاضية أو خطأ لو حد فتحها بالموقع —
   بس منحطلها بوابة صريحة كمان كطبقة حماية إضافية وتوضيح للمستخدم.
   ============================================================ */
function ExclusivesView({ products, loading, likes, openProduct, toggleLike }) {
  useEffect(() => {
    document.title = `App Exclusives — ${STORE_NAME}`;
  }, []);

  if (!isNativeApp) return <ExclusivesLockedView />;

  const exclusives = products.filter((p) => p.appExclusive);

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 py-6">
      <div className="rounded-3xl p-5 mb-6" style={{ background: "#141416" }}>
        <h1 className="font-display font-bold text-2xl" style={{ color: "#fff" }}>🔥 App Exclusives</h1>
        <p className="font-body text-sm mt-1" style={{ color: "rgba(255,255,255,0.6)" }}>
          Prices only visible here — not on the website, not searchable, app-only.
        </p>
      </div>

      {loading && exclusives.length === 0 ? (
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="rounded-2xl glass" style={{ aspectRatio: "4/5", opacity: 0.5 }} />
          ))}
        </div>
      ) : exclusives.length === 0 ? (
        <p className="font-body text-sm text-muted text-center py-16">Nothing exclusive up right now — check back soon.</p>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
          {exclusives.map((p) => (
            <ProductCard key={p.id} product={p} onOpen={openProduct} liked={likes.includes(p.id)} onToggleLike={() => toggleLike(p.id)} />
          ))}
        </div>
      )}
    </div>
  );
}

/* لو حدا وصل لهالمسار من الموقع (رابط مباشر مثلاً) — رسالة واضحة
   واحترافية، مش صفحة فاضية أو خطأ غامض. */
function ExclusivesLockedView() {
  return (
    <div className="max-w-lg mx-auto px-4 sm:px-6 py-24 text-center">
      <div className="glass w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-6">
        <span style={{ fontSize: 26 }}>🔒</span>
      </div>
      <h1 className="font-display font-bold text-2xl mb-2">App-only pricing</h1>
      <p className="font-body text-muted mb-8 max-w-sm mx-auto">
        This section is exclusive to the Kanaan Shop app — download it on iPhone or Android to see these prices.
      </p>
      <div className="flex items-center justify-center gap-2">
        <GlassChip>Android</GlassChip>
        <GlassChip>iPhone</GlassChip>
      </div>
    </div>
  );
}

/* ============================================================
   FAVORITES / WISHLIST — الصفحة اللي بتظهر عليها كل المنتجات
   اللي المستخدم عمل عليها heart. موجودة أساساً للتطبيق (تبويب
   بالشريط السفلي)، بس بتشتغل بنفس المنطق لو حد وصلها من الموقع.
   ============================================================ */
function FavoritesView({ products, loading, likes, openProduct, toggleLike, goCatalog }) {
  useEffect(() => {
    document.title = `Favorites — ${STORE_NAME}`;
  }, []);

  const favProducts = products.filter((p) => likes.includes(p.id));

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 py-10">
      <h1 className="font-display font-bold text-3xl mb-1">Favorites</h1>
      <p className="font-body text-sm text-muted mb-8">Pieces you've saved to come back to.</p>

      {loading && products.length === 0 ? (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4 sm:gap-6">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="rounded-2xl glass" style={{ aspectRatio: "4/5", opacity: 0.5 }} />
          ))}
        </div>
      ) : favProducts.length === 0 ? (
        <div className="text-center py-16">
          <Heart className="w-10 h-10 text-muted mx-auto mb-3" style={{ opacity: 0.3 }} />
          <p className="font-body text-sm text-muted mb-4">Nothing saved yet — tap the heart on any piece to add it here.</p>
          <button onClick={() => goCatalog("all")} className="text-coral font-body text-sm hover:underline">Browse the shop</button>
        </div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4 sm:gap-6">
          {favProducts.map((p, i) => (
            <Reveal key={p.id} delay={(i % 8) * 50}>
              <ProductCard product={p} onOpen={openProduct} liked={true} onToggleLike={() => toggleLike(p.id)} />
            </Reveal>
          ))}
        </div>
      )}
    </div>
  );
}

/* ============================================================
   CATALOG
   ============================================================ */
const PAGE_SIZE = 12;

function CatalogView({ activeCategory, activeSub, loading, goCatalog, products, openProduct, likes, toggleLike }) {
  const label = activeCategory === "all" ? "Shop" : CATEGORIES.find((c) => c.id === activeCategory)?.label || "Shop";
  const [shown, setShown] = useState(PAGE_SIZE);
  const subs = subsFor(activeCategory);

  useEffect(() => {
    const suffix = activeSub ? ` — ${subLabel(activeCategory, activeSub)}` : "";
    document.title = `${label}${suffix} — ${STORE_NAME}`;
  }, [label, activeCategory, activeSub]);

  // Start from the top of the list again when the category or fit changes.
  useEffect(() => { setShown(PAGE_SIZE); }, [activeCategory, activeSub]);

  const visible = products.slice(0, shown);
  const remaining = products.length - visible.length;

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 py-10">
      <h1 className="font-display font-bold text-3xl mb-1">
        {activeCategory === "all" ? "Shop" : label}
      </h1>
      {activeSub && (
        <p className="font-body text-sm text-coral mb-5">{subLabel(activeCategory, activeSub)}</p>
      )}
      {!activeSub && <div className="mb-5" />}

      <div className="flex flex-wrap gap-2 mb-4">
        <button
          onClick={() => goCatalog("all")}
          className="font-body text-sm px-4 py-2 rounded-full tap-scale transition-all"
          style={activeCategory === "all" ? { background: "var(--fg)", color: "var(--bg)" } : { background: "var(--glass-bg)", border: "1px solid var(--glass-border)", color: "var(--fg-muted)" }}
        >
          All
        </button>
        {CATEGORIES.map((c) => (
          <button
            key={c.id}
            onClick={() => goCatalog(c.id)}
            className="font-body text-sm px-4 py-2 rounded-full tap-scale transition-all"
            style={activeCategory === c.id ? { background: "var(--fg)", color: "var(--bg)" } : { background: "var(--glass-bg)", border: "1px solid var(--glass-border)", color: "var(--fg-muted)" }}
          >
            {c.label}
          </button>
        ))}
      </div>

      {/* Fits — only for the categories that have them (Jeans, T-Shirts).
          Secondary styling on purpose: it's a refinement, not a new aisle. */}
      {subs.length > 0 && (
        <div className="flex flex-wrap items-center gap-2 mb-8">
          <span className="font-body text-xs text-muted mr-1">Fit</span>
          <button
            onClick={() => goCatalog(activeCategory)}
            className="font-body text-xs px-3 py-1.5 rounded-full tap-scale transition-all"
            style={!activeSub
              ? { background: "var(--coral)", color: "#fff" }
              : { background: "var(--glass-bg)", border: "1px solid var(--glass-border)", color: "var(--fg-muted)" }}
          >
            All fits
          </button>
          {subs.map((sb) => (
            <button
              key={sb.id}
              onClick={() => goCatalog(activeCategory, sb.id)}
              className="font-body text-xs px-3 py-1.5 rounded-full tap-scale transition-all"
              style={activeSub === sb.id
                ? { background: "var(--coral)", color: "#fff" }
                : { background: "var(--glass-bg)", border: "1px solid var(--glass-border)", color: "var(--fg-muted)" }}
            >
              {sb.label}
            </button>
          ))}
        </div>
      )}
      {subs.length === 0 && <div className="mb-4" />}

      {loading && products.length === 0 ? (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4 sm:gap-6">
          {Array.from({ length: 8 }).map((_, i) => (
            <div key={i} className="rounded-2xl glass" style={{ aspectRatio: "4/5", opacity: 0.5 }} />
          ))}
        </div>
      ) : products.length === 0 ? (
        <p className="font-body text-muted py-16 text-center">
          {activeSub ? `No ${subLabel(activeCategory, activeSub).toLowerCase()} pieces here yet.` : "No products in this category yet."}
        </p>
      ) : (
        <>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4 sm:gap-6">
            {visible.map((p, i) => (
              <Reveal key={p.id} delay={(i % 8) * 50}>
                <ProductCard product={p} onOpen={openProduct} liked={likes.includes(p.id)} onToggleLike={() => toggleLike(p.id)} />
              </Reveal>
            ))}
          </div>

          {remaining > 0 && (
            <div className="flex flex-col items-center gap-3 mt-10">
              <p className="font-body text-xs text-muted">
                Showing {visible.length} of {products.length}
              </p>
              <button
                onClick={() => setShown((n) => n + PAGE_SIZE)}
                className="glass glass-btn rounded-full font-body font-medium px-8 py-3 tap-scale flex items-center gap-2"
              >
                Load {Math.min(remaining, PAGE_SIZE)} more
                <ChevronDown className="w-4 h-4" />
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );
}

/* ============================================================
   PRODUCT DETAIL
   ============================================================ */
/* ============================================================
   SIZE GUIDE — general clothing/shoe size chart.
   ⚠️ These are common industry-standard approximations, not measured
   from Kanaan Shop's actual garments — update the numbers if the
   real fit differs.
   ============================================================ */
const CLOTHING_SIZE_CHART = [
  { size: "S", chest: "88–92", waist: "74–78" },
  { size: "M", chest: "96–100", waist: "82–86" },
  { size: "L", chest: "104–108", waist: "90–94" },
  { size: "XL", chest: "112–116", waist: "98–102" },
  { size: "XXL", chest: "120–124", waist: "106–110" },
];
const SHOE_SIZE_CHART = [
  { eu: "40", cm: "25.0" },
  { eu: "41", cm: "25.7" },
  { eu: "42", cm: "26.3" },
  { eu: "43", cm: "27.0" },
  { eu: "44", cm: "27.7" },
  { eu: "45", cm: "28.3" },
];

function SizeGuideModal({ category, onClose }) {
  const isShoe = category === "shoes";
  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center sm:justify-center" onClick={onClose}>
      <div className="absolute inset-0" style={{ background: "rgba(0,0,0,0.5)" }} />
      <div
        onClick={(e) => e.stopPropagation()}
        className="glass relative w-full sm:max-w-sm rounded-t-3xl sm:rounded-3xl p-6"
        style={{ paddingBottom: "calc(1.5rem + env(safe-area-inset-bottom, 0px))" }}
      >
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-display font-bold text-lg">Size guide</h2>
          <button onClick={onClose} className="p-1 tap-scale" aria-label="Close"><X className="w-5 h-5" /></button>
        </div>

        <table className="w-full font-body text-sm">
          <thead>
            <tr className="text-left text-muted" style={{ borderBottom: "1px solid var(--border)" }}>
              <th className="pb-2 font-medium">{isShoe ? "EU" : "Size"}</th>
              <th className="pb-2 font-medium">{isShoe ? "Foot length (cm)" : "Chest (cm)"}</th>
              {!isShoe && <th className="pb-2 font-medium">Waist (cm)</th>}
            </tr>
          </thead>
          <tbody>
            {(isShoe ? SHOE_SIZE_CHART : CLOTHING_SIZE_CHART).map((row) => (
              <tr key={row.size || row.eu} style={{ borderBottom: "1px solid var(--border)" }}>
                <td className="py-2 font-num">{row.size || row.eu}</td>
                <td className="py-2 font-num text-muted">{row.chest || row.cm}</td>
                {!isShoe && <td className="py-2 font-num text-muted">{row.waist}</td>}
              </tr>
            ))}
          </tbody>
        </table>

        <p className="font-body text-xs text-muted mt-4">
          General guide — fit can vary slightly between styles. Unsure? Message us on WhatsApp before you order.
        </p>
      </div>
    </div>
  );
}

function ProductView({ product, products, addToCart, openProduct, liked, toggleLike }) {
  const [size, setSize] = useState(product.sizes[0]);
  const [color, setColor] = useState(product.colors[0]);
  const [qty, setQty] = useState(1);
  const [added, setAdded] = useState(false);
  const [copied, setCopied] = useState(false);
  const [notifyState, setNotifyState] = useState("idle"); // idle | loading | done | unavailable
  const [showSizeGuide, setShowSizeGuide] = useState(false);

  useEffect(() => {
    // Start on a colour/size that's actually in stock where possible.
    const firstColor = product.colors.find((c) => colorHasStock(product, c)) || product.colors[0];
    setColor(firstColor);
    setSize(product.sizes.find((s) => stockFor(product, firstColor, s) > 0) || product.sizes[0]);
    setQty(1);
    setAdded(false);
    addRecentlyViewed(product.id);
  }, [product.id]); // eslint-disable-line

  useEffect(() => {
    document.title = `${product.name} — ${STORE_NAME}`;
  }, [product.name]);

  const related = products.filter((p) => p.category === product.category && p.id !== product.id).slice(0, 3);
  const productUrl = `${SITE_URL}/product/${product.slug}`;

  const available = stockFor(product, color, size);
  const outOfStock = product.soldOut || !productHasStock(product);
  const canAdd = !outOfStock && available > 0;

  // Switching colour: if the current size isn't available in it, move to one that is.
  const pickColor = (key) => {
    setColor(key);
    if (stockFor(product, key, size) <= 0) {
      const firstAvailable = product.sizes.find((s) => stockFor(product, key, s) > 0);
      if (firstAvailable) setSize(firstAvailable);
    }
    setQty(1);
  };

  const handleAdd = () => {
    if (!canAdd) return;
    addToCart(product, size, color, COLORS[color]?.label || color, qty);
    setAdded(true);
    setTimeout(() => setAdded(false), 1800);
  };

  const handleNotifyRestock = async () => {
    if (!isNativeApp) return;
    setNotifyState("loading");
    const ok = await subscribeToRestock(apiBase, product.id);
    setNotifyState(ok ? "done" : "unavailable");
  };

  const shareWhatsApp = () => {
    const text = `${product.name} — ${money(effectivePrice(product))}\n${productUrl}`;
    window.open(`https://wa.me/?text=${encodeURIComponent(text)}`, "_blank");
  };

  const copyLink = async () => {
    try {
      await navigator.clipboard.writeText(productUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 1600);
    } catch (e) {
      /* clipboard not available */
    }
  };

  const nativeShare = () => {
    if (navigator.share) {
      navigator.share({ title: product.name, text: product.desc, url: productUrl }).catch(() => {});
    }
  };

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 py-10 pb-32">
      <div className="grid md:grid-cols-2 gap-10">
        <div className="md:sticky md:top-24 self-start min-w-0">
          <ProductGallery product={product} liked={liked} onToggleLike={toggleLike} activeColor={color} />
          {/* Mobile: colours sit right under the photos so you can watch
              the gallery switch as you tap. */}
          <div className="mt-4 md:hidden">
            <ColorPicker product={product} color={color} onPick={pickColor} />
          </div>
        </div>

        <div>
          <p className="font-body text-xs text-muted mb-2">{CATEGORIES.find((c) => c.id === product.category)?.label}</p>
          <div className="flex items-start justify-between gap-3">
            <h1 className="font-display font-bold text-3xl mb-3">{product.name}</h1>
          </div>

          <div className="flex items-center gap-3 mb-6">
            {product.discount > 0 ? (
              <>
                <span className="font-num text-2xl text-coral">{money(effectivePrice(product))}</span>
                <span className="font-num text-lg text-muted line-through">{money(product.price)}</span>
                <GlassChip tone="coral">−{product.discount}%</GlassChip>
              </>
            ) : (
              <span className="font-num text-2xl">{money(product.price)}</span>
            )}
          </div>

          <p className="font-body text-sm text-muted leading-7 mb-8" style={{ whiteSpace: "pre-line" }}>{product.desc}</p>

          {/* On desktop the picker sits with the rest of the details.
              On mobile it's rendered right under the gallery instead. */}
          <div className="mb-6 hidden md:block">
            <ColorPicker product={product} color={color} onPick={pickColor} />
          </div>

          <div className="mb-8">
            <div className="flex items-center justify-between mb-2">
              <p className="font-body text-sm font-medium">Size</p>
              <button onClick={() => setShowSizeGuide(true)} className="font-body text-xs text-coral hover:underline">Size guide</button>
            </div>
            <div className="flex flex-wrap gap-2">
              {product.sizes.map((sz) => {
                const left = stockFor(product, color, sz);
                const inStock = left > 0;
                return (
                  <button
                    key={sz}
                    onClick={() => { if (inStock) { setSize(sz); setQty(1); } }}
                    disabled={!inStock}
                    className="font-num text-sm px-4 py-2 rounded-full tap-scale transition-all"
                    style={
                      size === sz && inStock
                        ? { background: "var(--fg)", color: "var(--bg)" }
                        : {
                            background: "var(--glass-bg)",
                            border: "1px solid var(--glass-border)",
                            opacity: inStock ? 1 : 0.4,
                            textDecoration: inStock ? "none" : "line-through",
                            cursor: inStock ? "pointer" : "not-allowed",
                          }
                    }
                    title={inStock ? undefined : "Out of stock"}
                  >
                    {sz}
                  </button>
                );
              })}
            </div>
            {product.tracked && available > 0 && available <= 3 && (
              <p className="font-body text-xs text-coral mt-2">Only {available} left in this size</p>
            )}
          </div>

          <div className="hidden sm:flex items-center gap-4">
            {outOfStock ? (
              isNativeApp ? (
                <button
                  onClick={handleNotifyRestock}
                  disabled={notifyState === "loading" || notifyState === "done"}
                  className="w-full rounded-full font-body font-medium py-3 flex items-center justify-center gap-2 tap-scale"
                  style={{ background: notifyState === "done" ? "var(--teal)" : "var(--fg)", color: "var(--bg)", opacity: notifyState === "loading" ? 0.6 : 1 }}
                >
                  {notifyState === "done" ? (
                    <><Check className="w-5 h-5" /> We'll let you know</>
                  ) : notifyState === "unavailable" ? (
                    <>Turn on notifications to get notified</>
                  ) : (
                    <><Bell className="w-5 h-5" /> {notifyState === "loading" ? "One sec..." : "Notify me when back"}</>
                  )}
                </button>
              ) : (
                <button disabled className="w-full rounded-full font-body font-medium py-3 flex items-center justify-center gap-2 cursor-not-allowed" style={{ background: "var(--glass-bg)", border: "1px solid var(--glass-border)", color: "var(--fg-muted)" }}>
                  Sold out
                </button>
              )
            ) : !canAdd ? (
              <button disabled className="w-full rounded-full font-body font-medium py-3 flex items-center justify-center gap-2 cursor-not-allowed" style={{ background: "var(--glass-bg)", border: "1px solid var(--glass-border)", color: "var(--fg-muted)" }}>
                This size is out of stock
              </button>
            ) : (
              <>
                <div className="glass flex items-center rounded-full">
                  <button onClick={() => setQty((q) => Math.max(1, q - 1))} className="p-3 tap-scale" aria-label="Decrease quantity">
                    <Minus className="w-4 h-4" />
                  </button>
                  <span className="font-num w-8 text-center">{qty}</span>
                  <button onClick={() => setQty((q) => Math.min(available, q + 1))} disabled={qty >= available} className="p-3 tap-scale" aria-label="Increase quantity">
                    <Plus className="w-4 h-4" />
                  </button>
                </div>

                <Magnetic strength={10} className="flex-1">
                  <button onClick={handleAdd} className="glass glass-btn w-full rounded-full font-body font-medium py-3 tap-scale flex items-center justify-center gap-2" style={{ background: "var(--coral)", color: "#fff" }}>
                    {added ? (<><Check className="w-5 h-5" /> Added</>) : (<><ShoppingCart className="w-5 h-5" /> Add to cart</>)}
                  </button>
                </Magnetic>
              </>
            )}
          </div>

          {/* Share row */}
          <div className="flex items-center gap-2 mt-6">
            <span className="font-body text-xs text-muted mr-1">Share:</span>
            <button onClick={shareWhatsApp} className="glass rounded-full p-2.5 tap-scale hover:opacity-80 transition-opacity" aria-label="Share on WhatsApp">
              <MessageCircle className="w-4 h-4" />
            </button>
            <button onClick={copyLink} className="glass rounded-full p-2.5 tap-scale hover:opacity-80 transition-opacity flex items-center gap-1.5" aria-label="Copy link">
              <Link2 className="w-4 h-4" />
              {copied && <span className="font-body text-xs text-teal pr-1">Copied!</span>}
            </button>
            {typeof navigator !== "undefined" && navigator.share && (
              <button onClick={nativeShare} className="glass rounded-full p-2.5 tap-scale hover:opacity-80 transition-opacity" aria-label="Share">
                <Share2 className="w-4 h-4" />
              </button>
            )}
          </div>

          <div className="mt-8 pt-6 border-t grid grid-cols-3 gap-3 text-center" style={{ borderColor: "var(--border)" }}>
            {[
              { icon: Truck, label: "Fast delivery" },
              { icon: ShieldCheck, label: "Cash on delivery" },
              { icon: RotateCcw, label: "Easy returns" },
            ].map(({ icon: Icon, label }) => (
              <div key={label} className="flex flex-col items-center gap-1">
                <Icon className="w-5 h-5 text-teal" />
                <span className="font-body text-[11px] text-muted">{label}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {related.length > 0 && (
        <div className="mt-16">
          <h2 className="font-display font-bold text-xl mb-5">You might also like</h2>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 sm:gap-6">
            {related.map((p) => (
              <ProductCard key={p.id} product={p} onOpen={openProduct} liked={false} onToggleLike={() => {}} />
            ))}
          </div>
        </div>
      )}

      {/* Centering (translateX) is a static inline style, independent of the
          entrance animation on the inner wrapper. Previously the -50% shift
          only existed inside the dockIn keyframes' fill-mode — so on any
          device/browser that disables animations (reduced-motion settings,
          some Android battery-saver modes, etc.) the whole bar lost its
          transform and got pushed half off-screen, hiding Add to cart
          entirely. This is what happened on the Samsung Internet browser. */}
      <div
        className="fixed left-1/2 z-30 sm:hidden"
        style={{
          transform: "translateX(-50%)",
          width: "calc(100% - 24px)",
          maxWidth: 420,
          bottom: isNativeApp ? "calc(80px + env(safe-area-inset-bottom) + 0.75rem)" : "1rem",
        }}
      >
        <div className="glass rounded-2xl px-4 py-3 flex items-center gap-3 dock-in">
          <div className="flex-1 min-w-0">
            <p className="font-body text-xs text-muted truncate">{product.name}</p>
            <p className="font-num text-base">{outOfStock ? "Sold out" : money(effectivePrice(product))}</p>
          </div>
          {outOfStock && isNativeApp ? (
            <button
              onClick={handleNotifyRestock}
              disabled={notifyState === "loading" || notifyState === "done"}
              className="rounded-full font-body font-medium px-5 py-2.5 flex items-center gap-2 flex-shrink-0 tap-scale"
              style={{ background: notifyState === "done" ? "var(--teal)" : "var(--fg)", color: "var(--bg)", opacity: notifyState === "loading" ? 0.6 : 1 }}
            >
              {notifyState === "done" ? <Check className="w-4 h-4" /> : <Bell className="w-4 h-4" />}
              {notifyState === "done" ? "Notified" : notifyState === "loading" ? "..." : "Notify me"}
            </button>
          ) : !canAdd ? (
            <button disabled className="rounded-full font-body font-medium px-5 py-2.5 flex items-center gap-2 flex-shrink-0 cursor-not-allowed" style={{ border: "1px solid var(--glass-border)", color: "var(--fg-muted)" }}>
              {outOfStock ? "Sold out" : "Out of stock"}
            </button>
          ) : (
            <button onClick={handleAdd} className="glass-btn rounded-full font-body font-medium px-5 py-2.5 tap-scale flex items-center gap-2 flex-shrink-0" style={{ background: "var(--coral)", color: "#fff" }}>
              {added ? <Check className="w-4 h-4" /> : <ShoppingCart className="w-4 h-4" />}
              {added ? "Added" : "Add"}
            </button>
          )}
        </div>
      </div>

      {showSizeGuide && <SizeGuideModal category={product.category} onClose={() => setShowSizeGuide(false)} />}
    </div>
  );
}

/* ============================================================
   CART DRAWER
   ============================================================ */
function CartItemThumb({ item }) {
  const products = useProducts();
  const product = products.find((p) => p.id === item.productId);
  const src = product ? getImages(product)[0] : null;
  const [ok, setOk] = useState(true);

  if (src && ok) {
    return (
      <div className="w-16 h-16 rounded-xl flex-shrink-0 overflow-hidden" style={{ border: "1px solid var(--glass-border)" }}>
        <img src={src} alt={item.name} className="w-full h-full" style={{ objectFit: "cover" }} onError={() => setOk(false)} />
      </div>
    );
  }

  // No photo → a small mesh tile in the product's colors (matches the site art).
  const c1 = product ? COLORS[product.colors[0]]?.hex || "#141414" : "#1A1A1E";
  const c2 = product ? COLORS[product.colors[1]]?.hex || c1 : "#1A1A1E";
  return (
    <div
      className="w-16 h-16 rounded-xl flex-shrink-0"
      style={{
        border: "1px solid var(--glass-border)",
        background: `radial-gradient(120% 120% at 20% 20%, ${c1} 0%, transparent 60%), radial-gradient(120% 120% at 80% 80%, ${c2} 0%, transparent 60%), #1A1A1E`,
      }}
    />
  );
}

function CartDrawer({ open, onClose, cart, updateQty, removeFromCart, total, onCheckout }) {
  return (
    <>
      <div onClick={onClose} className={`fixed inset-0 z-40 transition-opacity ${open ? "opacity-100 pointer-events-auto" : "opacity-0 pointer-events-none"}`} style={{ background: "rgba(0,0,0,0.4)", backdropFilter: "blur(2px)" }} />
      <aside
        className="glass fixed right-3 w-[calc(100%-24px)] sm:w-96 z-50 rounded-3xl transition-transform duration-400 flex flex-col"
        style={{
          transform: open ? "translateX(0)" : "translateX(calc(100% + 24px))",
          top: isNativeApp ? "calc(0.75rem + env(safe-area-inset-top, 0px))" : "0.75rem",
          bottom: isNativeApp ? "calc(0.75rem + env(safe-area-inset-bottom, 0px))" : "0.75rem",
        }}
      >
        <div className="flex items-center justify-between p-5 border-b" style={{ borderColor: "var(--border)" }}>
          <h2 className="font-display font-bold text-lg">Your cart</h2>
          <button onClick={onClose} className="p-1 tap-scale" aria-label="Close">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-5 space-y-5">
          {cart.length === 0 ? (
            <div className="text-center py-16">
              <ShoppingBag className="w-10 h-10 text-muted mx-auto mb-3" style={{ opacity: 0.3 }} />
              <p className="font-body text-sm text-muted">Your cart is empty</p>
            </div>
          ) : (
            cart.map((item) => (
              <div key={item.key} className="flex gap-3">
                <CartItemThumb item={item} />
                <div className="flex-1 min-w-0">
                  <p className="font-body text-sm font-medium truncate">{item.name}</p>
                  <p className="font-body text-xs text-muted">{item.color} · {item.size}</p>
                  <div className="flex items-center justify-between mt-2">
                    <div className="flex items-center rounded-full" style={{ background: "var(--field-bg)", border: "1px solid var(--border)" }}>
                      <button onClick={() => updateQty(item.key, -1)} className="p-1.5 tap-scale">
                        <Minus className="w-3 h-3" />
                      </button>
                      <span className="font-num text-xs w-6 text-center">{item.qty}</span>
                      <button onClick={() => updateQty(item.key, 1)} className="p-1.5 tap-scale">
                        <Plus className="w-3 h-3" />
                      </button>
                    </div>
                    <span className="font-num text-sm">{money(item.price * item.qty)}</span>
                  </div>
                </div>
                <button onClick={() => removeFromCart(item.key)} className="text-muted hover:text-coral transition-colors self-start" aria-label="Remove" style={{ opacity: 0.5 }}>
                  <X className="w-4 h-4" />
                </button>
              </div>
            ))
          )}
        </div>

        {cart.length > 0 && (
          <div className="p-5 border-t space-y-1" style={{ borderColor: "var(--border)" }}>
            <div className="flex items-center justify-between font-body text-sm">
              <span className="text-muted">Subtotal</span>
              <span className="font-num text-lg">{money(total)}</span>
            </div>
            <p className="font-body text-xs text-muted mb-3">+ ${DELIVERY_FEE} flat delivery, added at checkout</p>
            <button onClick={onCheckout} className="glass-btn w-full font-body font-medium py-3 rounded-full tap-scale" style={{ background: "var(--fg)", color: "var(--bg)" }}>
              Checkout
            </button>
          </div>
        )}
      </aside>
    </>
  );
}

/* ============================================================
   CHECKOUT
   ============================================================ */
function CheckoutView({ cart, total, onSubmitted }) {
  // بالتطبيق: نعبّي البيانات المحفوظة من طلب سابق تلقائياً (اسم/هاتف/
  // محافظة/عنوان)، فما في داعي المستخدم يكتبها من جديد كل مرة.
  // بالموقع، loadCheckoutInfo() برجع null دايماً والنموذج بيضل فاضي
  // زي ما كان.
  const [form, setForm] = useState(() => ({
    name: "", phone: "", area: LEBANON_GOVERNORATES[0], address: "", notes: "",
    ...loadCheckoutInfo(),
  }));
  const [error, setError] = useState("");
  const [sending, setSending] = useState(false);
  const [autofilled] = useState(() => !!loadCheckoutInfo());

  useEffect(() => {
    document.title = `Checkout — ${STORE_NAME}`;
  }, []);

  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));
  const grandTotal = total + DELIVERY_FEE;

  const buildMessage = (orderNumber) => {
    const lines = [
      `New order from ${STORE_NAME} — Order #${orderNumber}`,
      "",
      ...cart.map((i) => `• ${i.name} — ${i.color} / ${i.size} × ${i.qty} = ${money(i.price * i.qty)}`),
      "",
      `Subtotal: ${money(total)}`,
      `Delivery: ${money(DELIVERY_FEE)}`,
      `Total: ${money(grandTotal)}`,
      "",
      `Name: ${form.name}`,
      `Phone: ${form.phone}`,
      `Governorate: ${form.area}`,
      `Address: ${form.address}`,
      form.notes ? `Notes: ${form.notes}` : null,
      "",
      "Payment: cash on delivery",
    ].filter(Boolean);
    return lines.join("\n");
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.name.trim() || !form.phone.trim() || !form.address.trim()) {
      setError("Please fill in your name, phone number and address before sending.");
      return;
    }
    setError("");
    setSending(true);

    // Register the order first so the shop can hold the stock and track it.
    // We open WhatsApp with the real order number the server gave us.
    let orderNumber = null;
    try {
      const res = await fetch(`${apiBase}/api/orders`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: form.name, phone: form.phone, area: form.area,
          address: form.address, notes: form.notes,
          items: cart.map((i) => ({
            productId: i.productId, colorKey: i.colorKey, color: i.color,
            size: i.size, qty: i.qty,
          })),
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setSending(false);
        setError(data.error || "Something went wrong. Please try again.");
        return;
      }
      orderNumber = data.orderNumber;
    } catch {
      // Offline or the API is unreachable — don't block the sale, fall back
      // to sending the order on WhatsApp without a tracked number.
      orderNumber = String(Math.floor(1000 + Math.random() * 9000));
    }

    const msg = encodeURIComponent(buildMessage(orderNumber));
    // الصوت والاهتزاز *قبل* فتح واتساب، مع تأخير بسيط — لأنو فتح
    // واتساب بيبعد التطبيق عن الواجهة فوراً، وإذا فتحناه أول، الصوت
    // ما بيلحق يتسمع أصلاً (الـ WebView بيصير بالخلفية قبل ما يشتغل).
    hapticSuccess();
    playSuccessChime();
    setSending(false);
    saveCheckoutInfo(form); // بالتطبيق بس — عشان يتعبّى تلقائياً المرة الجاية
    setTimeout(() => {
      window.open(`https://wa.me/${WHATSAPP_NUMBER}?text=${msg}`, "_blank");
    }, isNativeApp ? 380 : 0);
    onSubmitted({ ...form, total: grandTotal, count: cart.reduce((sum, i) => sum + i.qty, 0), orderNumber });
  };

  if (cart.length === 0) {
    return (
      <div className="max-w-lg mx-auto px-4 sm:px-6 py-20 text-center">
        <ShoppingBag className="w-10 h-10 text-muted mx-auto mb-4" style={{ opacity: 0.3 }} />
        <p className="font-body text-muted mb-2">Your cart is empty</p>
        <p className="font-body text-muted text-sm">Add a few things before checking out.</p>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 py-10 grid md:grid-cols-5 gap-10">
      <form onSubmit={handleSubmit} className="md:col-span-3 space-y-5">
        <h1 className="font-display font-bold text-2xl mb-2">Delivery details</h1>
        {autofilled && (
          <p className="font-body text-xs text-teal -mt-2 mb-1">
            Filled in from your last order — check it's still correct.
          </p>
        )}

        <Field label="Full name" required>
          <input value={form.name} onChange={set("name")} className="field" placeholder="Your name" />
        </Field>
        <Field label="Phone number" required>
          <input value={form.phone} onChange={set("phone")} className="field" placeholder="03 123 456" />
        </Field>
        <Field label="Governorate" required>
          <select value={form.area} onChange={set("area")} className="field">
            {LEBANON_GOVERNORATES.map((a) => (
              <option key={a} value={a}>{a}</option>
            ))}
          </select>
        </Field>
        <Field label="Address" required>
          <input value={form.address} onChange={set("address")} className="field" placeholder="Street, building, floor..." />
        </Field>
        <Field label="Notes (optional)">
          <textarea value={form.notes} onChange={set("notes")} rows={3} className="field resize-none" />
        </Field>

        {error && <p className="font-body text-sm text-coral">{error}</p>}

        <Magnetic strength={8} className="block w-full">
          <button type="submit" disabled={sending} className="glass-btn w-full font-body font-medium py-3.5 rounded-full tap-scale flex items-center justify-center gap-2" style={{ background: "var(--teal)", color: "#062420", opacity: sending ? 0.7 : 1 }}>
            <MessageCircle className="w-5 h-5" />
            {sending ? "Preparing your order…" : "Send order on WhatsApp"}
          </button>
        </Magnetic>
        <p className="font-body text-xs text-muted text-center">WhatsApp will open with your order ready — just review and send.</p>

        <style>{`
          .field { width: 100%; border: 1px solid var(--border); background: var(--field-bg); color: var(--fg); border-radius: 14px; padding: 0.7rem 1rem; font-family: 'Inter', sans-serif; font-size: 16px; }
          .field:focus { outline: none; border-color: var(--coral); box-shadow: 0 0 0 3px rgba(255,69,34,0.15); }
        `}</style>
      </form>

      <div className="md:col-span-2">
        <div className="glass rounded-3xl p-5 sticky top-24">
          <h2 className="font-display font-bold text-lg mb-4">Order summary</h2>
          <div className="space-y-3 mb-4">
            {cart.map((i) => (
              <div key={i.key} className="flex justify-between font-body text-sm">
                <span className="text-muted">{i.name} × {i.qty}</span>
                <span className="font-num">{money(i.price * i.qty)}</span>
              </div>
            ))}
          </div>
          <div className="border-t pt-3 space-y-1.5" style={{ borderColor: "var(--border)" }}>
            <div className="flex justify-between font-body text-sm text-muted">
              <span>Subtotal</span>
              <span className="font-num">{money(total)}</span>
            </div>
            <div className="flex justify-between font-body text-sm text-muted">
              <span>Delivery</span>
              <span className="font-num">{money(DELIVERY_FEE)}</span>
            </div>
            <div className="flex justify-between items-center pt-1.5">
              <span className="font-body text-sm font-medium">Total</span>
              <span className="font-num text-xl">{money(grandTotal)}</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function Field({ label, children, required }) {
  return (
    <div>
      <label className="font-body text-sm block mb-1.5">
        {label} {required && <span className="text-required">*</span>}
      </label>
      {children}
    </div>
  );
}

/* ============================================================
   CONFIRMATION
   ============================================================ */
function ConfirmationView({ order, goHome }) {
  return (
    <div className="max-w-lg mx-auto px-4 sm:px-6 py-24 text-center">
      <div className="glass w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-6">
        <Check className="w-8 h-8 text-teal" />
      </div>
      <h1 className="font-display font-bold text-2xl mb-2">Thank you! 🎉</h1>
      <p className="font-body text-muted mb-4">Your order has been sent — we'll confirm it with you within a short time.</p>
      {order && (
        <>
          <div className="glass inline-flex flex-col items-center rounded-2xl px-6 py-4 mb-4">
            <span className="font-body text-xs text-muted">Order number — save this to track your order</span>
            <span className="font-num text-2xl text-coral mt-1">#{order.orderNumber}</span>
          </div>
          <p className="font-body text-muted mb-8">We'll reach out on {order.phone} to confirm delivery to {order.area}.</p>
        </>
      )}
      <button onClick={goHome} className="glass-btn font-body font-medium px-6 py-3 rounded-full tap-scale" style={{ background: "var(--fg)", color: "var(--bg)" }}>
        Keep shopping
      </button>
    </div>
  );
}

/* ============================================================
   IN-APP NOTIFICATION BANNER — لما إشعار يوصل والتطبيق مفتوح
   قدام المستخدم. أندرويد ما بيعرض بانر النظام تلقائياً بهالحالة،
   فهاد البديل الداخلي — بينزلق من فوق، وبيختفي لحاله بعد كم ثانية.
   ============================================================ */
function InAppNotificationBanner({ notification, onTap, onDismiss }) {
  if (!notification) return null;
  return (
    <div
      className="fixed left-3 right-3 z-[60] search-fade"
      style={{ top: "calc(0.75rem + env(safe-area-inset-top, 0px))" }}
    >
      <button
        onClick={() => { onTap(); onDismiss(); }}
        className="glass w-full rounded-2xl p-3.5 flex items-start gap-3 text-left tap-scale"
      >
        <div className="glass rounded-xl p-2 flex-shrink-0" style={{ background: "rgba(255,69,34,0.12)" }}>
          <Bell className="w-4 h-4 text-coral" />
        </div>
        <div className="min-w-0 flex-1">
          {notification.title && <p className="font-body text-sm font-medium truncate">{notification.title}</p>}
          {notification.body && <p className="font-body text-xs text-muted mt-0.5 line-clamp-2">{notification.body}</p>}
        </div>
        <button onClick={(e) => { e.stopPropagation(); onDismiss(); }} className="p-1 flex-shrink-0 tap-scale" aria-label="Dismiss">
          <X className="w-4 h-4 text-muted" />
        </button>
      </button>
    </div>
  );
}

/* ============================================================
   WELCOME SHEET — شاشة ترحيب سريعة، مرة وحدة بس (أول تشغيل).
   بتشرح الميزات الحصرية بالتطبيق قبل ما نسأل عن إذن الإشعارات،
   حتى المستخدم يفهم القيمة قبل ما يوافق أو يرفض.
   ============================================================ */
function WelcomeSheet({ onDismiss }) {
  const perks = [
    { Icon: Bell, title: "Be the first to know", desc: "Sales, drops, and restocks — sent straight to you." },
    { Icon: Flame, title: "App Exclusives", desc: "Prices you won't find on the website — app only." },
    { Icon: Heart, title: "Keep track of favorites", desc: "Save pieces and pick up right where you left off." },
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center sm:justify-center">
      <div className="absolute inset-0" style={{ background: "rgba(0,0,0,0.5)" }} />
      <div
        className="glass relative w-full sm:max-w-sm rounded-t-3xl sm:rounded-3xl p-6"
        style={{ paddingBottom: "calc(1.5rem + env(safe-area-inset-bottom, 0px))" }}
      >
        <div className="flex flex-col items-center text-center mb-6">
          <LogoMark variant="compact" className="h-8 w-auto mb-4" />
          <h2 className="font-display font-bold text-xl">Welcome to the app</h2>
          <p className="font-body text-sm text-muted mt-1">A few things that only work here</p>
        </div>

        <div className="space-y-4 mb-6">
          {perks.map(({ Icon, title, desc }) => (
            <div key={title} className="flex items-start gap-3">
              <div className="glass rounded-xl p-2 flex-shrink-0" style={{ background: "rgba(255,69,34,0.12)" }}>
                <Icon className="w-4 h-4 text-coral" />
              </div>
              <div>
                <p className="font-body text-sm font-medium">{title}</p>
                <p className="font-body text-xs text-muted mt-0.5 leading-5">{desc}</p>
              </div>
            </div>
          ))}
        </div>

        <button
          onClick={onDismiss}
          className="glass-btn w-full rounded-full font-body font-medium py-3 tap-scale"
          style={{ background: "var(--coral)", color: "#fff" }}
        >
          Let's go
        </button>
      </div>
    </div>
  );
}

/* ============================================================
   APP TOP BAR — بديل خفيف للهيدر الكامل، حصري للتطبيق. يظهر بس
   بالصفحات غير الرئيسية (الهوم إلها ترحيبها الخاص، ما بتحتاج
   شريط فوقها). زر رجوع + عنوان الصفحة + سلة صغيرة، وخلص —
   ولا شعار كبير ولا قائمة ولا تبديل ثيم (هدول انتقلوا لمكان تاني).
   ============================================================ */
function routeTitle(route, currentProduct) {
  if (route.type === "catalog") {
    if (route.category === "all") return "Shop";
    return CATEGORIES.find((c) => c.id === route.category)?.label || "Shop";
  }
  if (route.type === "favorites") return "Favorites";
  if (route.type === "exclusives") return "App Exclusives";
  if (route.type === "privacy") return "Privacy Policy";
  if (route.type === "sale") return "On Sale";
  if (route.type === "product") return currentProduct?.name || "";
  if (route.type === "checkout") return "Checkout";
  return "";
}

function AppTopBar({ title, canGoBack, onBack, cartCount, onCart }) {
  return (
    <div className="sticky top-0 z-30 px-3" style={{ paddingTop: "calc(0.75rem + env(safe-area-inset-top, 0px))" }}>
      <div className="glass rounded-2xl flex items-center justify-between px-2 py-2">
        <button
          onClick={onBack}
          className="p-2 tap-scale flex-shrink-0"
          aria-label="Back"
          style={{ visibility: canGoBack ? "visible" : "hidden" }}
        >
          <ArrowLeft className="w-5 h-5" />
        </button>
        <h1 className="font-display font-bold text-[15px] truncate px-2 flex-1 text-center">{title}</h1>
        <button onClick={onCart} className="relative p-2 tap-scale flex-shrink-0" aria-label="Cart">
          <ShoppingBag className="w-5 h-5" />
          {cartCount > 0 && (
            <span
              className="absolute top-0.5 right-0.5 bg-coral text-white text-[9px] font-num rounded-full flex items-center justify-center"
              style={{ minWidth: 15, height: 15 }}
            >
              {cartCount}
            </span>
          )}
        </button>
      </div>
    </div>
  );
}

/* ============================================================
   APP FOOTNOTE — بديل مصغّر للفوتر الكامل، حصري للتطبيق. الفوتر
   الأصلي (شعار + وصف + قائمة فئات نصية) مكرر مع الشريط السفلي
   وبلاطات الفئات يلي أصلاً موجودين — هون بس تذكير بسيط للمساعدة.
   ============================================================ */
function AppFootnote() {
  const href = `https://wa.me/${WHATSAPP_NUMBER}?text=${encodeURIComponent(`Hi ${STORE_NAME}! I have a question`)}`;
  return (
    <div className="px-4 sm:px-6 pb-6 pt-2 text-center">
      <a href={href} target="_blank" rel="noopener noreferrer" className="font-body text-xs text-muted hover:text-coral transition-colors">
        Need help? Chat with us on WhatsApp
      </a>
    </div>
  );
}

/* ============================================================
   PAGE TRANSITION — حصري للتطبيق. كل صفحة بتنزلق للداخل باتجاه
   منطقي (يمين لقدام، يسار لرجوع) بدل التبديل الفوري، زي أي
   تطبيق نيتف حقيقي. عالموقع ما في تغيير — بيضل التبديل فوري
   زي ما كان (احتراماً للـ SEO وسرعة التصفح بالمتصفح).
   ============================================================ */
function PageTransition({ path, direction, children }) {
  const { reducedMotion } = useApp();
  const [animating, setAnimating] = useState(true);
  if (!isNativeApp || reducedMotion) return <>{children}</>;
  const animClass = direction === "back" ? "page-slide-back" : "page-slide-forward";
  // مهم: بعد ما تخلص الحركة منشيل الـ class نهائياً (مش نخليها "both" وبس).
  // أي transform باقي مطبّق — حتى لو translateX(0) بلا تأثير بصري — بيكسر
  // أي عنصر position:fixed جوا الصفحة (زي شريط "Add to cart" العائم)،
  // لأنو بيصير "ثابت نسبة لهاد العنصر" مش نسبة للشاشة كلها.
  return (
    <div key={path} className={animating ? animClass : ""} onAnimationEnd={() => setAnimating(false)}>
      {children}
    </div>
  );
}

/* ============================================================
   BOTTOM TAB BAR — حصري لتطبيق أندرويد/آيفون (Capacitor).
   ما بيظهر على الموقع نهائياً — بديل التنقّل الشائع بتطبيقات
   التسوق، الأصابع بمتناول أسفل الشاشة بدل ما تمد إيدك للهيدر فوق.
   ============================================================ */
function BottomTabBar({ activeType, goHome, goCatalog, onSearch, goFavorites, onCart, cartCount, likesCount }) {
  const tabs = [
    { key: "home", label: "Home", Icon: HomeIcon, onPress: goHome, active: activeType === "home" },
    { key: "shop", label: "Shop", Icon: ShoppingBag, onPress: () => goCatalog("all"), active: activeType === "catalog" },
    { key: "search", label: "Search", Icon: Search, onPress: onSearch, active: false },
    { key: "favorites", label: "Favorites", Icon: Heart, onPress: goFavorites, active: activeType === "favorites", badge: likesCount },
    { key: "cart", label: "Cart", Icon: ShoppingCart, onPress: onCart, active: false, badge: cartCount },
  ];
  const activeIndex = tabs.findIndex((t) => t.active);

  const press = (fn) => () => {
    hapticLight();
    fn();
  };

  return (
    <nav
      className="native-tab-bar glass fixed left-3 right-3 z-40 flex items-stretch rounded-full"
      style={{ bottom: "calc(10px + env(safe-area-inset-bottom, 0px))" }}
    >
      {/* البلاطة المنزلقة — بديل "liquid glass" الحقيقي بدل خط تحتي رفيع.
          الحركة عندها overshoot خفيف (cubic-bezier مرن) — إحساس "مطاطي"
          ناعم بدل ما تقفز بشكل ميكانيكي من تبويب لتاني. */}
      {activeIndex >= 0 && (
        <span
          aria-hidden="true"
          className="absolute rounded-full"
          style={{
            top: 6, bottom: 6,
            width: `calc(${100 / tabs.length}% - 10px)`,
            left: `calc(${(activeIndex * 100) / tabs.length}% + 5px)`,
            background: "var(--coral)",
            boxShadow: "0 4px 14px rgba(255,69,34,0.35)",
            transition: "left 0.45s cubic-bezier(0.34, 1.56, 0.64, 1)",
          }}
        />
      )}
      {tabs.map(({ key, label, Icon, onPress, active, badge }) => (
        <button
          key={key}
          onClick={press(onPress)}
          className="relative flex-1 flex flex-col items-center justify-center gap-0.5 tap-scale"
          style={{ paddingTop: 9, paddingBottom: 9, zIndex: 1 }}
          aria-label={label}
        >
          <span className="relative transition-colors duration-300" style={{ color: active ? "#fff" : "var(--fg-muted)" }}>
            <Icon className="w-5 h-5" fill={key === "favorites" && active ? "#fff" : "none"} />
            {!!badge && (
              <span
                className="absolute -top-1.5 -right-2 text-white text-[9px] font-num rounded-full flex items-center justify-center"
                style={{ minWidth: 14, height: 14, padding: "0 3px", background: active ? "rgba(255,255,255,0.35)" : "var(--coral)" }}
              >
                {badge}
              </span>
            )}
          </span>
          <span
            className="font-body transition-colors duration-300"
            style={{ fontSize: 10, color: active ? "#fff" : "var(--fg-muted)" }}
          >
            {label}
          </span>
        </button>
      ))}
    </nav>
  );
}

/* ============================================================
   FLOATING WHATSAPP HELP BUTTON
   ============================================================ */
function WhatsAppFab({ raised }) {
  const { reducedMotion } = useApp();
  // بالتطبيق ما بنعرض هالزر العائم أبداً — كان يتصادم بصرياً مع شريط
  // التنقّل السفلي والبطاقات، وأصلاً في رابط "Need help?" بآخر كل
  // صفحة (AppFootnote) بيغطي نفس الحاجة بدون تراكم.
  if (isNativeApp) return null;

  const href = `https://wa.me/${WHATSAPP_NUMBER}?text=${encodeURIComponent(
    `Hi ${STORE_NAME}! I have a question`
  )}`;
  const bottom = raised ? "6rem" : "1.25rem";
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      aria-label="Chat with us on WhatsApp"
      className="fab-wrap fixed right-4 z-30 flex items-center"
      style={{ bottom }}
    >
      <span className="fab-label glass rounded-full font-body text-sm px-3 py-2 mr-1" style={{ boxShadow: "var(--glass-shadow)" }}>
        Need help? Chat with us
      </span>
      <span
        className={`glass glass-sheen rounded-full flex items-center justify-center tap-scale ${reducedMotion ? "" : "fab-pulse"}`}
        style={{ width: 56, height: 56, background: "var(--coral)", borderColor: "rgba(255,255,255,0.35)" }}
      >
        <MessageCircle className="w-6 h-6" style={{ color: "#fff" }} />
      </span>
    </a>
  );
}

/* ============================================================
   FOOTER
   ============================================================ */
function Footer({ goCatalog, goSale }) {
  return (
    <footer className="mt-10 px-4 sm:px-6 pb-6">
      <div className="glass max-w-6xl mx-auto rounded-3xl px-4 sm:px-6 py-12">
        <div className="grid sm:grid-cols-3 gap-10">
          <div>
            <div className="mb-4">
              <LogoMark variant="full" className="h-14 sm:h-16 w-auto" />
            </div>
            <p className="font-body text-sm text-muted leading-6">
              Menswear in heavy fabrics with a youthful edge, from Saida to all of Lebanon.
            </p>
          </div>

          <div>
            <p className="font-body text-sm font-medium mb-4">Categories</p>
            <div className="flex flex-col gap-2">
              <button onClick={goSale} className="font-body text-sm text-left transition-colors flex items-center gap-1.5 hover:opacity-80" style={{ color: "var(--coral)" }}>
                <Tag className="w-3.5 h-3.5" /> Sale
              </button>
              {CATEGORIES.map((c) => (
                <button key={c.id} onClick={() => goCatalog(c.id)} className="font-body text-sm text-muted hover:text-coral text-left transition-colors">
                  {c.label}
                </button>
              ))}
            </div>
          </div>

          <div>
            <p className="font-body text-sm font-medium mb-4">Contact</p>
            <div className="flex items-center gap-2 font-body text-sm text-muted mb-2">
              <MapPin className="w-4 h-4" /> Saida, Lebanon
            </div>
            <div className="flex items-center gap-2 font-body text-sm text-muted mb-4">
              <MessageCircle className="w-4 h-4" /> Quick orders on WhatsApp
            </div>
            <a href={INSTAGRAM_URL} target="_blank" rel="noopener noreferrer" className="glass inline-flex items-center gap-2 rounded-full px-3 py-1.5 font-body text-sm text-muted hover:text-coral transition-colors">
              <AtSign className="w-4 h-4" /> {INSTAGRAM_HANDLE}
            </a>
          </div>
        </div>
        <div className="border-t mt-10 pt-5 text-center" style={{ borderColor: "var(--border)" }}>
          <p className="font-body text-xs text-muted">Designed with care for {STORE_NAME}, 2026.</p>
          <a href="/privacy" className="font-body text-xs text-muted hover:text-coral transition-colors underline mt-1 inline-block">Privacy Policy</a>
        </div>
      </div>
    </footer>
  );
}
