import React, {
  createContext,
  useContext,
  useEffect,
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
} from "lucide-react";
import Admin from "./Admin.jsx";
import { COLORS as PALETTE, swatchBackground } from "./palette.js";

/* ============================================================
   SETTINGS — edit before publishing
   ============================================================ */
const WHATSAPP_NUMBER = "96181445681"; // shop's order number, intl format, no + or leading 0
const STORE_NAME = "Kanaan Shop";
const SITE_URL = "https://kanaanshop.com"; // update once the real domain is connected
const DELIVERY_FEE = 5;
const INSTAGRAM_URL = "https://www.instagram.com/kanaan.shop";
const INSTAGRAM_HANDLE = "@kanaan.shop";

/* "Coming soon" gate — shown to everyone except /admin until you flip this
   to false. People who enter ACCESS_CODE get straight through (remembered
   on their device, so they won't need to re-enter it). Set your own launch
   date so the countdown is accurate. */
const MAINTENANCE_MODE = true;
const ACCESS_CODE = "4816";
const LAUNCH_DATE = "2026-08-15T12:00:00+03:00"; // update to your real target date
// Real logo files live in /public/logo-compact.png and /public/logo-full.png.

/* ============================================================
   PRODUCT DATA
   ============================================================ */
const FALLBACK_CATEGORIES = [
  { id: "tshirts", label: "T-Shirts" },
  { id: "shirts", label: "Shirts" },
  { id: "jeans", label: "Jeans" },
  { id: "pants", label: "Pants" },
  { id: "sets", label: "Sets" },
  { id: "shorts", label: "Shorts" },
  { id: "underwear", label: "Underwear" },
  { id: "shoes", label: "Shoes" },
];

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

  useEffect(() => {
    const onPop = () => setPath(window.location.pathname || "/");
    window.addEventListener("popstate", onPop);
    return () => window.removeEventListener("popstate", onPop);
  }, []);

  const navigate = (to) => {
    try {
      window.history.pushState({}, "", to);
    } catch (e) {
      /* ignore */
    }
    setPath(to);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  return [path, navigate];
}

function parseRoute(path) {
  if (path === "/") return { type: "home" };
  if (path.startsWith("/admin")) return { type: "admin" };
  if (path === "/shop") return { type: "catalog", category: "all" };
  if (path.startsWith("/shop/")) return { type: "catalog", category: path.slice(6) };
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
        transform: visible ? "translateY(0)" : "translateY(20px)",
        transition: `opacity 0.7s ease ${delay}ms, transform 0.7s cubic-bezier(0.16,1,0.3,1) ${delay}ms`,
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
  if (category === "shoes") return "shoe";
  if (category === "shirts") return "shirt-button";
  if (category === "underwear") return "underwear";
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
  if (v.startsWith("/")) return v;
  return `/products/${v.replace(/^\/+/, "")}`;
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
  const images = getImagesForColor(product, activeColor).map((x) => x.url);
  const c1 = COLORS[activeColor]?.hex || COLORS[product.colors[0]]?.hex || "#141414";
  const c2 = COLORS[product.colors[1]]?.hex || c1;
  const [active, setActive] = useState(0);
  const [broken, setBroken] = useState({});
  const touchX = useRef(null);

  // Jump back to the first photo whenever the shopper picks another color.
  useEffect(() => {
    setActive(0);
  }, [activeColor]);

  useEffect(() => {
    setActive(0);
    setBroken({});
  }, [product.id]);

  const idx = Math.min(active, Math.max(0, images.length - 1));
  const activeSrc = images[idx] && !broken[idx] ? images[idx] : null;
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
            key={idx}
            src={activeSrc}
            alt={product.name}
            className="absolute inset-0 w-full h-full"
            style={{ objectFit: "cover" }}
            onError={() => setBroken((b) => ({ ...b, [idx]: true }))}
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
            broken[i] ? null : (
              <button
                key={i}
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
                  onError={() => setBroken((b) => ({ ...b, [i]: true }))}
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
   COMING SOON GATE
   ------------------------------------------------------------
   Shown to visitors while MAINTENANCE_MODE is true. /admin always
   bypasses this (handled in KanaanShop). Anyone with ACCESS_CODE
   can preview the real site; the unlock is remembered on their
   device via localStorage so they won't be asked again.
   ============================================================ */
function useCountdown(target) {
  const [left, setLeft] = useState(() => Math.max(0, new Date(target).getTime() - Date.now()));
  useEffect(() => {
    const t = setInterval(() => setLeft(Math.max(0, new Date(target).getTime() - Date.now())), 1000);
    return () => clearInterval(t);
  }, [target]);
  const s = Math.floor(left / 1000);
  return {
    days: Math.floor(s / 86400),
    hours: Math.floor((s % 86400) / 3600),
    minutes: Math.floor((s % 3600) / 60),
    seconds: s % 60,
  };
}

function ComingSoonGate({ onUnlock }) {
  const { days, hours, minutes, seconds } = useCountdown(LAUNCH_DATE);
  const [showCode, setShowCode] = useState(false);
  const [code, setCode] = useState("");
  const [error, setError] = useState(false);

  const submit = (e) => {
    e.preventDefault();
    if (code.trim() === ACCESS_CODE) {
      try { localStorage.setItem("kanaan-access", ACCESS_CODE); } catch { /* ignore */ }
      onUnlock();
    } else {
      setError(true);
      setTimeout(() => setError(false), 1200);
    }
  };

  const units = [
    { n: days, l: "Days" },
    { n: hours, l: "Hours" },
    { n: minutes, l: "Min" },
    { n: seconds, l: "Sec" },
  ];

  return (
    <div className="min-h-screen bg-app text-fg font-body relative overflow-hidden flex items-center justify-center px-4 py-12">
      <MeshBackground variant="hero" />
      <div className="relative w-full flex flex-col items-center text-center" style={{ maxWidth: 560 }}>
        <div className="mb-8 hero-fade-1">
          <LogoMark variant="compact" className="h-9 sm:h-11 w-auto mx-auto" />
        </div>

        <div className="hero-fade-2 mb-5">
          <GlassChip tone="coral">
            <Sparkles className="w-3 h-3" /> Something new is coming
          </GlassChip>
        </div>

        <h1 className="font-display font-bold text-4xl sm:text-6xl leading-[1.1] mb-4 hero-fade-3">
          Kanaan Shop is
          <span className="block text-coral">getting a refresh</span>
        </h1>
        <p className="font-body text-muted text-base sm:text-lg mb-10 hero-fade-4" style={{ maxWidth: 440 }}>
          We're putting the final touches on new pieces and a better shopping experience.
          Back online very soon — from Saida, for all of Lebanon.
        </p>

        <div className="glass glass-sheen rounded-3xl px-4 sm:px-8 py-6 sm:py-7 mb-8 hero-fade-4">
          <div className="flex items-center gap-3 sm:gap-5">
            {units.map((u, i) => (
              <React.Fragment key={u.l}>
                <div className="flex flex-col items-center" style={{ minWidth: 56 }}>
                  <span className="font-num font-bold text-3xl sm:text-4xl tabular-nums">{String(u.n).padStart(2, "0")}</span>
                  <span className="font-body text-[11px] text-muted mt-1 tracking-wide">{u.l}</span>
                </div>
                {i < units.length - 1 && <span className="font-display text-2xl text-muted" style={{ opacity: 0.35 }}>:</span>}
              </React.Fragment>
            ))}
          </div>
        </div>

        <div className="flex items-center gap-2 mb-2 hero-fade-4">
          <a
            href={`https://wa.me/${WHATSAPP_NUMBER}`}
            target="_blank"
            rel="noopener noreferrer"
            className="glass glass-btn rounded-full font-body font-medium px-6 py-3 tap-scale flex items-center gap-2"
          >
            <MessageCircle className="w-4 h-4" /> Message us on WhatsApp
          </a>
          <a
            href={INSTAGRAM_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="glass rounded-full p-3 tap-scale"
            aria-label={INSTAGRAM_HANDLE}
          >
            <AtSign className="w-4 h-4" />
          </a>
        </div>

        <button
          onClick={() => setShowCode((v) => !v)}
          className="font-body text-xs text-muted hover:text-coral mt-8 tap-scale"
        >
          Have an access code?
        </button>

        {showCode && (
          <form onSubmit={submit} className="mt-3 flex items-center gap-2">
            <input
              autoFocus
              value={code}
              onChange={(e) => setCode(e.target.value)}
              placeholder="Enter code"
              inputMode="numeric"
              className="glass rounded-full px-4 py-2 font-num text-sm text-center"
              style={{ width: 140, borderColor: error ? "var(--coral)" : undefined }}
            />
            <button type="submit" className="glass rounded-full px-4 py-2 font-body text-sm tap-scale hover:text-coral">
              Enter
            </button>
          </form>
        )}
      </div>
    </div>
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

function SearchOverlay({ open, onClose, products, openProduct, goCatalog }) {
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
  const [path, navigate] = useRouter();
  const route = parseRoute(path);

  const [cart, setCart] = useState([]);
  const [likes, setLikes] = useState([]);
  const [cartOpen, setCartOpen] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [storageReady, setStorageReady] = useState(false);
  const [lastOrder, setLastOrder] = useState(null);
  const [orderPlaced, setOrderPlaced] = useState(false);
  const [unlocked, setUnlocked] = useState(() => {
    try { return localStorage.getItem("kanaan-access") === ACCESS_CODE; } catch { return false; }
  });
  const [searchOpen, setSearchOpen] = useState(false);

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

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const res = await fetch("/api/products");
        const data = await res.json();
        if (alive && Array.isArray(data.products)) setProducts(data.products);
      } catch { /* offline or API not ready */ }
      if (alive) setCatalogLoading(false);
    })();
    return () => { alive = false; };
  }, []);

  const goHome = () => navigate("/");
  const goCatalog = (cat) => { navigate(cat && cat !== "all" ? `/shop/${cat}` : "/shop"); setMenuOpen(false); };
  const openProduct = (product) => navigate(`/product/${product.slug}`);
  const goCheckout = () => { setCartOpen(false); setOrderPlaced(false); navigate("/checkout"); };

  const toggleLike = (id) => setLikes((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));

  const cartKey = (pid, size, colorKey) => `${pid}-${size}-${colorKey}`;

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
  const cartTotal = cart.reduce((sum, i) => sum + i.qty * i.price, 0);

  const filteredProducts = useMemo(() => {
    if (route.type !== "catalog") return products;
    return route.category === "all" ? products : products.filter((p) => p.category === route.category);
  }, [route.type, route.category, products]);

  const currentProduct = route.type === "product" ? products.find((p) => p.slug === route.slug) : null;

  if (route.type === "admin") {
    return (
      <div data-theme={theme} className="min-h-screen bg-app text-fg font-body">
        <GlobalStyles />
        <Admin onExit={goHome} />
      </div>
    );
  }

  if (MAINTENANCE_MODE && !unlocked) {
    return (
      <div data-theme={theme} className="min-h-screen bg-app text-fg font-body">
        <GlobalStyles />
        <ComingSoonGate onUnlock={() => setUnlocked(true)} />
      </div>
    );
  }

  return (
    <ProductsContext.Provider value={products}>
    <div data-theme={theme} className="min-h-screen bg-app text-fg font-body relative">
      <GlobalStyles />
      <Header cartCount={cartCount} onHome={goHome} onCart={() => setCartOpen(true)} onSearch={() => setSearchOpen(true)} menuOpen={menuOpen} setMenuOpen={setMenuOpen} goCatalog={goCatalog} />
      <main>
        {route.type === "home" && (
          <HomeView products={products} loading={catalogLoading} goCatalog={goCatalog} openProduct={openProduct} likes={likes} toggleLike={toggleLike} />
        )}
        {route.type === "catalog" && (
          <CatalogView activeCategory={route.category} loading={catalogLoading} goCatalog={goCatalog} products={filteredProducts} openProduct={openProduct} likes={likes} toggleLike={toggleLike} />
        )}
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
      </main>
      <Footer goCatalog={goCatalog} />
      <WhatsAppFab raised={route.type === "product"} />
      <SearchOverlay
        open={searchOpen}
        onClose={() => setSearchOpen(false)}
        products={products}
        openProduct={openProduct}
        goCatalog={goCatalog}
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
      @import url('https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@500;600;700&family=Inter:wght@400;500;600&display=swap');

      [data-theme="dark"] {
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

      @keyframes dockIn { from { opacity: 0; transform: translate(-50%, 20px); } to { opacity: 1; transform: translate(-50%, 0); } }
      .dock-in { animation: dockIn 0.5s cubic-bezier(0.16,1,0.3,1) both; }

      /* Search overlay */
      @keyframes searchFade { from { opacity: 0; } to { opacity: 1; } }
      @keyframes searchRise { from { opacity: 0; transform: translateY(-10px) scale(0.98); } to { opacity: 1; transform: translateY(0) scale(1); } }
      .search-fade { animation: searchFade 0.18s ease both; }
      .search-rise { animation: searchRise 0.32s cubic-bezier(0.16,1,0.3,1) both; }

      @media (prefers-reduced-motion: reduce) {
        .mesh-blob, .hero-fade-1, .hero-fade-2, .hero-fade-3, .hero-fade-4, .dock-in, .fab-pulse, .search-fade, .search-rise { animation: none !important; }
      }

      .tap-scale { transition: transform 0.15s ease; }
      .tap-scale:active { transform: scale(0.94); }

      ::selection { background: var(--coral); color: #fff; }
    `}</style>
  );
}

/* ============================================================
   HEADER
   ============================================================ */
function Header({ cartCount, onHome, onCart, onSearch, menuOpen, setMenuOpen, goCatalog }) {
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
            <button onClick={() => goCatalog("all")} className="hover:text-coral transition-colors">Shop</button>
            {CATEGORIES.map((c) => (
              <button key={c.id} onClick={() => goCatalog(c.id)} className="hover:text-coral transition-colors text-muted">
                {c.label}
              </button>
            ))}
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
          <div className="lg:hidden px-5 pb-3 pt-2 flex flex-col gap-3 font-body text-sm border-t mt-2" style={{ borderColor: "var(--border)" }}>
            <button onClick={onHome} className="text-left hover:text-coral">Home</button>
            <button onClick={() => goCatalog("all")} className="text-left hover:text-coral">Shop</button>
            {CATEGORIES.map((c) => (
              <button key={c.id} onClick={() => goCatalog(c.id)} className="text-left text-muted hover:text-coral">
                {c.label}
              </button>
            ))}
          </div>
        )}
      </header>
    </div>
  );
}

/* ============================================================
   HOME
   ============================================================ */
function HomeView({ products, loading, goCatalog, openProduct, likes, toggleLike }) {
  useEffect(() => {
    document.title = `${STORE_NAME} — Menswear from Saida, Lebanon`;
  }, []);

  const featured = products.slice(0, 8);
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
            <span className="block text-coral">Menswear from the coast</span>
          </h1>
          <p className="font-body text-muted text-base sm:text-lg max-w-xl mt-5 hero-fade-3">
            Everyday pieces in heavy fabrics and thoughtful cuts, inspired by Saida and its old souk. Delivery
            everywhere in Lebanon, cash on delivery.
          </p>
          <div className="flex items-center gap-3 mt-8 hero-fade-4">
            <Magnetic>
              <button onClick={() => goCatalog("all")} className="glass glass-btn rounded-full font-body font-medium px-6 py-3 tap-scale" style={{ background: "var(--coral)", color: "#fff", borderColor: "var(--coral)" }}>
                Shop now
              </button>
            </Magnetic>
            <button onClick={() => goCatalog("sets")} className="glass rounded-full font-body px-6 py-3 tap-scale hover:opacity-80 transition-opacity">
              See sets
            </button>
          </div>
        </div>
      </section>

      <section className="max-w-6xl mx-auto px-4 sm:px-6 py-10">
        <div className="grid grid-cols-2 lg:grid-cols-4 lg:grid-rows-2 gap-4">
          <Reveal className="col-span-2 lg:row-span-2">
            <div className="glass glass-sheen rounded-3xl p-6 h-full flex flex-col justify-between relative overflow-hidden" style={{ minHeight: 320 }}>
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
                  <p className="font-display font-bold text-xl">Coming soon</p>
                  <p className="font-body text-sm text-muted mt-1 max-w-sm">
                    The Kanaan Shop app is on its way — a faster, native way to shop from your phone.
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
   CATALOG
   ============================================================ */
const PAGE_SIZE = 12;

function CatalogView({ activeCategory, loading, goCatalog, products, openProduct, likes, toggleLike }) {
  const label = activeCategory === "all" ? "Shop" : CATEGORIES.find((c) => c.id === activeCategory)?.label || "Shop";
  const [shown, setShown] = useState(PAGE_SIZE);

  useEffect(() => {
    document.title = `${label} — ${STORE_NAME}`;
  }, [label]);

  // Start from the top of the list again when the category changes.
  useEffect(() => { setShown(PAGE_SIZE); }, [activeCategory]);

  const visible = products.slice(0, shown);
  const remaining = products.length - visible.length;

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 py-10">
      <h1 className="font-display font-bold text-3xl mb-6">Shop</h1>
      <div className="flex flex-wrap gap-2 mb-8">
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

      {loading && products.length === 0 ? (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4 sm:gap-6">
          {Array.from({ length: 8 }).map((_, i) => (
            <div key={i} className="rounded-2xl glass" style={{ aspectRatio: "4/5", opacity: 0.5 }} />
          ))}
        </div>
      ) : products.length === 0 ? (
        <p className="font-body text-muted py-16 text-center">No products in this category yet.</p>
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
function ProductView({ product, products, addToCart, openProduct, liked, toggleLike }) {
  const [size, setSize] = useState(product.sizes[0]);
  const [color, setColor] = useState(product.colors[0]);
  const [qty, setQty] = useState(1);
  const [added, setAdded] = useState(false);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    // Start on a colour/size that's actually in stock where possible.
    const firstColor = product.colors.find((c) => colorHasStock(product, c)) || product.colors[0];
    setColor(firstColor);
    setSize(product.sizes.find((s) => stockFor(product, firstColor, s) > 0) || product.sizes[0]);
    setQty(1);
    setAdded(false);
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
            <p className="font-body text-sm font-medium mb-2">Size</p>
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
              <button disabled className="w-full rounded-full font-body font-medium py-3 flex items-center justify-center gap-2 cursor-not-allowed" style={{ background: "var(--glass-bg)", border: "1px solid var(--glass-border)", color: "var(--fg-muted)" }}>
                Sold out
              </button>
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

      <div className="fixed bottom-4 left-1/2 z-30 dock-in sm:hidden" style={{ width: "calc(100% - 24px)", maxWidth: 420 }}>
        <div className="glass rounded-2xl px-4 py-3 flex items-center gap-3">
          <div className="flex-1 min-w-0">
            <p className="font-body text-xs text-muted truncate">{product.name}</p>
            <p className="font-num text-base">{outOfStock ? "Sold out" : money(effectivePrice(product))}</p>
          </div>
          {!canAdd ? (
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
      <aside className="glass fixed top-3 bottom-3 right-3 w-[calc(100%-24px)] sm:w-96 z-50 rounded-3xl transition-transform duration-400 flex flex-col" style={{ transform: open ? "translateX(0)" : "translateX(calc(100% + 24px))" }}>
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
  const [form, setForm] = useState({ name: "", phone: "", area: LEBANON_GOVERNORATES[0], address: "", notes: "" });
  const [error, setError] = useState("");
  const [sending, setSending] = useState(false);

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
      const res = await fetch("/api/orders", {
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
    window.open(`https://wa.me/${WHATSAPP_NUMBER}?text=${msg}`, "_blank");
    setSending(false);
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
   FLOATING WHATSAPP HELP BUTTON
   ============================================================ */
function WhatsAppFab({ raised }) {
  const { reducedMotion } = useApp();
  const href = `https://wa.me/${WHATSAPP_NUMBER}?text=${encodeURIComponent(
    `Hi ${STORE_NAME}! I have a question`
  )}`;
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      aria-label="Chat with us on WhatsApp"
      className="fab-wrap fixed right-4 z-30 flex items-center"
      style={{ bottom: raised ? "6rem" : "1.25rem" }}
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
function Footer({ goCatalog }) {
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
        </div>
      </div>
    </footer>
  );
}
