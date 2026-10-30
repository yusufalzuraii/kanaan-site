import React, {
  createContext,
  useContext,
  useEffect,
  useLayoutEffect,
  useMemo,
  useCallback,
  memo,
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
/* The admin panel is a third of the front-end code — product editor,
   stock grid, order management, image optimizer — and no
   shopper will ever open it. Importing it lazily puts it in its own file
   that only downloads when someone actually visits /admin, so every
   visitor stops paying to carry it around. */
const Admin = React.lazy(() => import("./Admin.jsx"));
/* The website's homepage: the Kanaan shop in 3D, walked into as you
   scroll (and /lab, the same page with a switch between the three
   directions that were tried). Loaded with the app itself, not on demand,
   because it IS the front door; the 3D engine inside it is still its own
   chunk, fetched only when a device can show it. */
import HomeLab from "./home/HomeLab.jsx";
/* false brings back the previous homepage (HomeView) in one line */
const HOME_3D = true;
import { COLORS as PALETTE, swatchBackground } from "./palette.js";
/* Set from Kanaan POS (Website → Site): the bar at the top, delivery, exchanges, opening hours */
import { applySettings, useSiteSettings, deliveryFor } from "./lib/siteSettings.js";
import { parsePhone } from "./lib/phone.js";
import { AnnounceBar, FreeDeliveryMeter, SITE_BITS_CSS } from "./components/SiteBits.jsx";
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
  forgetCheckoutInfo,
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
  checkAppUpdate,
  scheduleCartReminder,
  cancelCartReminder,
  registerAppStateListener,
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
/* Delivery comes from the shop's settings now (Kanaan POS → Website → Site → Delivery); $5 until they arrive. */
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

/* Fits. Built-in fallback; the real list (and new categories) come from Kanaan POS with the products. */
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


/* Categories are edited from Kanaan POS (Management → Website → Categories) and arrive with /api/products.
   These arrays are filled in place (applyCategories), so every part of the shop reading them stays in step;
   the built-in list is only the first-paint fallback (and the last list seen is remembered on the device). */
const CATEGORIES = [...FALLBACK_CATEGORIES];

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

/* The shop's categories from the server: [{ id, label, sort, active, grid, subs: [{id, label}] }]. */
function applyCategories(list, remember = true) {
  if (!Array.isArray(list) || !list.length) return false;
  const clean = list.filter((c) => c && c.id && c.label && c.active !== 0);
  if (!clean.length) return false;
  CATEGORIES.splice(0, CATEGORIES.length, ...clean.map((c) => ({ id: c.id, label: c.label })));
  for (const k of Object.keys(SUBCATEGORIES)) delete SUBCATEGORIES[k];
  for (const c of clean) if (Array.isArray(c.subs) && c.subs.length) SUBCATEGORIES[c.id] = c.subs.map((x) => ({ id: x.id, label: x.label }));
  const grid = clean.filter((c) => c.grid !== 0).map((c) => ({ id: c.id, label: c.label }));
  BROWSE_GRID_CATEGORIES.splice(0, BROWSE_GRID_CATEGORIES.length, ...grid);
  if (remember) { try { localStorage.setItem("kanaan-cats", JSON.stringify(clean)); } catch { /* private mode */ } }
  return true;
}
try { const saved = JSON.parse(localStorage.getItem("kanaan-cats") || "null"); if (saved) applyCategories(saved, false); } catch { /* first visit */ }

/* A tiny visit counter for the shop's statistics in Kanaan POS: page seen, product seen, added to cart,
   checkout, order, search. No cookies, nothing personal: the server only counts. Never slows a page. */
function track(kind, data = {}) {
  try {
    const body = JSON.stringify({ kind, app: isNativeApp ? 1 : 0, ...data });
    const url = `${apiBase}/api/hit`;
    if (!isNativeApp && navigator.sendBeacon) navigator.sendBeacon(url, new Blob([body], { type: "text/plain" }));
    else fetch(url, { method: "POST", body, keepalive: true, headers: { "Content-Type": "text/plain" } }).catch(() => {});
  } catch { /* never break the shop */ }
}
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
  /* Light is the shop's look (the owner's choice); dark is there for
     whoever picks it with the toggle, and is remembered on that device. */
  const [theme, setTheme] = useState(() => {
    try {
      const saved = localStorage.getItem("kanaan-theme");
      if (saved === "dark" || saved === "light") return saved;
    } catch { /* private mode or storage disabled */ }
    return "light";
  });

  const themeChosen = useRef(false);
  useEffect(() => {
    if (!themeChosen.current) { themeChosen.current = true; return; }
    try { localStorage.setItem("kanaan-theme", theme); } catch { /* ignore */ }
  }, [theme]);
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
      // keep the query string: it carries the visit's source (utm_source,
      // ref) that the visit counter reads right after this, and the /lab
      // preview's options
      try { window.history.replaceState({ depth: 0 }, "", window.location.pathname + window.location.search + window.location.hash); } catch (e) { /* ignore */ }
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
  if (path === "/lab") return { type: "lab" };
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

/* For listeners that hand back their "stop listening" function inside a
   Promise (the native.js register* helpers). An effect must return a plain
   function: returning the Promise itself made React throw "destroy is not a
   function" whenever the component unmounted (every page load in
   development, where React mounts twice on purpose). */
function untilUnmount(promise) {
  let stop = null;
  let gone = false;
  Promise.resolve(promise).then((fn) => {
    if (typeof fn !== "function") return;
    if (gone) fn();
    else stop = fn;
  }).catch(() => {});
  return () => {
    gone = true;
    if (stop) stop();
  };
}

/* طلب شبكة بمهلة زمنية. بدونها، لو الاتصال ضعيف أو الطلب "علق" (شائع
   على شبكات الموبايل هون)، الطلب بيضل معلّق بلا نهاية والمستخدم بيضل
   يحدّق بدوّارة تحميل ما بتخلص — بلا أي تفسير ولا مخرج. */
async function fetchWithTimeout(url, options = {}, timeoutMs = 15000) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, { ...options, signal: controller.signal });
  } finally {
    clearTimeout(timer);
  }
}
const effectivePrice = (p) => (p.discount > 0 ? Math.round(p.price * (1 - p.discount / 100)) : p.price);

/* Reveal-on-scroll, rewritten to survive a fast flick.

   The old version only gave itself a 450px head start, and only downwards
   ("0px 0px 450px 0px"). Two things went wrong because of that:

     • Scrolling UP had no head start at all — which is exactly why flicking
       back to the top looked worse than scrolling down.
     • On a tall phone screen a fast flick covers far more than 450px in a
       single frame, so you'd arrive at a section before it had been told to
       appear — and since hidden means opacity:0, what you saw was an empty
       box where a product card should be.

   Now: a generous margin in BOTH directions, and a hard safety net. If a
   section hasn't revealed within a moment of mounting, it reveals anyway.
   An animation that doesn't play is a small loss; a shopper staring at a
   blank rectangle is a real one. */
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

    // Already on (or near) screen at mount — show it immediately rather
    // than animating something the visitor is already looking at.
    try {
      const rect = el.getBoundingClientRect();
      if (rect.top < window.innerHeight * 1.5) {
        setVisible(true);
        return;
      }
    } catch { /* fall through to the observer */ }

    const obs = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setVisible(true);
          obs.disconnect();
        }
      },
      // Roughly a screen-and-a-half of runway in both directions, so even a
      // hard flick can't outrun it.
      { threshold: 0, rootMargin: "150% 0px 150% 0px" }
    );
    obs.observe(el);

    // Safety net: never leave anything invisible.
    const failsafe = setTimeout(() => setVisible(true), 1200);

    return () => { obs.disconnect(); clearTimeout(failsafe); };
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
        // Never fully transparent. Even mid-animation there's something
        // there, so a fast scroll shows content settling in rather than
        // empty rectangles filling up.
        opacity: visible ? 1 : 0.25,
        transform: visible ? "none" : "translate3d(0, 12px, 0) scale(0.995)",
        transition: `opacity 0.45s ease ${delay}ms, transform 0.55s cubic-bezier(0.16,1,0.3,1) ${delay}ms`,
        willChange: visible ? "auto" : "opacity, transform",
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
  // Three blurred, moving blobs are the most expensive thing on the page.
  // No reason for them to keep moving once the hero has scrolled away.
  const meshRef = usePauseOffscreen();
  const { reducedMotion, theme } = useApp();
  /* The drifting glow used to be switched off in light mode, which left
     the hero completely static — the movement that gives the page its
     life only ever existed at night. It runs in both now, just gentler
     against a light background so it stays a suggestion, not a effect. */
  const animate = !reducedMotion;
  const baseOpacity = theme === "dark" ? 0.42 : 0.38;

  /* Sizes are viewport-relative, not fixed pixels.
     They used to be hard-coded at ~400px, which fills a 390px phone screen
     but is a small dot lost in a 1920px desktop hero — which is exactly
     why the glow was visible on a phone and invisible on a laptop.

     The clamp keeps them sensible at both ends: never smaller than a
     phone screen's worth, never so large on an ultrawide that the colours
     merge into one flat wash. */
  const blobs =
    variant === "hero"
      ? [
          { color: "#FF4522", top: "-14%", left: "4%",  size: "clamp(300px, 34vw, 520px)", delay: "0s",   dur: "11s" },
          { color: "#12B3A0", top: "2%",   left: "48%", size: "clamp(280px, 30vw, 470px)", delay: "-3.5s", dur: "13s" },
          { color: "#6E5BFF", top: "44%",  left: "16%", size: "clamp(260px, 27vw, 430px)", delay: "-7s",  dur: "16s" },
        ]
      : [
          { color: "#FF4522", top: "6%",  left: "62%", size: "clamp(200px, 30vw, 420px)", delay: "0s",  dur: "15s" },
          { color: "#12B3A0", top: "55%", left: "4%",  size: "clamp(180px, 26vw, 360px)", delay: "-6s", dur: "18s" },
        ];
  return (
    /* The glow used to run edge to edge of the browser window while every
       other element on the page is held inside a centred container — so
       it read as colour escaping the layout rather than sitting behind
       it. Fading it out towards the sides keeps it inside the page's own
       margins without a hard cut-off line. */
    <div
      ref={meshRef}
      className="absolute inset-0 overflow-hidden pointer-events-none"
      aria-hidden="true"
      style={{
        contain: "paint",
        WebkitMaskImage: "radial-gradient(120% 100% at 50% 40%, #000 45%, transparent 88%)",
        maskImage: "radial-gradient(120% 100% at 50% 40%, #000 45%, transparent 88%)",
      }}
    >
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
            /* Blur cost scales with the square of the radius, and these
               three blobs are also moving — so the browser re-blurs them
               every frame. A CSS variable lets the phone use a much
               smaller radius without changing anything on desktop. */
            filter: "blur(var(--mesh-blur, 48px))",
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
/* ============================================================
   ANIMATED SPLASH — حصري للتطبيق (أندرويد/آيفون).

   ليش هيك وليش مش animation نيتف: شاشة الإقلاع النيتف بأندرويد لازم
   تكون صورة ثابتة — هاد قيد من النظام نفسو، لأنها بتترسم قبل ما
   التطبيق يشتغل أصلاً. فبدل ما نحارب القيد، منخليها ثابتة وقصيرة
   جداً وبـ *نفس لون الخلفية بالضبط*، وبعدها هالشاشة (HTML عادي)
   بتتسلّم بسلاسة — المستخدم بيشوف انتقال واحد متواصل، مش شاشتين.

   الحركة: توهج كورال بيتنفّس من الوسط، الشعار بيطلع بحركة مرنة
   (overshoot خفيف)، حلقة بتتمدد وبتختفي، لمعة بتمر عالشعار،
   والتاغلاين بيفرد حروفو — وبالآخر الشاشة كلها بتتلاشى وبتكبر شوي،
   وكأن التطبيق فتح من ورا الشعار.
   ============================================================ */
const SPLASH_TOTAL_MS = 1650;

function AnimatedSplash({ onDone }) {
  const { reducedMotion } = useApp();

  useEffect(() => {
    // مين مطفّي الحركة من إعدادات جهازو ما منجبرو يستنى — منختصرها
    const t = setTimeout(onDone, reducedMotion ? 350 : SPLASH_TOTAL_MS);
    return () => clearTimeout(t);
  }, [reducedMotion, onDone]);

  return (
    <div className="splash-root" aria-hidden="true">
      <div className="splash-glow" />
      <div className="splash-ring" />
      <div className="splash-logo-wrap">
        <img src="/logo-compact.png" alt="" className="splash-logo" />
        <span className="splash-sheen" />
      </div>
      <div className="splash-tagline">MEN'S FASHION WEAR</div>
    </div>
  );
}

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

/* Uploaded photos are stored twice — the full image and a smaller copy
   with "-thumb" before the extension. Grid cards show up to 12 images at
   once, so pulling the small one there is the difference between a page
   that loads instantly on mobile data and one that crawls.

   Products uploaded before thumbnails existed simply don't have one; the
   <img> onError below falls back to the full image, so nothing breaks. */
function thumbUrlFor(url) {
  const u = String(url || "");
  if (!u.startsWith("/img/")) return ""; // external or missing — no thumb to guess at
  const dot = u.lastIndexOf(".");
  if (dot <= 0) return "";
  return `${u.slice(0, dot)}-thumb${u.slice(dot)}`;
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

function SwatchPanel({ product, big, liked, onToggleLike, forceSoldOut, swipeable }) {
  const c1 = COLORS[product.colors[0]]?.hex || "#141414";
  const c2 = COLORS[product.colors[1]]?.hex || c1;
  const [imgOk, setImgOk] = useState(true);

  /* Browse a product's photos without leaving the grid.
     Only on cards (never the product page, which has its own gallery),
     and only when there's genuinely more than one photo to see. */
  const allImages = useMemo(() => getImages(product), [product]);
  const canSwipe = !!swipeable && !big && allImages.length > 1;
  const [idx, setIdx] = useState(0);
  const [hinted, setHinted] = useState(false);
  const hintRef = useRef(null);
  const touch = useRef(null);

  // The nudge plays once, on the first card to reach the screen — enough
  // to teach the gesture, not enough to become wallpaper.
  useEffect(() => {
    if (!canSwipe || hinted) return;
    const el = hintRef.current;
    if (!el || typeof IntersectionObserver !== "function") return;
    const obs = new IntersectionObserver(([e]) => {
      if (e.isIntersecting) { setHinted(true); obs.disconnect(); }
    }, { threshold: 0.6 });
    obs.observe(el);
    return () => obs.disconnect();
  }, [canSwipe, hinted]);

  // Warm the neighbouring photo so a swipe lands on something instant.
  useEffect(() => {
    if (!canSwipe) return;
    const next = allImages[idx + 1];
    if (next) { const im = new Image(); im.src = thumbUrlFor(next) || next; }
  }, [canSwipe, idx, allImages]);

  const go = (dir) => setIdx((i) => Math.min(allImages.length - 1, Math.max(0, i + dir)));

  /* A mouse can't swipe. Without this, browsing a product's photos from
     the grid worked on a phone and simply didn't exist on a laptop — the
     dots appeared, hinting at more images, with no way to reach them.

     Two ways in on desktop: drag the image, or use the arrows that fade
     in on hover. Pointer events cover mouse, trackpad and pen in one go. */
  const drag = useRef(null);
  const onPointerDown = (e) => {
    if (!canSwipe || e.pointerType === "touch") return; // touch has its own handlers
    drag.current = { x: e.clientX, moved: false };
  };
  const onPointerMove = (e) => {
    if (!drag.current) return;
    if (Math.abs(e.clientX - drag.current.x) > 10) drag.current.moved = true;
  };
  const onPointerUp = (e) => {
    if (!drag.current) return;
    const dx = e.clientX - drag.current.x;
    if (Math.abs(dx) > 45) {
      e.preventDefault();
      e.stopPropagation();
      go(dx < 0 ? 1 : -1);
      setHinted(true);
    }
    drag.current = null;
  };

  const onTouchStart = (e) => {
    if (!canSwipe) return;
    touch.current = { x: e.touches[0].clientX, y: e.touches[0].clientY, moved: false };
  };
  const onTouchMove = (e) => {
    if (!canSwipe || !touch.current) return;
    const dx = e.touches[0].clientX - touch.current.x;
    const dy = e.touches[0].clientY - touch.current.y;
    // Horizontal intent only — a vertical drag is the page scrolling.
    if (Math.abs(dx) > 12 && Math.abs(dx) > Math.abs(dy)) touch.current.moved = true;
  };
  const onTouchEnd = (e) => {
    if (!canSwipe || !touch.current) return;
    const dx = e.changedTouches[0].clientX - touch.current.x;
    const dy = e.changedTouches[0].clientY - touch.current.y;
    if (Math.abs(dx) > 40 && Math.abs(dx) > Math.abs(dy)) {
      // Swallow the tap so flicking through photos never opens the product.
      e.preventDefault();
      e.stopPropagation();
      go(dx < 0 ? 1 : -1);
      setHinted(true);
    }
    touch.current = null;
  };

  const fullSrc = (canSwipe ? allImages[idx] : allImages[0]) || null;
  // `big` = product page hero, where the full-resolution image belongs.
  const preferred = big ? fullSrc : (thumbUrlFor(fullSrc) || fullSrc);
  const imgSrc = imgOk ? preferred : null;
  const [thumbFailed, setThumbFailed] = useState(false);
  const [imgLoaded, setImgLoaded] = useState(false);
  const shownSrc = thumbFailed ? fullSrc : imgSrc;
  return (
    <div
      ref={hintRef}
      className="relative w-full flex items-center justify-center overflow-hidden"
      style={{
        aspectRatio: "4/5",
        borderRadius: big ? "28px" : "20px",
        background: `radial-gradient(120% 120% at 15% 15%, ${c1} 0%, transparent 55%), radial-gradient(120% 120% at 85% 85%, ${c2} 0%, transparent 55%), #1A1A1E`,
        // Lets the browser keep vertical scrolling on its fast path while
        // we handle the horizontal gesture ourselves.
        touchAction: canSwipe ? "pan-y" : undefined,
      }}
      onTouchStart={onTouchStart}
      onTouchMove={onTouchMove}
      onTouchEnd={onTouchEnd}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerLeave={() => { drag.current = null; }}
    >
      {shownSrc ? (
        <>
          {/* Shimmer sits underneath until the photo actually decodes. */}
          {!imgLoaded && <span className="skeleton" aria-hidden="true" />}
        <img
          src={shownSrc}
          alt={product.name}
          loading="lazy"
          decoding="async"
          key={shownSrc}
          className={`absolute inset-0 w-full h-full ph-img${imgLoaded ? " is-loaded photo-settle" : ""}${canSwipe && hinted && idx === 0 ? " swipe-hint" : ""}`}
          style={{ objectFit: "cover" }}
          onLoad={() => setImgLoaded(true)}
          onError={() => {
            // A missing thumbnail just means this photo predates them —
            // retry once with the full image before giving up entirely.
            if (!thumbFailed && shownSrc !== fullSrc) setThumbFailed(true);
            else setImgOk(false);
          }}
        />
        </>
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
      {/* Dots only appear where swiping is possible, so they double as the
          signal that there's more than one photo here. */}
      {canSwipe && (
        <>
          {idx > 0 && (
            <button
              type="button"
              className="card-arrow card-arrow-left"
              onClick={(e) => { e.preventDefault(); e.stopPropagation(); go(-1); }}
              aria-label="Previous photo"
            >
              <ChevronDown className="w-4 h-4" style={{ transform: "rotate(90deg)" }} />
            </button>
          )}
          {idx < allImages.length - 1 && (
            <button
              type="button"
              className="card-arrow card-arrow-right"
              onClick={(e) => { e.preventDefault(); e.stopPropagation(); go(1); }}
              aria-label="Next photo"
            >
              <ChevronDown className="w-4 h-4" style={{ transform: "rotate(-90deg)" }} />
            </button>
          )}
        </>
      )}
      {canSwipe && (
        <div className="card-dots" aria-hidden="true">
          {allImages.slice(0, 6).map((_, i) => (
            <span key={i} className={`card-dot${i === idx ? " is-active" : ""}`} />
          ))}
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
/* Memoised. The homepage renders twelve of these, each with its own
   state, observers and image loading — re-rendering the lot because the
   cart drawer opened is work the phone can't spare.

   The onToggleLike prop now takes the product id rather than being a
   pre-bound closure created inline at the call site, which is what
   makes the props stable enough for memo to actually hold. */
// A single shared no-op, so "no like button here" doesn't create a new
// function — and defeat memo — on every render.
const NOOP = () => {};

const ProductCard = memo(function ProductCard({ product, onOpen, liked, onToggleLike }) {
  const isOut = product.soldOut || !productHasStock(product);
  const tiltRef = useCardTilt();
  // Bound here, once per card, instead of a fresh arrow at every call site
  // on every parent render.
  const handleToggle = useCallback(() => onToggleLike(product.id), [onToggleLike, product.id]);
  return (
    <button onClick={() => onOpen(product)} className="text-left group focus:outline-none w-full">
      <div
        ref={tiltRef}
        className="card-tilt"
        style={{ opacity: isOut ? 0.7 : 1 }}
      >
        <SwatchPanel product={product} liked={liked} onToggleLike={handleToggle} forceSoldOut={isOut} swipeable />
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
});

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
  const colorNames = (product.colors || []).map((k) => (COLORS[k]?.label || k).toLowerCase());
  const sub = String(product.subcategory || "").toLowerCase();
  const desc = (product.desc || "").toLowerCase();

  // "black shirt", "jeans 32": every word must match somewhere, in any order
  const words = q.split(/\s+/).filter(Boolean);
  if (words.length > 1) {
    let total = 0;
    for (const w0 of words) {
      const forms = w0.length > 3 && w0.endsWith("s") ? [w0, w0.slice(0, -1)] : [w0];
      const hit = (t) => forms.some((w) => t.includes(w));
      const sc = hit(name) ? 20 : hit(category) ? 14 : colorNames.some(hit) ? 12 : hit(sub) ? 10 : (product.sizes || []).some((z) => forms.includes(String(z).toLowerCase())) ? 10 : hit(desc) ? 4 : 0;
      if (!sc) return 0;
      total += sc;
    }
    return Math.min(59, total);
  }

  const forms = q.length > 3 && q.endsWith("s") ? [q, q.slice(0, -1)] : [q];
  const hit = (t) => forms.some((w) => t.includes(w));
  if (forms.length > 1 && hit(name)) return 55;
  if (hit(category)) return 40;
  if (colorNames.some(hit)) return 30;
  if (hit(sub)) return 20;

  // last resort: match against the description
  if (hit(desc)) return 10;
  return 0;
}

function SearchOverlay({ open, onClose, products, openProduct, goCatalog, goSale }) {
  const [q, setQ] = useState("");
  const [cursor, setCursor] = useState(0);
  const inputRef = useRef(null);
  // what people look for (counted once they stop typing), for the shop's statistics
  useEffect(() => {
    const t = q.trim();
    if (!open || t.length < 2) return undefined;
    const timer = setTimeout(() => track("search", { key: t.slice(0, 60) }), 1400);
    return () => clearTimeout(timer);
  }, [q, open]);

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
  const full = getImages(product)[0];
  const src = thumbUrlFor(full) || full; // 40×50 preview — never needs the full file
  if (src && ok) {
    return (
      <span className="rounded-lg overflow-hidden flex-shrink-0 block" style={{ width: 40, height: 50, border: "1px solid var(--glass-border)" }}>
        <img src={src} alt="" className="w-full h-full" style={{ objectFit: "cover" }} loading="lazy" onError={(e) => { if (src !== full) e.currentTarget.src = full; else setOk(false); }} />
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

/* Pauses an element's animation whenever it scrolls out of view.

   content-visibility already stops the browser PAINTING off-screen
   sections, but it doesn't stop their animations — a marquee or a
   spinning ring keeps ticking the compositor forward at 60fps while
   sitting a full screen away, which on a phone is work taken directly
   from the scroll it's competing with.

   Toggling animation-play-state is free, and the browser drops the
   element's compositor work entirely while it's paused. */
function usePauseOffscreen() {
  const ref = useRef(null);

  useEffect(() => {
    const el = ref.current;
    if (!el || typeof IntersectionObserver !== "function") return;
    const obs = new IntersectionObserver(
      ([e]) => {
        // A class rather than an inline style, so descendants can opt in
        // via CSS — the animation being paused is often on a child or a
        // pseudo-element, which can't be observed directly.
        el.classList.toggle("anim-paused", !e.isIntersecting);
      },
      // A little margin so it's already moving by the time it's visible.
      { threshold: 0, rootMargin: "120px" }
    );
    obs.observe(el);
    return () => obs.disconnect();
  }, []);

  return ref;
}

/* Cards lean toward the cursor.

   Writes the transform straight onto the element rather than going
   through React state — a state update per mouse-move would re-render
   the card dozens of times a second. This touches one style property on
   one node, which the compositor handles on its own.

   Pointer devices only: a phone has no cursor to lean toward, and the
   listeners would be dead weight. */
function useCardTilt() {
  const ref = useRef(null);
  const { reducedMotion } = useApp();

  useEffect(() => {
    if (reducedMotion) return;
    const el = ref.current;
    if (!el) return;
    if (!window.matchMedia?.("(hover: hover) and (pointer: fine)").matches) return;

    let raf = 0;
    const onMove = (e) => {
      const r = el.getBoundingClientRect();
      // -1 .. 1 from the centre of the card
      const px = (e.clientX - r.left) / r.width - 0.5;
      const py = (e.clientY - r.top) / r.height - 0.5;
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(() => {
        el.style.transform = `perspective(900px) rotateY(${px * 5}deg) rotateX(${-py * 5}deg) translateY(-6px)`;
      });
    };
    const onLeave = () => {
      cancelAnimationFrame(raf);
      el.style.transform = "";
    };

    el.addEventListener("pointermove", onMove);
    el.addEventListener("pointerleave", onLeave);
    return () => {
      el.removeEventListener("pointermove", onMove);
      el.removeEventListener("pointerleave", onLeave);
      cancelAnimationFrame(raf);
    };
  }, [reducedMotion]);

  return ref;
}

/* Counts up to a number the first time it reaches the screen.

   Deliberately driven by requestAnimationFrame rather than a timer: it
   updates once per painted frame, so it can never queue up work faster
   than the screen can show it, and it stops the moment it arrives. The
   easing is a cubic ease-out — quick off the mark, gentle at the end,
   which is what makes a number feel like it lands rather than stops. */
function useCountUp(rawTarget, { duration = 1900 } = {}) {
  const ref = useRef(null);
  const [value, setValue] = useState(0);
  const { reducedMotion } = useApp();

  /* Guard the input. If the shop has no discounted products the caller
     can pass undefined, and every arithmetic step below then produces
     NaN — which React renders literally into the badge. */
  const target = Number.isFinite(Number(rawTarget)) ? Number(rawTarget) : 0;

  useEffect(() => {
    if (reducedMotion) { setValue(target); return; }
    const el = ref.current;
    if (!el || typeof IntersectionObserver !== "function") { setValue(target); return; }

    let raf = 0;
    const obs = new IntersectionObserver(([e]) => {
      if (!e.isIntersecting) return;
      obs.disconnect();
      const start = performance.now() + 260; // let the eye settle first
      const tick = (now) => {
        if (now < start) { raf = requestAnimationFrame(tick); return; }
        const t = Math.min(1, (now - start) / duration);
        const eased = 1 - Math.pow(1 - t, 3);
        setValue(Math.round(target * eased));
        if (t < 1) raf = requestAnimationFrame(tick);
      };
      raf = requestAnimationFrame(tick);
      /* Fired at 40% visible, which on a card this size meant it had
         already finished counting by the time you actually looked at it.
         Waiting until it's almost fully on screen — and a beat after
         that — means the count starts when someone is looking at it. */
    }, { threshold: 0.85 });

    obs.observe(el);
    return () => { obs.disconnect(); cancelAnimationFrame(raf); };
  }, [target, duration, reducedMotion]);

  return [ref, Number.isFinite(value) ? value : 0, value >= target && target > 0];
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
  const [countRef, shownDiscount, countDone] = useCountUp(maxDiscount);
  const glowRef = usePauseOffscreen();
  return (
    <button
      onClick={onOpen}
      className="glass glass-sheen sale-card group rounded-3xl p-6 h-full w-full flex flex-col justify-between relative overflow-hidden text-left tap-scale"
      style={{ minHeight: 150, borderColor: "rgba(255,69,34,0.45)" }}
      aria-label={`Sale — ${count} pieces, up to ${maxDiscount}% off`}
    >
      {/* coral wash + slow drifting glow, same family as MeshBackground */}
      <span className="absolute inset-0 pointer-events-none" aria-hidden="true" style={{ background: "linear-gradient(135deg, rgba(255,69,34,0.22), rgba(255,69,34,0.04) 60%)" }} />
      <span className="sale-glow" aria-hidden="true" ref={glowRef} />
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
          ref={countRef}
          className={`font-num font-bold flex-shrink-0 rounded-2xl text-center flex flex-col items-center justify-center${countDone ? " count-landed" : ""}`}
          style={{ background: "var(--coral)", color: "#fff", width: 86, height: 62, boxShadow: "0 8px 20px rgba(255,69,34,0.35)" }}
        >
          {/* Counts up as it arrives — a static number is a fact, a number
              climbing to it is an event. tabular-nums stops the digits
              jittering as their widths change mid-count. */}
          <span className="block text-2xl leading-none" style={{ fontVariantNumeric: "tabular-nums" }}>−{shownDiscount}%</span>
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
                  <SaleProductCard product={p} onOpen={openProduct} liked={likes.includes(p.id)} onToggleLike={toggleLike} />
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
/* Same treatment as ProductCard — the sale page renders a full grid of
   these too. */
const SaleProductCard = memo(function SaleProductCard({ product, onOpen, liked, onToggleLike }) {
  const isOut = product.soldOut || !productHasStock(product);
  const saving = product.price - effectivePrice(product);
  const handleToggle = useCallback(() => onToggleLike(product.id), [onToggleLike, product.id]);
  return (
    <button onClick={() => onOpen(product)} className="text-left group focus:outline-none w-full">
      <div
        className="transition-transform duration-500 group-hover:-translate-y-2"
        style={{ transitionTimingFunction: "cubic-bezier(0.16,1,0.3,1)", opacity: isOut ? 0.7 : 1 }}
      >
        <SwatchPanel product={product} liked={liked} onToggleLike={handleToggle} forceSoldOut={isOut} swipeable />
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
});

/* ============================================================
   ERROR BOUNDARY
   ------------------------------------------------------------
   If anything anywhere in the app throws during render, React
   normally unmounts everything and the visitor is left staring at a
   blank white page with zero explanation — exactly what happened on
   2026-07-24. This catches that class of crash, shows a plain
   "something went wrong, reload" screen instead of a blank one, and
   quietly reports the error so it can be fixed without relying on a
   customer complaining.

   Deliberately styled with plain inline styles, not Tailwind classes
   or the app's CSS custom properties — if GlobalStyles itself is
   what failed to mount, this fallback still has to render correctly
   on its own.
   ============================================================ */
class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false };
  }
  static getDerivedStateFromError() {
    return { hasError: true };
  }
  componentDidCatch(error, errorInfo) {
    try {
      fetch(`${apiBase}/api/log-error`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message: String(error?.message || error || "Unknown error"),
          stack: String(error?.stack || ""),
          componentStack: String(errorInfo?.componentStack || ""),
          url: typeof window !== "undefined" && window.location ? window.location.href : "",
          platform: isNativeApp ? "app" : "web",
        }),
      }).catch(() => { /* best effort — never let logging itself throw */ });
    } catch { /* ignore */ }
  }
  render() {
    if (!this.state.hasError) return this.props.children;
    return (
      <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", padding: "24px", background: "#F2F2F4", fontFamily: "Inter, sans-serif" }}>
        <div style={{ textAlign: "center", maxWidth: 340 }}>
          <p style={{ fontFamily: "'Space Grotesk', sans-serif", fontWeight: 700, fontSize: 22, color: "#14141A", marginBottom: 8 }}>
            Something went wrong
          </p>
          <p style={{ fontSize: 14, color: "rgba(20,20,26,0.6)", marginBottom: 24, lineHeight: 1.6 }}>
            Sorry about that — please try reloading the page. If it keeps happening, message us on WhatsApp and we'll sort it out.
          </p>
          <button
            onClick={() => window.location.reload()}
            style={{ background: "#FF4522", color: "#fff", border: "none", borderRadius: 999, padding: "12px 28px", fontFamily: "Inter, sans-serif", fontWeight: 500, fontSize: 14, cursor: "pointer" }}
          >
            Reload
          </button>
        </div>
      </div>
    );
  }
}

/* ============================================================
   ROOT
   ============================================================ */
export default function KanaanShopRoot() {
  return (
    <ErrorBoundary>
      <AppProvider>
        <KanaanShop />
      </AppProvider>
    </ErrorBoundary>
  );
}

function KanaanShop() {
  const { theme } = useApp();
  const [path, navigate, navDirection, canGoBack] = useRouter();
  const route = parseRoute(path);
  const firstView = useRef(true);
  useEffect(() => {
    if (route.type === "admin") return;
    const extra = {};
    if (firstView.current) {
      firstView.current = false;
      try { extra.ref = document.referrer || ""; const q = new URLSearchParams(window.location.search); extra.utm = q.get("utm_source") || q.get("ref") || ""; } catch { /* ignore */ }
    }
    track("pv", { path, ...extra });
    if (route.type === "checkout") track("checkout");
  }, [path]);

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

  // شاشة البداية المتحركة — بالتطبيق بس. الترتيب هون مقصود: الشاشة
  // النيتف الثابتة بتضل ظاهرة لحد ما شاشتنا المتحركة تكون مرسومة
  // فعلياً، وبعدين منخفيها — هيك ما في ولا إطار فاضي أو أبيض بينهن.
  const [showSplash, setShowSplash] = useState(isNativeApp);

  useEffect(() => {
    if (!isNativeApp) { hideSplashScreen(); return; }
    // rAF مضاعف = "بعد ما المتصفح رسم الإطار الأول فعلياً"
    const raf = requestAnimationFrame(() => {
      requestAnimationFrame(() => hideSplashScreen());
    });
    return () => cancelAnimationFrame(raf);
  }, []);

  // شاشة الترحيب الأولى — تظهر مرة وحدة بس، أول تشغيل للتطبيق
  const [showWelcome, setShowWelcome] = useState(() => isNativeApp && !hasSeenWelcome());

  // حالة الاتصال — بانر بسيط بدل ما نسكت أو نخلي المستخدم يشوف
  // شاشة خطأ المتصفح المزعجة
  const [isOffline, setIsOffline] = useState(false);
  useEffect(() => untilUnmount(registerNetworkListener((connected) => setIsOffline(!connected))), []);

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
  const [appExclusiveCount, setAppExclusiveCount] = useState(0);
  const [updateInfo, setUpdateInfo] = useState({ available: false });

  // بانر "نسخة جديدة متوفرة". بما إنو التطبيق بيشتغل من نسخة محزّمة
  // جواه، أي إصلاح جديد ما بيوصل لحدا إلا لما يحدّث من المتجر.
  // checkAppUpdate بتقرا رقم النسخة المثبّتة فعلياً من التطبيق نفسو
  // وبتقارنو مع المعلن بالسيرفر — فما في رقم ثابت بالكود لازم نفتكر
  // نحدّثو يدوياً كل مرة، وبالتالي ما في احتمال ينسى ويصير غلط.
  useEffect(() => {
    if (!isNativeApp) return;
    checkAppUpdate(apiBase).then(setUpdateInfo).catch(() => {});
  }, []);
  const [productsError, setProductsError] = useState(false);

  const refreshProducts = async () => {
    try {
      const res = await fetchWithTimeout(`${apiBase}/api/products`, {
        headers: isNativeApp ? { "X-Kanaan-Client": "app" } : {},
      });
      const data = await res.json();
      if (Array.isArray(data.categories)) applyCategories(data.categories);
      if (data.settings) applySettings(data.settings);
      // the database failing answers "no products" with an error: keep what's shown and say so
      if (!res.ok || (data.error && !(data.products || []).length)) { setProductsError(true); return; }
      if (Array.isArray(data.products)) {
        setProducts(data.products);
        setProductsError(false);
      }
      if (typeof data.appExclusiveCount === "number") setAppExclusiveCount(data.appExclusiveCount);
    } catch {
      // انقطاع أو مهلة خلصت — منعلّم حالة خطأ واضحة بدل ما نسكت
      // ونخلي المستخدم يظن إنو المتجر فاضي فعلاً
      setProductsError(true);
    }
  };

  useEffect(() => {
    let alive = true;
    (async () => {
      await refreshProducts();
      if (alive) setCatalogLoading(false);
    })();
    return () => { alive = false; };
  }, []);

  const goHome = () => { navigate("/"); setMenuOpen(false); };
  const goCatalog = (cat, sub) => {
    if (!cat || cat === "all") navigate("/shop");
    else navigate(sub ? `/shop/${cat}/${sub}` : `/shop/${cat}`);
    setMenuOpen(false);
  };
  const goSale = () => { navigate("/sale"); setMenuOpen(false); };
  const goFavorites = () => { navigate("/favorites"); setMenuOpen(false); };
  const goExclusives = () => { navigate("/exclusives"); setMenuOpen(false); };
  /* Stable identities for anything passed down to the product grid.

     Without useCallback these are recreated on every render of
     KanaanShop — which has nineteen pieces of state, so it renders often.
     A new function is a new prop, a new prop defeats memo, and every card
     re-renders because the cart drawer opened. */
  const openProduct = useCallback((product) => navigate(`/product/${product.slug}`), [navigate]);
  const goCheckout = () => { setCartOpen(false); setOrderPlaced(false); navigate("/checkout"); };

  const toggleLike = useCallback((id) => {
    hapticLight();
    playTapChime();
    setLikes((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  }, []);

  const cartKey = (pid, size, colorKey) => `${pid}-${size}-${colorKey}`;


  // زر الرجوع الفيزيائي بأندرويد — عندو أولويات بالترتيب:
  // 1) لو في نافذة منبثقة مفتوحة (سلة/بحث/ستوري/قائمة)، سكّرها بس
  // 2) لو لأ، بس لسا في صفحات نرجعلها جوا الراوتر، ارجع
  // 3) لو لأ (إحنا بالصفحة الأولى وما في نوافذ مفتوحة)، اطلع من التطبيق
  // بدون هالترتيب، كانت أي نافذة منبثقة مفتوحة بتخلي زر الرجوع يطلع
  // من التطبيق كامل بدل ما يسكّر النافذة بس — بالظبط المشكلة يلي صارت.
  useEffect(() => {
    let cleanup = () => {};
    const hasOpenOverlay = cartOpen || searchOpen || menuOpen;
    registerBackButtonHandler({
      canGoBack: () => hasOpenOverlay || canGoBack(),
      onBackWithinApp: () => {
        if (cartOpen) { setCartOpen(false); return; }
        if (searchOpen) { setSearchOpen(false); return; }
        if (menuOpen) { setMenuOpen(false); return; }
        window.history.back();
      },
      onExitApp: () => {
        import("@capacitor/app").then(({ App }) => App.exitApp());
      },
    }).then((fn) => { cleanup = fn; });
    return () => cleanup();
  }, [cartOpen, searchOpen, menuOpen]);

  // colorKey = the palette key we track stock against ("black")
  // colorLabel = what the shopper reads ("Black")
  const addToCart = (product, size, colorKey, colorLabel, qty) => {
    track("cart", { key: product.id });
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
  // a piece kept in the bag since another day shows today's price and name: what the checkout will charge
  useEffect(() => {
    if (!products.length) return;
    setCart((prev) => {
      let changed = false;
      const next = prev.map((i) => {
        const p = products.find((x) => x.id === i.productId);
        if (!p) return i;
        const price = effectivePrice(p);
        if (price === i.price && p.name === i.name) return i;
        changed = true;
        return { ...i, price, name: p.name };
      });
      return changed ? next : prev;
    });
  }, [products]); // eslint-disable-line

  const cartCount = cart.reduce((sum, i) => sum + i.qty, 0);

  useEffect(() => {
    updateAppBadge(cartCount);
  }, [cartCount]);

  // تذكير السلة المتروكة. منستخدم ref حتى يضل مستمع حالة التطبيق
  // شايف آخر عدد بالسلة، بدون ما نعيد تسجيلو كل مرة السلة تتغيّر
  // (تسجيل واحد بس طول عمر التطبيق).
  const cartCountRef = useRef(cartCount);
  useEffect(() => { cartCountRef.current = cartCount; }, [cartCount]);

  useEffect(() => untilUnmount(registerAppStateListener((isActive) => {
      if (isActive) {
        // رجع فتح التطبيق — ما في داعي للتذكير
        cancelCartReminder();
      } else if (cartCountRef.current > 0) {
        // طلع من التطبيق وسلتو مش فاضية — منجدول تذكير لطيف
        scheduleCartReminder(cartCountRef.current);
      }
    })), []);

  // فضّى سلتو أو خلص طلبو — منلغي أي تذكير مجدول
  useEffect(() => {
    if (cartCount === 0) cancelCartReminder();
  }, [cartCount]);

  const cartTotal = cart.reduce((sum, i) => sum + i.qty * i.price, 0);

  const filteredProducts = useMemo(() => {
    if (route.type !== "catalog") return products;
    let list = route.category === "all" ? products : products.filter((p) => p.category === route.category);
    if (route.sub) list = list.filter((p) => p.subcategory === route.sub);
    return list;
  }, [route.type, route.category, route.sub, products]);

  const currentProduct = route.type === "product" ? products.find((p) => p.slug === route.slug) : null;
  const seenProduct = useRef("");
  useEffect(() => {
    if (currentProduct && seenProduct.current !== currentProduct.id) { seenProduct.current = currentProduct.id; track("product", { key: currentProduct.id }); }
    if (!currentProduct) seenProduct.current = "";
  }, [currentProduct && currentProduct.id]);

  if (route.type === "admin") {
    return (
      <div data-theme={theme} className="min-h-screen bg-app text-fg font-body">
        <GlobalStyles />
        {/* Shown for the moment the admin bundle is downloading — only
            ever seen once, then it's cached by the browser. */}
        <React.Suspense
          fallback={
            <div className="min-h-screen flex items-center justify-center">
              <div className="flex flex-col items-center gap-3">
                <div className="admin-spinner" />
                <p className="font-body text-sm text-muted">Opening admin…</p>
              </div>
            </div>
          }
        >
          <Admin onExit={goHome} />
        </React.Suspense>
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
        <Header cartCount={cartCount} likesCount={likes.length} onHome={goHome} onCart={() => setCartOpen(true)} onSearch={() => setSearchOpen(true)} onSale={goSale} onFavorites={goFavorites} menuOpen={menuOpen} setMenuOpen={setMenuOpen} goCatalog={goCatalog} navigate={navigate} />
      )}
      {isNativeApp && isOffline && (
        <div className="px-4 sm:px-6" style={{ paddingTop: route.type === "home" ? "calc(0.75rem + env(safe-area-inset-top, 0px))" : 8 }}>
          <div className="glass rounded-2xl px-4 py-2.5 flex items-center gap-2">
            <span style={{ width: 7, height: 7, borderRadius: "50%", background: "var(--coral)", flexShrink: 0 }} />
            <p className="font-body text-xs text-muted">You're offline — showing what's saved on your phone.</p>
          </div>
        </div>
      )}
      {/* Announces cart changes to screen readers. Visually hidden, but
          without it a blind shopper gets no confirmation that "Add to
          cart" did anything at all. */}
      <div
        aria-live="polite"
        aria-atomic="true"
        style={{ position: "absolute", width: 1, height: 1, overflow: "hidden", clip: "rect(0 0 0 0)", whiteSpace: "nowrap" }}
      >
        {cartCount > 0 ? `${cartCount} ${cartCount === 1 ? "item" : "items"} in your cart` : ""}
      </div>

      {isNativeApp && !isOffline && updateInfo.available && (
        <div className="px-4 sm:px-6" style={{ paddingTop: route.type === "home" ? "calc(0.75rem + env(safe-area-inset-top, 0px))" : 8 }}>
          <div className="glass rounded-2xl px-4 py-2.5 flex items-center justify-between gap-2">
            <div className="flex items-center gap-2 min-w-0">
              <span style={{ width: 7, height: 7, borderRadius: "50%", background: "var(--teal)", flexShrink: 0 }} />
              <p className="font-body text-xs text-muted truncate">A new version of the app is available.</p>
            </div>
            <a
              href="https://play.google.com/store/apps/details?id=com.kanaanshop.app"
              target="_blank"
              rel="noopener noreferrer"
              className="font-body text-xs font-medium flex-shrink-0"
              style={{ color: "var(--coral)" }}
            >
              Update
            </a>
          </div>
        </div>
      )}
      <main>
        <PageTransition path={path} direction={navDirection}>
        {route.type === "home" && isNativeApp && (
          <NativeHomeView products={products} loading={catalogLoading} error={productsError} onRetry={refreshProducts} goCatalog={goCatalog} goSale={goSale} goExclusives={goExclusives} openProduct={openProduct} likes={likes} toggleLike={toggleLike} goFavorites={goFavorites} onCart={() => setCartOpen(true)} cartCount={cartCount} />
        )}
        {route.type === "home" && !isNativeApp && (HOME_3D ? (
          <HomeLab home products={products} loading={catalogLoading} goCatalog={goCatalog} goSale={goSale} openProduct={openProduct} likes={likes} toggleLike={toggleLike} appExclusiveCount={appExclusiveCount} />
        ) : (
          <HomeView products={products} loading={catalogLoading} goCatalog={goCatalog} goSale={goSale} openProduct={openProduct} likes={likes} toggleLike={toggleLike} appExclusiveCount={appExclusiveCount} />
        ))}
        {route.type === "lab" && (
          <HomeLab products={products} loading={catalogLoading} goCatalog={goCatalog} goSale={goSale} openProduct={openProduct} likes={likes} toggleLike={toggleLike} appExclusiveCount={appExclusiveCount} />
        )}
        {route.type === "sale" && (
          <SaleView products={products} loading={catalogLoading} goCatalog={goCatalog} openProduct={openProduct} likes={likes} toggleLike={toggleLike} />
        )}
        {route.type === "catalog" && (
          <CatalogView activeCategory={route.category} activeSub={route.sub} loading={catalogLoading} error={productsError} onRetry={refreshProducts} goCatalog={goCatalog} products={filteredProducts} openProduct={openProduct} likes={likes} toggleLike={toggleLike} />
        )}
        {route.type === "favorites" && (
          <FavoritesView products={products} loading={catalogLoading} likes={likes} openProduct={openProduct} toggleLike={toggleLike} goCatalog={goCatalog} />
        )}
        {route.type === "exclusives" && (
          <ExclusivesView products={products} loading={catalogLoading} likes={likes} openProduct={openProduct} toggleLike={toggleLike} />
        )}
        {route.type === "privacy" && <PrivacyPolicyView />}
        {route.type === "product" && currentProduct && (
          <ProductView product={currentProduct} products={products} addToCart={addToCart} openProduct={openProduct} liked={likes.includes(currentProduct.id)} toggleLike={() => toggleLike(currentProduct.id)} likes={likes} onLike={toggleLike} />
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
            goCatalog={goCatalog}
            onSubmitted={(orderInfo) => {
              track("order", { key: String(orderInfo && orderInfo.orderNumber || "") });
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

      {isNativeApp ? <AppFootnote /> : <Footer goCatalog={goCatalog} goSale={goSale} />}
      {/* the checkout has its own WhatsApp step: the round button would sit on the total */}
      {route.type !== "checkout" && <WhatsAppFab raised={route.type === "product"} />}
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
        products={products}
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
      {/* شاشة الترحيب ما بتطلع إلا بعد ما السبلاش يخلص — حتى ما
          يتراكبوا فوق بعض بأول تشغيل */}
      {showWelcome && !showSplash && <WelcomeSheet onDismiss={dismissWelcome} />}
      {showSplash && <AnimatedSplash onDone={() => setShowSplash(false)} />}
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
        /* the brand colours as small text (readable: 4.5:1 and up) */
        --coral-text: #FF7A5C;
        --teal-text: #3FD2BF;
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
        /* the brand colours as small text (readable: 4.5:1 and up) */
        --coral-text: #C93412;
        --teal-text: #0B7A6D;
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

      /* The drift used to cover 30px over 22 seconds — technically moving,
         but far too slow and too small for anyone to notice. Travel is in
         percentages now, so it scales with the blob, and a cycle takes
         about a quarter as long: still calm, but alive. */
      /* Wider travel and more scale contrast, so the drift is legible as
         movement rather than something you only notice by comparing two
         screenshots. */
      @keyframes meshFloat {
        0%   { transform: translate(0,0) scale(1) translateZ(0); }
        25%  { transform: translate(16%,-13%) scale(1.22) translateZ(0); }
        50%  { transform: translate(-13%,11%) scale(0.86) translateZ(0); }
        75%  { transform: translate(10%,8%) scale(1.13) translateZ(0); }
        100% { transform: translate(0,0) scale(1) translateZ(0); }
      }
      .mesh-blob { animation-name: meshFloat; animation-timing-function: ease-in-out; animation-iteration-count: infinite; animation-play-state: inherit; }

      /* Floating help button */
      /* The pulse used to animate box-shadow, which the browser can only
         do by repainting — every frame, forever, even while scrolling.
         A ring that scales is handled entirely by the GPU instead, and
         looks identical. */
      @keyframes fabPulse {
        0%   { transform: scale(1);   opacity: 0.45; }
        70%  { transform: scale(1.6); opacity: 0; }
        100% { transform: scale(1.6); opacity: 0; }
      }
      /* The animation goes on a ring behind the button, not the button
         itself — otherwise the whole thing would grow and shrink. */
      .fab-pulse { position: relative; }
      .fab-pulse::before {
        content: ''; position: absolute; inset: 0; border-radius: 9999px;
        background: var(--coral); z-index: -1;
        animation: fabPulse 2.6s cubic-bezier(0.4,0,0.6,1) infinite;
        will-change: transform, opacity;
      }
      /* The WhatsApp button is fixed to the screen, so it's never off it —
         an intersection observer would never fire. Instead the pulse stops
         itself after a while: its job is to draw the eye when the page
         settles, and a ring still pulsing minutes later is decoration the
         phone is paying for continuously. */
      .fab-pulse::before { animation-iteration-count: 6; }
      @media (max-width: 900px) {
        /* Fewer still on a phone, where the button is proportionally
           larger and the pulse more obvious. */
        .fab-pulse::before { animation-iteration-count: 4; }
      }
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

      /* The size sheet on a product page: rises from the bottom, the size
         buttons pop in one by one, the chosen one springs; "Add" without a
         size gives the sizes a small shake and a coral ring. */
      @keyframes sheetIn { from { transform: translateY(100%); } to { transform: translateY(0); } }
      @keyframes sheetFade { from { opacity: 0; } to { opacity: 1; } }
      @keyframes sizePop { 0% { opacity: 0; transform: translateY(10px) scale(0.92); } 100% { opacity: 1; transform: none; } }
      @keyframes sizeSpring { 0% { transform: scale(1); } 40% { transform: scale(0.9); } 75% { transform: scale(1.06); } 100% { transform: scale(1); } }
      @keyframes sizeNudge { 0%, 100% { transform: translateX(0); } 20% { transform: translateX(-7px); } 40% { transform: translateX(6px); } 60% { transform: translateX(-4px); } 80% { transform: translateX(3px); } }
      .pick-backdrop { animation: sheetFade 0.25s ease both; background: rgba(10,10,14,0.42); backdrop-filter: blur(3px); -webkit-backdrop-filter: blur(3px); }
      .pick-sheet { animation: sheetIn 0.42s cubic-bezier(0.16,1,0.3,1) both; background: rgba(255,255,255,0.9); border: 1px solid var(--glass-border); border-bottom: 0; box-shadow: 0 -18px 60px rgba(20,20,26,0.18); backdrop-filter: blur(24px) saturate(160%); -webkit-backdrop-filter: blur(24px) saturate(160%); }
      [data-theme="dark"] .pick-sheet { background: rgba(18,18,22,0.92); box-shadow: 0 -18px 60px rgba(0,0,0,0.5); }
      .pick-size { animation: sizePop 0.4s cubic-bezier(0.16,1,0.3,1) both; transition: background 0.2s ease, color 0.2s ease, box-shadow 0.2s ease; }
      .pick-size.is-on { animation: sizeSpring 0.38s cubic-bezier(0.16,1,0.3,1); }
      .size-nudge { animation: sizeNudge 0.5s ease; box-shadow: 0 0 0 2px var(--coral); border-radius: 22px; }
      .pick-cta { transition: background 0.25s ease, color 0.25s ease, transform 0.2s ease; }

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
      /* This used to animate box-shadow — a paint property, running
         forever on two elements sitting in the hero. Same trap the
         WhatsApp button was in. It's a glow layer fading in and out
         behind the chip now, which is pure opacity and free. */
      @keyframes chipBreath {
        0%, 100% { opacity: 0; }
        50%      { opacity: 1; }
      }
      .promise-chip { opacity: 0; position: relative; }
      .promise-chip::after {
        content: ''; position: absolute; inset: -2px; border-radius: 9999px;
        box-shadow: 0 0 18px 2px rgba(18,179,160,0.22);
        opacity: 0; pointer-events: none;
      }
      .promise-chip-1 { animation: chipIn 0.6s cubic-bezier(0.16,1,0.3,1) 0.45s both; }
      .promise-chip-2 { animation: chipIn 0.6s cubic-bezier(0.16,1,0.3,1) 0.62s both; }
      .promise-chip-1::after { animation: chipBreath 5s ease-in-out 1.2s infinite; }
      .promise-chip-2::after { animation: chipBreath 5s ease-in-out 3.7s infinite; }
      .promise-divider {
        width: 18px; height: 1px; flex-shrink: 0;
        background: linear-gradient(90deg, transparent, var(--fg-muted), transparent);
        opacity: 0; animation: chipIn 0.5s ease 0.8s both;
      }

      /* Anything inside a paused container stops animating.
         ------------------------------------------------------------
         An animation that has scrolled off screen still costs the
         compositor a frame of work every 16ms — it's simply doing that
         work where nobody can see it. On a laptop that's spare capacity;
         on a phone it's taken directly out of the scroll the visitor is
         actually performing.

         The universal selector plus the pseudo-element selectors covers
         including animations that live on ::before / ::after and so
         can't be observed individually. */
      .anim-paused,
      .anim-paused *,
      .anim-paused *::before,
      .anim-paused *::after {
        animation-play-state: paused !important;
      }

      /* ============================================================
         MOBILE PERFORMANCE
         ------------------------------------------------------------
         Desktop is smooth; phones stutter. The cause isn't the number of
         animations — they're all compositor-only. It's that a phone GPU
         is asked to do the same work a laptop GPU does, on a fraction of
         the hardware, at a higher pixel density.

         Three things dominate, and all three are per-frame costs that
         apply whether anything is animating or not:

           • backdrop-filter — the page has 66 glass surfaces. Each one
             makes the browser sample and blur everything behind it, on
             every frame. This is the single most expensive property in
             CSS on mobile hardware.
           • blur(48px) on the drifting gradient blobs. Blur radius cost
             is roughly quadratic, so halving the radius is closer to a
             quarter of the work.
           • mix-blend-mode on the grain overlay, which forces the
             browser out of its fast compositing path for that whole
             stacking context.

         None of this is removed on desktop — it's what gives the site
         its look. It's dialled back only where the hardware can't carry
         it, and only in ways that keep the design recognisably itself.
         ============================================================ */
      @media (max-width: 900px) {
        /* Roughly a third of the desktop radius — close to a tenth of the
           work, and at phone size the blobs are small enough that it
           still reads as a soft glow. */
        :root { --mesh-blur: 26px; }

        .glass {
          /* Half the blur radius, roughly a quarter of the sampling work.
             The translucency and the hairline border do most of the
             visual job anyway. */
          backdrop-filter: blur(8px) saturate(150%);
          -webkit-backdrop-filter: blur(8px) saturate(150%);
        }

        /* Grain is a texture you feel rather than see. On a phone it
           costs a whole compositing path for something invisible at
           arm's length. */
        .grain-overlay { display: none; }

        /* Cards don't tilt on a phone (no cursor) and the hero pieces
           aren't shown, so neither needs a promoted layer. Every
           unnecessary will-change is GPU memory a phone doesn't have. */
        .card-tilt { will-change: auto; }
      }

      /* Very small phones — the ones that actually struggle. Drop the
         backdrop blur entirely and lean on opacity instead: still reads
         as a translucent panel, costs nothing per frame. */
      @media (max-width: 480px) {
        .glass {
          backdrop-filter: none;
          -webkit-backdrop-filter: none;
          background: color-mix(in srgb, var(--bg) 82%, var(--glass-bg));
        }
      }

      /* One source of truth for the header's height. The hero reaches up
         behind it by exactly this much, so the two can never drift apart. */
      :root { --header-h: calc(76px + var(--announce-h, 0px)); }
      @media (min-width: 640px) { :root { --header-h: calc(84px + var(--announce-h, 0px)); } }
      ${SITE_BITS_CSS}

      /* Loading ring for the admin panel while its bundle downloads.
         Plain CSS rather than a lucide icon on purpose — the icon set
         itself lives in the main bundle, and this needs to render before
         anything from the lazy chunk has arrived. */
      @keyframes adminSpin { to { transform: rotate(360deg); } }
      .admin-spinner {
        width: 26px; height: 26px; border-radius: 9999px;
        border: 2.5px solid var(--border);
        border-top-color: var(--coral);
        animation: adminSpin 0.7s linear infinite;
      }

      /* ============================================================
         HOMEPAGE MOTION
         ------------------------------------------------------------
         Everything here animates transform and opacity only. Those are
         the two properties the GPU can handle on its own, without asking
         the browser to recalculate layout or repaint — which is why none
         of this costs anything while scrolling.
         ============================================================ */

      /* 1 — Kinetic headline.
         Each line sits inside a clipping window and rises into it, the way
         a fashion title sequence resolves. Reads as one deliberate motion
         rather than text simply appearing. */
      @keyframes lineRise {
        from { transform: translate3d(0, 108%, 0) skewY(4deg); }
        to   { transform: translate3d(0, 0, 0) skewY(0deg); }
      }
      .kinetic-line { display: block; overflow: hidden; padding-bottom: 0.06em; }
      .kinetic-line > span {
        display: block;
        animation: lineRise 1s cubic-bezier(0.16, 1, 0.3, 1) both;
        will-change: transform;
      }
      .kinetic-1 > span { animation-delay: 0.05s; }
      .kinetic-2 > span { animation-delay: 0.19s; }

      /* 2 — Marquee.
         A slow band of the things that actually win the sale — free
         delivery, cash on delivery, where you are. Duplicated once and
         shifted by exactly -50%, which is what makes the loop seamless. */
      @keyframes marquee { to { transform: translate3d(-50%, 0, 0); } }
      .marquee-track {
        display: flex; width: max-content;
        animation: marquee 32s linear infinite;
        will-change: transform;
      }
      .marquee-mask {
        -webkit-mask-image: linear-gradient(90deg, transparent, #000 12%, #000 88%, transparent);
        mask-image: linear-gradient(90deg, transparent, #000 12%, #000 88%, transparent);
      }
      @media (max-width: 900px) {
        /* A mask forces its own compositing pass on every frame of a
           continuously scrolling strip. The rounded container already
           clips the ends, so the fade is a refinement the phone can skip. */
        .marquee-mask { -webkit-mask-image: none; mask-image: none; }
      }

      /* 3 — Scroll progress.
         A hairline that fills as the page does. Small, but it's the cue
         that tells you the page is a single considered thing with a
         beginning and an end. */
      .scroll-progress {
        position: fixed; top: 0; left: 0; right: 0; height: 2px; z-index: 60;
        transform-origin: 0 50%;
        background: linear-gradient(90deg, var(--coral), var(--teal));
        will-change: transform; pointer-events: none;
      }

      /* 4 — Photos settle.
         A product photo eases down from a hair oversized as it arrives,
         so a grid filling in feels like it's landing rather than blinking. */
      .photo-settle { animation: photoSettle 0.7s cubic-bezier(0.16,1,0.3,1) both; }
      @keyframes photoSettle {
        from { transform: scale(1.06); }
        to   { transform: scale(1); }
      }

      /* 5 — Sticky header on its own GPU layer.
         A sticky element with a backdrop blur is repainted on every single
         scroll frame. Promoting it to its own layer is what stops that
         showing up as stutter on a phone. */
      .header-layer { transform: translateZ(0); will-change: transform; }

      /* A number quietly counting up is easy to miss entirely. A single
         beat as it lands is what turns it from something happening into
         something you noticed happening. */
      @keyframes countLand {
        0%   { transform: scale(1); }
        45%  { transform: scale(1.14); }
        100% { transform: scale(1); }
      }
      .count-landed { animation: countLand 0.5s cubic-bezier(0.34, 1.56, 0.64, 1); }

      /* Page transitions.
         Moving between pages used to be an instant swap — the old page
         gone, the new one simply there. A short rise-and-fade makes it
         read as one continuous place you're moving around inside, rather
         than a series of documents. Kept under 400ms: any longer and it
         stops feeling responsive and starts feeling slow. */
      @keyframes pageIn {
        from { opacity: 0; transform: translate3d(0, 10px, 0); }
        to   { opacity: 1; transform: none; }
      }
      .page-in { animation: pageIn 0.38s cubic-bezier(0.16, 1, 0.3, 1) both; }

      /* Cards lean very slightly toward the cursor. Only where there IS a
         cursor, and only a couple of degrees — enough that the grid feels
         responsive to you, not so much that it becomes a toy. */
      @media (hover: hover) and (pointer: fine) {
        .card-tilt { transition: transform 0.35s cubic-bezier(0.16,1,0.3,1); transform-style: preserve-3d; }
      }

      /* Hero pieces drift very gently — enough that the right side of the
         page is alive rather than a static collage, not enough to pull
         attention off the headline. */
      @keyframes heroFloat {
        0%, 100% { translate: 0 0; }
        50%      { translate: 0 -14px; }
      }
      .hero-float {
        animation: heroFloat 6s ease-in-out infinite;
        transition: scale 0.4s cubic-bezier(0.16,1,0.3,1);
      }
      .hero-float:hover { scale: 1.03; }

      /* Swipeable product cards.
         ------------------------------------------------------------
         A shopper had to open a product to discover it had more than one
         photo. Now the card itself swipes, and a short nudge on the first
         one that scrolls into view teaches that without a word of
         instruction — the image drifts a few pixels and settles, the way
         a card does when it's asking to be moved. */
      @keyframes swipeHint {
        0%, 62%, 100% { transform: translate3d(0, 0, 0); }
        72%           { transform: translate3d(-13px, 0, 0); }
        84%           { transform: translate3d(4px, 0, 0); }
      }
      .swipe-hint { animation: swipeHint 2.6s cubic-bezier(0.4, 0, 0.2, 1) 0.9s 2; }

      /* Arrows are for pointers, not fingers — a phone has the swipe and
         doesn't need them taking up space over the photo. The hover media
         query is what distinguishes a device with a real cursor from a
         touchscreen, so they only ever exist where they're useful. */
      .card-arrow { display: none; }
      @media (hover: hover) and (pointer: fine) {
        .card-arrow {
          display: flex; align-items: center; justify-content: center;
          position: absolute; top: 50%; transform: translateY(-50%);
          width: 30px; height: 30px; border-radius: 9999px;
          background: rgba(255,255,255,0.92); color: #14141A;
          box-shadow: 0 2px 10px rgba(0,0,0,0.18);
          opacity: 0; transition: opacity 0.22s ease, transform 0.22s ease;
          z-index: 3; cursor: pointer;
        }
        .card-arrow-left  { left: 8px; }
        .card-arrow-right { right: 8px; }
        /* Revealed by hovering the card, not the arrow itself — otherwise
           you'd have to find an invisible target before it appeared. */
        .group:hover .card-arrow { opacity: 1; }
        .card-arrow:hover { transform: translateY(-50%) scale(1.08); }
      }

      .card-dots {
        position: absolute; left: 0; right: 0; bottom: 8px;
        display: flex; justify-content: center; gap: 4px;
        pointer-events: none;
      }
      .card-dot {
        width: 5px; height: 5px; border-radius: 9999px;
        background: rgba(255,255,255,0.5);
        box-shadow: 0 1px 2px rgba(0,0,0,0.3);
        transition: width 0.25s ease, background 0.25s ease;
      }
      .card-dot.is-active { width: 14px; background: #fff; }

      /* Skeleton shimmer
         ------------------------------------------------------------
         A product photo that hasn't arrived yet used to leave a flat dark
         rectangle — on a fast scroll the grid looked broken rather than
         loading. This reads as "arriving", which is the truth. */
      @keyframes shimmer { 100% { transform: translateX(100%); } }
      .skeleton {
        position: absolute; inset: 0; overflow: hidden;
        background: var(--field-bg);
        /* Skeletons are only ever mounted while a photo is still loading —
           the moment it arrives React unmounts them, so the animation
           stops with the element. Nothing to pause here; noted so it
           isn't "fixed" later by adding an observer that does nothing. */
      }
      .skeleton::after {
        content: ''; position: absolute; inset: 0;
        transform: translateX(-100%);
        background: linear-gradient(90deg, transparent, rgba(255,255,255,0.45), transparent);
        animation: shimmer 1.4s infinite;
      }
      [data-theme="dark"] .skeleton::after {
        background: linear-gradient(90deg, transparent, rgba(255,255,255,0.08), transparent);
      }

      /* Photos fade in instead of snapping, so a grid filling up during a
         scroll feels like one motion rather than things popping. */
      .ph-img { opacity: 0; transition: opacity 0.35s ease; }
      .ph-img.is-loaded { opacity: 1; }

      /* Scroll performance
         ------------------------------------------------------------
         The homepage stacks glass panels, blurred mesh gradients and a
         grain overlay. All three are expensive to repaint, and the browser
         was repainting sections far off-screen on every scroll frame —
         which is where the stutter came from.

         content-visibility lets it skip work for anything not near the
         viewport entirely. contain-intrinsic-size keeps the scrollbar
         honest by reserving the right height, so nothing jumps. */
      .section-lazy {
        content-visibility: auto;
        contain-intrinsic-size: auto 620px;
      }

      /* Keeps the blurred blobs on the GPU instead of forcing a main-thread
         repaint every frame. */
      .mesh-blob, .sale-glow { transform: translateZ(0); backface-visibility: hidden; }

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
        .pick-backdrop, .pick-sheet, .pick-size, .pick-size.is-on, .size-nudge,
        .mesh-blob, .hero-fade-1, .hero-fade-2, .hero-fade-3, .hero-fade-4, .dock-in, .fab-pulse::before, .search-fade, .search-rise, .sale-glow, .promise-divider, .skeleton::after, .marquee-track, .photo-settle, .swipe-hint, .hero-float, .page-in, .count-landed { animation: none !important; }
        .kinetic-line > span { animation: none !important; transform: none !important; }
        .admin-spinner { animation-duration: 2s; }
        .promise-chip, .promise-chip::after { animation: none !important; }
        .promise-chip { opacity: 1 !important; }
        .promise-divider { opacity: 1 !important; }
      }

      .tap-scale { transition: transform 0.15s ease; }

      /* شريط التنقل السفلي — حصري للتطبيق. env(safe-area-inset-bottom)
         بيحسب مساحة أزرار التنقل الأصلية بأندرويد (gesture bar) حتى
         الشريط ما يضل ملزوق تحتها مباشرة. */
      /* ---------- ANIMATED SPLASH (التطبيق بس) ---------- */
      .splash-root {
        position: fixed; inset: 0; z-index: 999;
        display: flex; flex-direction: column;
        align-items: center; justify-content: center;
        background: var(--bg);
        overflow: hidden;
        animation: splashOut 0.45s cubic-bezier(0.4,0,0.2,1) ${SPLASH_TOTAL_MS - 450}ms both;
      }
      .splash-glow {
        position: absolute;
        width: 340px; height: 340px; border-radius: 50%;
        background: radial-gradient(circle, var(--coral) 0%, transparent 70%);
        filter: blur(50px); opacity: 0;
        animation: splashGlow 1.5s ease-out both;
      }
      .splash-ring {
        position: absolute;
        width: 120px; height: 120px; border-radius: 50%;
        border: 2px solid var(--coral);
        opacity: 0;
        animation: splashRing 1.25s cubic-bezier(0.16,1,0.3,1) 0.28s both;
      }
      .splash-logo-wrap { position: relative; display: inline-block; overflow: hidden; }
      .splash-logo {
        display: block; width: 210px; height: auto;
        filter: var(--logo-filter);
        animation: splashLogo 0.95s cubic-bezier(0.34,1.56,0.64,1) 0.12s both;
      }
      .splash-sheen {
        /* Animating the left property makes the browser redo layout every frame.
           Positioning it once and moving it with a transform instead is
           the same effect with none of that — and this runs during app
           startup, the moment the device is busiest. */
        position: absolute; top: 0; bottom: 0; left: 0; width: 45%;
        background: linear-gradient(100deg, transparent, rgba(255,255,255,0.75), transparent);
        animation: splashSheen 0.85s ease-in-out 0.75s both;
      }
      .splash-tagline {
        margin-top: 14px;
        font-family: 'Space Grotesk', sans-serif;
        font-size: 10px; font-weight: 600;
        letter-spacing: 0.42em; text-indent: 0.42em;
        color: var(--fg-muted);
        animation: splashTagline 0.7s ease-out 0.68s both;
      }
      @keyframes splashLogo {
        0%   { opacity: 0; transform: scale(0.72) translateY(14px); }
        100% { opacity: 1; transform: scale(1) translateY(0); }
      }
      @keyframes splashGlow {
        0%   { opacity: 0; transform: scale(0.4); }
        45%  { opacity: 0.30; transform: scale(1.05); }
        100% { opacity: 0.16; transform: scale(1); }
      }
      @keyframes splashRing {
        0%   { opacity: 0; transform: scale(0.5); }
        35%  { opacity: 0.5; }
        100% { opacity: 0; transform: scale(3.6); }
      }
      @keyframes splashSheen {
        0%   { transform: translateX(-160%) skewX(-18deg); opacity: 0; }
        35%  { opacity: 1; }
        100% { transform: translateX(290%) skewX(-18deg); opacity: 0; }
      }
      @keyframes splashTagline {
        0%   { opacity: 0; transform: translateY(8px); letter-spacing: 0.2em; }
        100% { opacity: 1; transform: translateY(0); letter-spacing: 0.42em; }
      }
      @keyframes splashOut {
        0%   { opacity: 1; transform: scale(1); }
        100% { opacity: 0; transform: scale(1.06); visibility: hidden; }
      }
      @media (prefers-reduced-motion: reduce) {
        .splash-root, .splash-glow, .splash-ring, .splash-logo, .splash-sheen, .splash-tagline {
          animation-duration: 0.01ms !important;
          animation-delay: 0ms !important;
        }
        .splash-root { animation: none !important; }
      }

      /* min-height بدل height ثابت: لو المستخدم مكبّر خط النظام، النص
         بيحتاج مساحة أطول — بارتفاع ثابت كان بيطلع برا الشريط. هيك
         الشريط بيتمدد لتحت بهدوء بدل ما ينكسر. */
      .native-tab-bar {
        min-height: 60px;
      }
      /* نفس المنطق للبادجات: بدل أبعاد ثابتة بتقص الرقم لما يكبر الخط،
         منخلي الحد الأدنى ثابت والباقي بيتمدد مع المحتوى. */
      .native-badge {
        min-width: 1.25em;
        min-height: 1.25em;
        padding: 0 0.35em;
        line-height: 1;
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
function Header({ cartCount, likesCount = 0, onHome, onCart, onSearch, onSale, onFavorites, menuOpen, setMenuOpen, goCatalog, navigate }) {
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 12);
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <div className="sticky top-0 z-40 px-3 sm:px-6 pt-3 header-layer">
      <AnnounceBar navigate={navigate} />
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
            {/* the pieces you saved with the heart, on the website too */}
            {likesCount > 0 && (
              <button onClick={onFavorites} className="relative p-2 tap-scale hover:text-coral transition-colors hidden sm:inline-flex" aria-label={`Saved pieces (${likesCount})`}>
                <Heart className="w-5 h-5" />
                <span className="absolute -top-1 -right-1 text-white text-[10px] font-num rounded-full flex items-center justify-center" style={{ minWidth: 18, height: 18, background: "var(--fg)", color: "var(--bg)" }}>{likesCount}</span>
              </button>
            )}
            <button onClick={onCart} className="relative p-2 tap-scale hover:text-coral transition-colors" aria-label="Cart">
              <ShoppingBag className="w-5 h-5" />
              {cartCount > 0 && (
                <span className="absolute -top-1 -right-1 bg-coral text-white text-[10px] font-num rounded-full flex items-center justify-center" style={{ minWidth: 18, height: 18 }}>
                  {cartCount}
                </span>
              )}
            </button>
            <button className="lg:hidden p-2 tap-scale" onClick={() => setMenuOpen((v) => !v)} aria-label="Menu" aria-expanded={menuOpen}>
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
            <button onClick={onFavorites} className="text-left flex items-center gap-1.5 hover:text-coral">
              <Heart className="w-3.5 h-3.5" /> Saved pieces{likesCount ? ` (${likesCount})` : ""}
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
/* A slow band of the things that actually close a sale here — delivery,
   cash on delivery, where the shop is. Sits between the hero and the
   products as a seam, so the two read as one page rather than two
   stacked blocks.

   The list is rendered twice and the track slides by exactly half its
   width; at that moment the second copy sits precisely where the first
   started, so the loop never shows a seam. */
function ValueMarquee() {
  const items = [
    "Delivery across Lebanon",
    "Cash on delivery",
    "3-day exchanges",
    "Saida, Lebanon",
    "Premium. Fresh. Always.",
  ];
  const strip = [...items, ...items];
  const marqueeRef = usePauseOffscreen();
  return (
    /* Was full-bleed while everything else on the page is held to the same
       max width, so it ran out past both edges and broke the page's
       margins. It sits inside the container now, and the text carries
       enough weight to actually be read rather than fading into the
       background. */
    <div className="px-4 sm:px-6">
      <div
        className="marquee-mask overflow-hidden py-3.5 max-w-6xl mx-auto rounded-2xl"
        aria-hidden="true"
        style={{ border: "1px solid var(--border)", background: "var(--glass-bg)" }}
      >
        <div className="marquee-track" ref={marqueeRef}>
          {strip.map((label, i) => (
            <span key={i} className="flex items-center flex-shrink-0">
              <span
                className="font-body font-medium px-6 whitespace-nowrap"
                style={{ fontSize: "0.86rem", color: "var(--fg)", opacity: 0.78, letterSpacing: "0.01em" }}
              >
                {label}
              </span>
              <span style={{ width: 5, height: 5, borderRadius: 9999, background: "var(--coral)" }} />
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}

/* Hairline at the very top that fills as the page does. Scales one element
   horizontally rather than animating a width, so keeping it in sync while
   scrolling costs nothing. */
function ScrollProgress() {
  const [p, setP] = useState(0);
  const { reducedMotion } = useApp();

  useEffect(() => {
    let raf = 0, ticking = false;
    const update = () => {
      const doc = document.documentElement;
      const max = (doc.scrollHeight || 0) - window.innerHeight;
      setP(max > 0 ? Math.min(1, Math.max(0, (window.scrollY || 0) / max)) : 0);
      ticking = false;
    };
    const onScroll = () => {
      if (ticking) return;
      ticking = true;
      raf = requestAnimationFrame(update);
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll, { passive: true });
    update();
    return () => {
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onScroll);
      cancelAnimationFrame(raf);
    };
  }, []);

  if (reducedMotion) return null;
  return <div className="scroll-progress" style={{ transform: `scaleX(${p})` }} aria-hidden="true" />;
}

/* Scroll-linked hero motion.

   The homepage read as separate blocks stacked on top of each other
   rather than one designed page. Tying the hero to the scroll position
   gives the whole thing a spine: the gradient drifts and the headline
   settles back as you move down, so scrolling feels like moving through
   something continuous.

   Cheap by construction — it only ever writes `transform` and `opacity`,
   both of which the GPU handles without a layout pass, and it reads the
   scroll position once per animation frame rather than on every one of
   the dozens of scroll events a fast flick fires. */
function useHeroParallax() {
  const [y, setY] = useState(0);
  const { reducedMotion } = useApp();

  useEffect(() => {
    if (reducedMotion) return;
    let raf = 0;
    let ticking = false;
    const onScroll = () => {
      if (ticking) return;
      ticking = true;
      raf = requestAnimationFrame(() => {
        // Only the first screenful matters; past that the hero is gone.
        setY(Math.min(window.scrollY || 0, 700));
        ticking = false;
      });
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    onScroll();
    return () => { window.removeEventListener("scroll", onScroll); cancelAnimationFrame(raf); };
  }, [reducedMotion]);

  return y;
}

/* The app teaser: app-only prices when there are some, "coming soon"
   otherwise. Shared by the homepage and the previous HomeView. */
function AppTeaser({ appExclusiveCount = 0 }) {
  return (
    <section className="max-w-6xl mx-auto px-4 sm:px-6 pb-20 section-lazy">
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
                  {appExclusiveCount > 0 ? "App-only pieces, waiting" : "The Kanaan Shop app"}
                </p>
                <p className="font-body text-sm text-muted mt-1 max-w-sm">
                  {appExclusiveCount > 0
                    ? `${appExclusiveCount} ${appExclusiveCount === 1 ? "piece is" : "pieces are"} only in the app right now.`
                    : "Faster shopping, your saved pieces, and a note when your size is back."} Android now; iPhone is on its way.
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <a href="https://play.google.com/store/apps/details?id=com.kanaanshop.app" target="_blank" rel="noopener noreferrer" className="glass-btn rounded-full font-body font-medium text-sm px-5 py-2.5 tap-scale" style={{ background: "var(--fg)", color: "var(--bg)" }}>Get it on Google Play</a>
              <GlassChip>iPhone soon</GlassChip>
            </div>
          </div>
        </div>
      </Reveal>
    </section>
  );
}

function HomeView({ products, loading, goCatalog, goSale, openProduct, likes, toggleLike, appExclusiveCount }) {
  useEffect(() => {
    document.title = `${STORE_NAME} — Menswear from Saida, Lebanon`;
  }, []);

  /* "New in" used to be simply the 12 most recent products, which meant
     adding ten pairs of trousers in one sitting filled the entire homepage
     with trousers. Taking the two newest from each category instead keeps
     the shop looking like a shop — several kinds of thing, all of them
     recent — no matter how the stock happens to arrive.

     Categories are visited in the site's own order, newest first within
     each, and anything left over backfills to 12 so the grid never ends
     ragged. */
  const featured = useMemo(() => {
    const PER_CATEGORY = 2;
    const TOTAL = 12;
    const picked = [];
    const used = new Set();

    for (const c of CATEGORIES) {
      const fromCategory = products.filter((p) => p.category === c.id).slice(0, PER_CATEGORY);
      for (const p of fromCategory) {
        picked.push(p);
        used.add(p.id);
      }
    }

    // Newest first across the whole selection, so the freshest arrivals
    // still lead regardless of which category they came from.
    picked.sort((a, b) => products.indexOf(a) - products.indexOf(b));

    /* Backfill, if the shop doesn't yet stock enough categories to reach
       twelve. Takes a third from every category, then a fourth, and so on
       — rather than emptying one category into the gap, which would put
       us back where we started. */
    let round = PER_CATEGORY;
    while (picked.length < TOTAL && round < 12) {
      let addedThisRound = false;
      for (const c of CATEGORIES) {
        if (picked.length >= TOTAL) break;
        const next = products.filter((p) => p.category === c.id)[round];
        if (next && !used.has(next.id)) {
          picked.push(next);
          used.add(next.id);
          addedThisRound = true;
        }
      }
      if (!addedThisRound) break; // nothing left anywhere
      round++;
    }

    picked.sort((a, b) => products.indexOf(a) - products.indexOf(b));
    return picked.slice(0, TOTAL);
  }, [products]);
  const onSale = useMemo(() => products.filter(isOnSale), [products]);
  const saleCount = onSale.length;
  const maxDiscount = saleCount ? Math.max(...onSale.map((p) => p.discount)) : 0;
  const [spot, setSpot] = useState({ x: 50, y: 50 });
  const scrollY = useHeroParallax();
  const heroRef = usePauseOffscreen();

  // Two photographed pieces for the desktop hero. Skipped entirely if the
  // shop doesn't have two products with real photos yet.
  const heroPicks = useMemo(
    () => products.filter((p) => p.active !== false && getImages(p).length > 0).slice(0, 2),
    [products]
  );

  const onHeroMove = (e) => {
    const rect = e.currentTarget.getBoundingClientRect();
    setSpot({ x: ((e.clientX - rect.left) / rect.width) * 100, y: ((e.clientY - rect.top) / rect.height) * 100 });
  };

  return (
    <div>
      <ScrollProgress />
      {/* The hero starts ABOVE the header, not below it.

          Before, the page began where the header ended, so the top of the
          screen was a plain grey strip with the header sitting in it and
          the colour only starting underneath — the header read as pasted
          on rather than part of the page. Pulling the section up by the
          header's height puts the glow behind it, and the padding below
          puts it back so nothing is covered. The chip still clears the
          header, which is what the padding was added for originally. */}
      {/* Pausing the whole hero covers everything inside it at once — the
          drifting glow, the breathing delivery chips, the floating product
          pair. Once you've scrolled past, none of it needs a single frame
          of work. */}
      <section
        ref={heroRef}
        onMouseMove={onHeroMove}
        className="relative px-4 sm:px-6 pb-14 sm:pb-20 overflow-hidden"
        style={{ marginTop: "calc(-1 * var(--header-h))", paddingTop: "calc(var(--header-h) + 3.5rem)" }}
      >
        {/* The gradient drifts slower than the page — the depth cue that
            makes the hero feel like a layer rather than a flat block.

            This wrapper MUST be positioned. A transform turns an element
            into the containing block for its absolutely-positioned
            children, and as a plain flow div this one had zero height —
            so the mesh inside it, sized with inset:0, collapsed to nothing
            and got clipped away entirely. That's the moment the glow
            vanished: not a colour problem, a layout one. */}
        <div
          className="absolute inset-0 pointer-events-none"
          style={{ transform: `translate3d(0, ${scrollY * 0.28}px, 0)`, willChange: "transform" }}
        >
          <MeshBackground variant="hero" />
        </div>
        <div className="pointer-events-none absolute inset-0 transition-opacity duration-300" style={{ background: `radial-gradient(600px circle at ${spot.x}% ${spot.y}%, rgba(255,255,255,0.06), transparent 60%)` }} />
        {/* Content eases back and fades as it leaves, so the handover to the
            next section is a movement rather than a hard cut. */}
        <div
          className="max-w-6xl mx-auto relative"
          style={{
            /* The hero used to fade as you scrolled past it while every
               other section stayed sharp — which read as the top of the
               page being washed out rather than as a deliberate handoff.
               The parallax shift stays (that's the depth cue); the fade
               is gone, so the whole page now holds the same contrast. */
            transform: `translate3d(0, ${scrollY * -0.08}px, 0)`,
            willChange: "transform",
          }}
        >
          <div className="mb-6 hero-fade-1">
            <GlassChip tone="coral">
              <MapPin className="w-3 h-3" /> Saida, Lebanon
            </GlassChip>
          </div>
          {/* Each line rises out of its own clipping window — the hero
              moment the page was missing. */}
          <h1 className="font-display font-bold text-5xl sm:text-7xl leading-[1.05] max-w-3xl">
            <span className="kinetic-line kinetic-1"><span>Kanaan Shop</span></span>
            <span className="kinetic-line kinetic-2 text-coral"><span>Everyday wear, refined</span></span>
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

          {/* On a laptop the hero text only ever filled the left half and
              the right half sat empty — the headline was sized for a phone
              and simply left a hole on a wide screen. These two products
              fill it with the thing the page is actually selling, and they
              only exist from lg upwards, so nothing changes on mobile. */}
          {heroPicks.length === 2 && (
            <div className="hidden lg:block absolute right-0 top-1/2" style={{ transform: "translateY(-50%)", width: 380 }}>
              <div className="relative" style={{ height: 420 }}>
                {heroPicks.map((p, i) => (
                  <button
                    key={p.id}
                    onClick={() => openProduct(p)}
                    className="absolute rounded-3xl overflow-hidden hero-float"
                    style={{
                      width: 210,
                      aspectRatio: "4/5",
                      // Overlapped and slightly rotated so they read as a
                      // considered pair, not a second grid.
                      left: i === 0 ? 0 : 140,
                      top: i === 0 ? 0 : 96,
                      transform: `rotate(${i === 0 ? -4 : 5}deg)`,
                      zIndex: i,
                      boxShadow: "0 18px 50px rgba(20,20,26,0.18)",
                      animationDelay: `${i * 1.6}s`,
                    }}
                    aria-label={p.name}
                  >
                    <img
                      src={thumbUrlFor(getImages(p)[0]) || getImages(p)[0]}
                      alt={p.name}
                      className="w-full h-full"
                      style={{ objectFit: "cover" }}
                      loading="lazy"
                      decoding="async"
                    />
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      </section>

      <ValueMarquee />


      <section className="max-w-6xl mx-auto px-4 sm:px-6 py-10 section-lazy">
        <div className="grid grid-cols-2 lg:grid-cols-4 lg:grid-rows-2 gap-4">
          <Reveal className="col-span-2">
            {/* Only the small "Explore the drop" link used to be tappable —
                the Sale card right below it is a button edge to edge, so
                tapping this one anywhere but that link did nothing. Now the
                whole card is the target, and it lifts on press the same way
                its neighbour does. */}
            <button
              onClick={() => goCatalog("all")}
              className="glass glass-sheen sale-card group rounded-3xl p-6 h-full w-full flex flex-col justify-between relative overflow-hidden text-left tap-scale"
              style={{ minHeight: 150 }}
              aria-label="New season just landed — explore the drop"
            >
              <MeshBackground variant="card" />
              <span className="relative block">
                <Sparkles className="w-5 h-5 text-coral mb-3" />
                <span className="block font-display font-bold text-xl leading-snug">New season<br />just landed</span>
              </span>
              <span className="relative font-body text-sm text-coral mt-4 inline-flex items-center gap-1.5">
                Explore the drop
                <ArrowRight className="w-4 h-4 transition-transform duration-300 group-hover:translate-x-1" />
              </span>
            </button>
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
            { icon: RotateCcw, label: "3-day exchanges" },
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

      <section className="max-w-6xl mx-auto px-4 sm:px-6 pb-14 section-lazy">
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
                  <ProductCard product={p} onOpen={openProduct} liked={likes.includes(p.id)} onToggleLike={toggleLike} />
                </Reveal>
              ))}
        </div>
        {!loading && featured.length === 0 && (
          <p className="font-body text-muted text-sm text-center py-8">Products are on their way — check back soon.</p>
        )}
      </section>

      {/* Mobile app teaser — bento-style, moved here from the footer */}
      <AppTeaser appExclusiveCount={appExclusiveCount} />
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

function NativeHomeView({ products, loading, error, onRetry, goCatalog, goSale, goExclusives, openProduct, likes, toggleLike, goFavorites, onCart, cartCount }) {
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
                className="glass rounded-xl flex flex-col items-center justify-center gap-1.5 tap-scale py-2"
                /* minHeight بدل aspectRatio ثابت: مع تكبير خط النظام،
                   اسم الفئة بيلف على سطرين وبيحتاج ارتفاع أكبر —
                   بنسبة ثابتة كان بينقص وبيتقص النص. */
                style={{ minHeight: "4.5rem" }}
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
                <ProductCard product={p} onOpen={openProduct} liked={likes.includes(p.id)} onToggleLike={toggleLike} />
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
        ) : error && products.length === 0 ? (
          <div className="px-4 sm:px-6">
            <p className="font-body text-sm text-muted mb-2">Couldn't load products — check your connection.</p>
            <button onClick={onRetry} className="font-body text-sm text-coral">Try again</button>
          </div>
        ) : featured.length === 0 ? (
          <p className="font-body text-sm text-muted px-4 sm:px-6">Products are on their way — check back soon.</p>
        ) : (
          <div className="flex gap-4 overflow-x-auto px-4 sm:px-6 pb-1" style={{ scrollbarWidth: "none" }}>
            {featured.map((p) => (
              <div key={p.id} className="flex-shrink-0" style={{ width: 150 }}>
                <ProductCard product={p} onOpen={openProduct} liked={likes.includes(p.id)} onToggleLike={toggleLike} />
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
            <ProductCard key={p.id} product={p} onOpen={openProduct} liked={likes.includes(p.id)} onToggleLike={toggleLike} />
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
              <ProductCard product={p} onOpen={openProduct} liked={true} onToggleLike={toggleLike} />
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

function CatalogView({ activeCategory, activeSub, loading, error, onRetry, goCatalog, products, openProduct, likes, toggleLike }) {
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
      ) : error && products.length === 0 ? (
        <div className="py-16 text-center">
          <p className="font-body text-muted text-sm mb-3">Couldn't load products — check your connection.</p>
          <button onClick={onRetry} className="glass rounded-full font-body text-sm px-5 py-2 tap-scale">Try again</button>
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
                <ProductCard product={p} onOpen={openProduct} liked={likes.includes(p.id)} onToggleLike={toggleLike} />
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
  const isShoe = /shoe|slipper|sandal|sneaker|boot/i.test(String(category || ""));
  // Esc closes the guide only (not the size sheet under it): heard first, and kept from the sheet
  useEffect(() => {
    const onKey = (e) => { if (e.key === "Escape") { e.stopPropagation(); onClose(); } };
    window.addEventListener("keydown", onKey, true);
    return () => window.removeEventListener("keydown", onKey, true);
  }, [onClose]);
  return (
    <div className="fixed inset-0 z-[80] flex items-end sm:items-center sm:justify-center" onClick={onClose}>
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

/* The size sheet. On a phone, "Add" on a product page no longer drops the
   piece straight into the bag with whatever size happened to be selected:
   it opens this sheet — the photo, the colours, big size buttons with what
   is left in each, and an "Add to cart" that only lights up once a size is
   chosen. Tapping it without a size shakes the sizes. Swipe it down, tap
   outside or press Esc to close. */
function SizeSheet({ product, color, onColor, size, onSize, qty, setQty, onAdd, onClose, onSizeGuide }) {
  const [nudge, setNudge] = useState(0);
  const [dragY, setDragY] = useState(0);
  const drag = useRef(null);
  const firstSize = useRef(null);
  const available = size ? stockFor(product, color, size) : 0;
  const canAdd = !!size && available > 0;
  const photo = getImagesForColor(product, color)[0]?.url;

  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKey = (e) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", onKey);
    // keyboards land on the sizes, the choice that matters here
    const t = setTimeout(() => firstSize.current && firstSize.current.focus({ preventScroll: true }), 80);
    return () => { document.body.style.overflow = prev; window.removeEventListener("keydown", onKey); clearTimeout(t); };
  }, []); // eslint-disable-line

  const tryAdd = () => {
    if (!canAdd) { setNudge((n) => n + 1); hapticLight(); return; }
    onAdd();
  };

  // swipe down on the top of the sheet to close it
  const onDown = (e) => { drag.current = { y: e.clientY, id: e.pointerId }; e.currentTarget.setPointerCapture?.(e.pointerId); };
  const onMove = (e) => { if (drag.current) setDragY(Math.max(0, e.clientY - drag.current.y)); };
  const onUp = () => { if (!drag.current) return; drag.current = null; if (dragY > 90) onClose(); else setDragY(0); };

  let firstAssigned = false;
  return (
    <div className="fixed inset-0 z-[70] flex items-end justify-center" role="dialog" aria-modal="true" aria-label={`Choose your size — ${product.name}`}>
      <div className="pick-backdrop absolute inset-0" onClick={onClose} />
      <div
        className="pick-sheet relative w-full sm:max-w-md rounded-t-[28px] px-5 pt-2"
        style={{ paddingBottom: "calc(20px + env(safe-area-inset-bottom, 0px))", transform: dragY ? `translateY(${dragY}px)` : undefined, transition: drag.current ? "none" : "transform 0.25s ease" }}
      >
        <div className="flex justify-center pt-1 pb-3 cursor-grab touch-none" onPointerDown={onDown} onPointerMove={onMove} onPointerUp={onUp} onPointerCancel={onUp}>
          <span style={{ width: 40, height: 5, borderRadius: 5, background: "var(--border)" }} />
        </div>

        <div className="flex items-center gap-3 mb-5">
          {photo ? (
            <img src={photo} alt="" className="rounded-2xl flex-shrink-0" style={{ width: 64, height: 80, objectFit: "cover", background: "var(--field-bg)" }} />
          ) : (
            <div className="rounded-2xl flex-shrink-0 flex items-center justify-center" style={{ width: 64, height: 80, background: "var(--field-bg)" }}><Shirt className="w-5 h-5 text-muted" /></div>
          )}
          <div className="flex-1 min-w-0">
            <p className="font-display font-semibold text-base leading-tight truncate">{product.name}</p>
            <p className="mt-1">
              <span className={`font-num text-lg ${product.discount > 0 ? "text-coral" : ""}`}>{money(effectivePrice(product))}</span>
              {product.discount > 0 && <span className="font-num text-sm text-muted line-through ml-2">{money(product.price)}</span>}
            </p>
          </div>
          <button onClick={onClose} className="glass rounded-full p-2 tap-scale flex-shrink-0" aria-label="Close"><X className="w-4 h-4" /></button>
        </div>

        {product.colors.length > 1 && (
          <div className="mb-5">
            <p className="font-body text-sm mb-2">
              <span className="text-muted">Colour</span> <span className="font-medium">{COLORS[color]?.label || color}</span>
            </p>
            <div className="flex gap-2.5 flex-wrap">
              {product.colors.map((key) => {
                const inStock = colorHasStock(product, key);
                return (
                  <button
                    key={key}
                    onClick={() => inStock && onColor(key)}
                    disabled={!inStock}
                    className="relative w-10 h-10 rounded-full border-2 tap-scale"
                    style={{ borderColor: color === key ? "var(--coral)" : "transparent", boxShadow: "0 0 0 1px var(--border)", opacity: inStock ? 1 : 0.35 }}
                    aria-label={`${COLORS[key]?.label || key}${inStock ? "" : " (out of stock)"}`}
                    aria-pressed={color === key}
                  >
                    <span className="block w-full h-full rounded-full" style={{ background: swatchBackground(key) }} />
                  </button>
                );
              })}
            </div>
          </div>
        )}

        <div className="flex items-baseline justify-between mb-2.5">
          <p className="font-display font-bold text-xl">{size ? <>Size <span className="text-coral">{size}</span></> : "Pick your size"}</p>
          <button onClick={onSizeGuide} className="font-body text-sm text-coral tap-scale">Size guide</button>
        </div>
        <div key={nudge} className={`grid grid-cols-4 gap-2 p-0.5 ${nudge ? "size-nudge" : ""}`} role="radiogroup" aria-label="Size">
          {product.sizes.map((sz, i) => {
            const left = stockFor(product, color, sz);
            const inStock = left > 0;
            const on = size === sz && inStock;
            const low = product.tracked && inStock && left <= 3;
            const ref = inStock && !firstAssigned ? (firstAssigned = true, firstSize) : undefined;
            return (
              <button
                key={sz}
                ref={ref}
                role="radio"
                aria-checked={on}
                onClick={() => { if (inStock) { onSize(sz); setQty(1); hapticLight(); } }}
                disabled={!inStock}
                className={`pick-size tap-scale rounded-2xl flex flex-col items-center justify-center ${on ? "is-on" : ""}`}
                style={{
                  animationDelay: on ? "0s" : `${0.05 + i * 0.035}s`,
                  height: 58,
                  background: on ? "var(--fg)" : "var(--field-bg)",
                  color: on ? "var(--bg)" : "var(--fg)",
                  border: on ? "1px solid var(--fg)" : "1px solid var(--border)",
                  opacity: inStock ? 1 : 0.38,
                  cursor: inStock ? "pointer" : "not-allowed",
                }}
                aria-label={`${sz}${inStock ? (low ? `, ${left} left` : "") : ", out of stock"}`}
              >
                <span className="font-num text-lg leading-none" style={{ textDecoration: inStock ? "none" : "line-through" }}>{sz}</span>
                {low && <span className="font-body leading-none mt-1" style={{ fontSize: 11, color: on ? "var(--bg)" : "var(--coral)", opacity: on ? 0.8 : 1 }}>{left} left</span>}
              </button>
            );
          })}
        </div>

        <div className="flex items-center gap-3 mt-5">
          {canAdd && available > 1 && (
            <div className="glass flex items-center rounded-full flex-shrink-0">
              <button onClick={() => setQty((q) => Math.max(1, q - 1))} className="p-3 tap-scale" aria-label="Decrease quantity"><Minus className="w-4 h-4" /></button>
              <span className="font-num w-6 text-center">{qty}</span>
              <button onClick={() => setQty((q) => Math.min(available, q + 1))} disabled={qty >= available} className="p-3 tap-scale" aria-label="Increase quantity"><Plus className="w-4 h-4" /></button>
            </div>
          )}
          <button
            onClick={tryAdd}
            className="pick-cta glass-btn flex-1 rounded-full font-body font-medium py-4 tap-scale flex items-center justify-center gap-2"
            style={canAdd ? { background: "var(--coral)", color: "#fff" } : { background: "var(--field-bg)", color: "var(--fg-muted)", border: "1px solid var(--border)" }}
          >
            {canAdd ? (<><ShoppingCart className="w-5 h-5" /> Add to cart · <span className="font-num">{money(effectivePrice(product) * qty)}</span></>) : "Pick a size to add"}
          </button>
        </div>
      </div>
    </div>
  );
}

function ProductView({ product, products, addToCart, openProduct, liked, toggleLike, likes = [], onLike = NOOP }) {
  const site = useSiteSettings();
  // no size is chosen for the shopper (unless there's only one): picking it
  // is a deliberate tap, so nobody ends up with the wrong size by accident
  const [size, setSize] = useState(null);
  const [color, setColor] = useState(product.colors[0]);
  const [qty, setQty] = useState(1);
  const [added, setAdded] = useState(false);
  const [copied, setCopied] = useState(false);
  const [notifyState, setNotifyState] = useState("idle"); // idle | loading | done | unavailable
  const [showSizeGuide, setShowSizeGuide] = useState(false);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [sizeNudge, setSizeNudge] = useState(0);
  const sizeRowRef = useRef(null);

  useEffect(() => {
    // Start on a colour that's actually in stock where possible; the size
    // is the shopper's to pick (pre-chosen only when there is just one).
    const firstColor = product.colors.find((c) => colorHasStock(product, c)) || product.colors[0];
    setColor(firstColor);
    const inStockSizes = product.sizes.filter((s) => stockFor(product, firstColor, s) > 0);
    setSize(product.sizes.length === 1 && inStockSizes.length === 1 ? inStockSizes[0] : null);
    setQty(1);
    setAdded(false);
    setSheetOpen(false);
    addRecentlyViewed(product.id);
  }, [product.id]); // eslint-disable-line

  useEffect(() => {
    document.title = `${product.name} — ${STORE_NAME}`;
  }, [product.name]);

  const related = products.filter((p) => p.category === product.category && p.id !== product.id).slice(0, 3);
  const productUrl = `${SITE_URL}/product/${product.slug}`;

  const available = size ? stockFor(product, color, size) : 0;
  const outOfStock = product.soldOut || !productHasStock(product);
  const canAdd = !outOfStock && !!size && available > 0;

  // Switching colour: if the chosen size isn't available in it, the size
  // is cleared rather than silently swapped for another one.
  const pickColor = (key) => {
    setColor(key);
    if (size && stockFor(product, key, size) <= 0) setSize(null);
    setQty(1);
  };

  const handleAdd = () => {
    if (!canAdd) return;
    addToCart(product, size, color, COLORS[color]?.label || color, qty);
    setAdded(true);
    setTimeout(() => setAdded(false), 1800);
  };

  // "Add" without a size, on a bigger screen: bring the sizes into view and
  // give them a small shake
  const nudgeSizes = () => {
    setSizeNudge((n) => n + 1);
    hapticLight();
    sizeRowRef.current?.scrollIntoView({ behavior: "smooth", block: "center" });
  };

  // the sheet's "Add to cart": close it, then add (the cart slides open)
  const addFromSheet = () => {
    setSheetOpen(false);
    setTimeout(handleAdd, 180);
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

  // Renamed from "nativeShare" — that name was shadowing the real
  // nativeShare() imported from native.js, so the proper Capacitor share
  // sheet was never actually being called inside the app; this was
  // silently falling back to the plain web Share API the whole time.
  const handleWebShare = () => {
    if (navigator.share) {
      navigator.share({ title: product.name, text: product.desc, url: productUrl }).catch(() => {});
    }
  };

  const handleShare = async () => {
    if (isNativeApp) {
      const ok = await nativeShare({ title: product.name, text: product.desc, url: productUrl });
      if (!ok) handleWebShare(); // Capacitor unavailable/cancelled — fall back to the web sheet
    } else {
      handleWebShare();
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

          <div className="mb-8" ref={sizeRowRef}>
            <div className="flex items-center justify-between mb-2">
              <p className="font-body text-sm font-medium">{size ? <>Size <span className="text-coral">{size}</span></> : "Pick your size"}</p>
              <button onClick={() => setShowSizeGuide(true)} className="font-body text-xs text-coral hover:underline">Size guide</button>
            </div>
            <div key={sizeNudge} className={`flex flex-wrap gap-2 p-0.5 ${sizeNudge ? "size-nudge" : ""}`} role="radiogroup" aria-label="Size">
              {product.sizes.map((sz) => {
                const left = stockFor(product, color, sz);
                const inStock = left > 0;
                return (
                  <button
                    key={sz}
                    role="radio"
                    aria-checked={size === sz && inStock}
                    aria-label={inStock ? `Size ${sz}` : `Size ${sz}, sold out`}
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
            {size && product.tracked && available > 0 && available <= 3 && (
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
            ) : !size ? (
              <button onClick={nudgeSizes} className="w-full rounded-full font-body font-medium py-3 flex items-center justify-center gap-2 tap-scale" style={{ background: "var(--glass-bg)", border: "1px solid var(--glass-border)", color: "var(--fg)" }}>
                Pick a size to add
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
            {(isNativeApp || (typeof navigator !== "undefined" && navigator.share)) && (
              <button onClick={handleShare} className="glass rounded-full p-2.5 tap-scale hover:opacity-80 transition-opacity" aria-label="Share">
                <Share2 className="w-4 h-4" />
              </button>
            )}
          </div>

          <div className="mt-8 pt-6 border-t grid grid-cols-3 gap-3 text-center" style={{ borderColor: "var(--border)" }}>
            {[
              { icon: Truck, label: site.freeOver ? `Free delivery from ${money(site.freeOver)}` : `${money(site.deliveryFee)} delivery, all Lebanon` },
              { icon: ShieldCheck, label: "Cash on delivery" },
              site.exchangeDays > 0 ? { icon: RotateCcw, label: `Exchange within ${site.exchangeDays} days` } : { icon: MapPin, label: "Try it on in Saida" },
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
              <ProductCard key={p.id} product={p} onOpen={openProduct} liked={likes.includes(p.id)} onToggleLike={onLike} />
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
            <p className="font-body text-xs text-muted truncate">{product.name}{size && !outOfStock ? ` · ${size}` : ""}</p>
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
          ) : outOfStock ? (
            <button disabled className="rounded-full font-body font-medium px-5 py-2.5 flex items-center gap-2 flex-shrink-0 cursor-not-allowed" style={{ border: "1px solid var(--glass-border)", color: "var(--fg-muted)" }}>
              Sold out
            </button>
          ) : (
            <button onClick={() => setSheetOpen(true)} className="pick-open glass-btn rounded-full font-body font-medium px-5 py-2.5 tap-scale flex items-center gap-2 flex-shrink-0" style={{ background: "var(--coral)", color: "#fff" }}>
              {added ? <Check className="w-4 h-4" /> : <ShoppingCart className="w-4 h-4" />}
              {added ? "Added" : size ? "Add to cart" : "Choose size"}
            </button>
          )}
        </div>
      </div>

      {sheetOpen && (
        <SizeSheet
          product={product}
          color={color}
          onColor={pickColor}
          size={size}
          onSize={setSize}
          qty={qty}
          setQty={setQty}
          onAdd={addFromSheet}
          onClose={() => setSheetOpen(false)}
          onSizeGuide={() => setShowSizeGuide(true)}
        />
      )}
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

function CartDrawer({ open, onClose, cart, products = [], updateQty, removeFromCart, total, onCheckout }) {
  const site = useSiteSettings();
  const delivery = deliveryFor(site, total);
  // a piece that sold out or left the shop since it went in the bag says so here, not at the last step
  const gone = (item) => {
    if (!products.length) return false;
    const p = products.find((x) => x.id === item.productId);
    return !p || p.soldOut || stockFor(p, item.colorKey, item.size) <= 0;
  };
  const blocked = cart.some(gone);
  useEffect(() => {
    if (!open) return undefined;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKey = (e) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", onKey);
    return () => { document.body.style.overflow = prev; window.removeEventListener("keydown", onKey); };
  }, [open]); // eslint-disable-line
  return (
    <>
      <div onClick={onClose} className={`fixed inset-0 z-40 transition-opacity ${open ? "opacity-100 pointer-events-auto" : "opacity-0 pointer-events-none"}`} style={{ background: "rgba(0,0,0,0.4)", backdropFilter: "blur(2px)" }} />
      <aside
        role="dialog"
        aria-modal="true"
        aria-label="Your cart"
        aria-hidden={!open}
        inert={!open}
        className="glass fixed right-3 w-[calc(100%-24px)] sm:w-96 z-50 rounded-3xl transition-transform duration-300 flex flex-col"
        style={{
          transform: open ? "translateX(0)" : "translateX(calc(100% + 24px))",
          visibility: open ? "visible" : "hidden",
          transitionProperty: "transform, visibility",
          top: isNativeApp ? "calc(0.75rem + env(safe-area-inset-top, 0px))" : "0.75rem",
          bottom: isNativeApp ? "calc(0.75rem + env(safe-area-inset-bottom, 0px))" : "0.75rem",
        }}
      >
        <div className="flex items-center justify-between p-5 border-b" style={{ borderColor: "var(--border)" }}>
          <h2 className="font-display font-bold text-lg">Your cart</h2>
          <button onClick={onClose} className="w-10 h-10 -mr-2 rounded-full flex items-center justify-center tap-scale" aria-label="Close">
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
            cart.map((item) => {
              const out = gone(item);
              return (
                <div key={item.key} className="flex gap-3" style={out ? { opacity: 0.75 } : undefined}>
                  <CartItemThumb item={item} />
                  <div className="flex-1 min-w-0">
                    <p className="font-body text-sm font-medium truncate">{item.name}</p>
                    <p className="font-body text-xs text-muted">{item.color} · {item.size}</p>
                    {out ? (
                      <p className="font-body text-xs font-medium mt-2" style={{ color: "var(--coral)" }}>Sold out — remove it to check out</p>
                    ) : (
                      <div className="flex items-center justify-between mt-2">
                        <div className="flex items-center rounded-full" style={{ background: "var(--field-bg)", border: "1px solid var(--border)" }}>
                          <button onClick={() => (item.qty > 1 ? updateQty(item.key, -1) : removeFromCart(item.key))} className="w-9 h-9 flex items-center justify-center tap-scale" aria-label={item.qty > 1 ? "One less" : "Remove"}>
                            {item.qty > 1 ? <Minus className="w-3.5 h-3.5" /> : <X className="w-3.5 h-3.5" />}
                          </button>
                          <span className="font-num text-sm w-6 text-center" aria-live="polite">{item.qty}</span>
                          <button onClick={() => updateQty(item.key, 1)} className="w-9 h-9 flex items-center justify-center tap-scale" aria-label="One more">
                            <Plus className="w-3.5 h-3.5" />
                          </button>
                        </div>
                        <span className="font-num text-sm">{money(item.price * item.qty)}</span>
                      </div>
                    )}
                  </div>
                  <button onClick={() => removeFromCart(item.key)} className="w-9 h-9 -mt-1.5 -mr-2 rounded-full flex items-center justify-center text-muted hover:text-coral transition-colors self-start" aria-label={`Remove ${item.name}`}>
                    <X className="w-4 h-4" />
                  </button>
                </div>
              );
            })
          )}
        </div>

        {cart.length > 0 && (
          <div className="p-5 border-t space-y-1" style={{ borderColor: "var(--border)" }}>
            <FreeDeliveryMeter subtotal={total} money={money} />
            <div className="flex items-center justify-between font-body text-sm">
              <span className="text-muted">Subtotal</span>
              <span className="font-num text-lg">{money(total)}</span>
            </div>
            <p className="font-body text-xs text-muted mb-3">{delivery ? `+ ${money(delivery)} delivery, paid at your door` : "Free delivery · pay at your door"}</p>
            <button onClick={onCheckout} disabled={blocked} className="glass-btn w-full font-body font-semibold py-3.5 rounded-full tap-scale" style={{ background: "var(--coral)", color: "#fff", opacity: blocked ? 0.5 : 1 }}>
              {blocked ? "Remove the sold-out piece first" : "Checkout"}
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
function CheckoutView({ cart, total, onSubmitted, goCatalog }) {
  // the delivery details of the last order (kept on this device when the
  // shopper said so), so the next checkout is two taps
  const [saved] = useState(() => loadCheckoutInfo());
  const [form, setForm] = useState(() => ({
    name: "", phone: "", area: "", address: "", notes: "",
    ...(saved || {}),
  }));
  const [remember, setRemember] = useState(true);
  const [error, setError] = useState("");
  const [bad, setBad] = useState(""); // the field to fix
  const [sending, setSending] = useState(false);
  const [offline, setOffline] = useState(false); // the shop's server couldn't be reached: WhatsApp instead
  const site = useSiteSettings();
  const refs = { name: useRef(null), phone: useRef(null), area: useRef(null), address: useRef(null) };

  useEffect(() => {
    document.title = `Checkout — ${STORE_NAME}`;
  }, []);

  const set = (k) => (e) => { setForm((f) => ({ ...f, [k]: e.target.value })); if (bad === k) { setBad(""); setError(""); } };
  const delivery = deliveryFor(site, total);
  const grandTotal = total + delivery;
  const phoneOk = parsePhone(form.phone);

  /* The WhatsApp message: the server's own lines and totals when the order
     was saved (what the shop's program shows), the cart's otherwise. */
  const buildMessage = (o) => {
    const lines = [
      o.orderNumber ? `New order from ${STORE_NAME} — Order #${o.orderNumber}` : `New order from ${STORE_NAME}`,
      "",
      ...o.items.map((i) => `• ${i.name} — ${i.color} / ${i.size} × ${i.qty} = ${money(i.price * i.qty)}`),
      "",
      `Subtotal: ${money(o.subtotal)}`,
      `Delivery: ${o.delivery ? money(o.delivery) : "free"}`,
      `Total: ${money(o.total)}`,
      "",
      `Name: ${o.name}`,
      `Phone: ${o.phone}`,
      o.area ? `Governorate: ${o.area}` : null,
      `Address: ${o.address}`,
      o.notes ? `Notes: ${o.notes}` : null,
      "",
      "Payment: cash on delivery",
    ].filter((x) => x !== null);
    return lines.join("\n");
  };
  const waLink = (o) => `https://wa.me/${WHATSAPP_NUMBER}?text=${encodeURIComponent(buildMessage(o))}`;

  const check = () => {
    if (!form.name.trim()) return ["name", "Write your name, so the driver knows who to ask for."];
    if (!form.phone.trim()) return ["phone", "Add a phone number — the driver calls it before coming."];
    if (!phoneOk) return ["phone", "Check the phone number — for example 03 123 456 or 70 123 456 (with + for a number outside Lebanon)."];
    if (!form.area) return ["area", "Choose your governorate."];
    if (form.address.trim().length < 6) return ["address", "Write the address: town, street, building — and a landmark helps."];
    return null;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    const problem = check();
    if (problem) {
      setBad(problem[0]); setError(problem[1]);
      const el = refs[problem[0]] && refs[problem[0]].current;
      if (el) { el.focus(); el.scrollIntoView({ block: "center", behavior: "smooth" }); }
      return;
    }
    setError(""); setBad(""); setOffline(false);
    setSending(true);
    const phone = phoneOk.pretty;
    let res = null; let data = {};
    try {
      // the order is registered first (the shop holds the pieces and sees it in Kanaan POS at once)
      res = await fetchWithTimeout(`${apiBase}/api/orders`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: form.name.trim(), phone, area: form.area,
          address: form.address.trim(), notes: form.notes.trim(),
          pricing: 2,
          items: cart.map((i) => ({
            productId: i.productId, colorKey: i.colorKey, color: i.color,
            size: i.size, qty: i.qty,
          })),
        }),
      }, 15000);
      data = await res.json().catch(() => ({}));
    } catch {
      // no answer from the shop's server: nothing was saved. The cart stays; the order can go on WhatsApp.
      setSending(false);
      setOffline(true);
      return;
    }
    if (!res.ok) {
      setSending(false);
      setError(data.error || "Something went wrong. Please try again.");
      if (data.field && refs[data.field]) setBad(data.field);
      return;
    }
    const order = {
      ...form, phone: data.phone || phone, orderNumber: data.orderNumber,
      items: data.items || cart, subtotal: data.subtotal ?? total, delivery: data.delivery ?? delivery, total: data.total ?? grandTotal,
      count: cart.reduce((sum, i) => sum + i.qty, 0),
    };
    order.waUrl = waLink(order);
    if (remember) saveCheckoutInfo({ name: form.name.trim(), phone: order.phone, area: form.area, address: form.address.trim() }); else forgetCheckoutInfo();
    // the sound and the buzz before WhatsApp takes over the screen (in the app it would be cut short)
    hapticSuccess();
    playSuccessChime();
    setSending(false);
    if (isNativeApp) {
      setTimeout(() => { window.open(order.waUrl, "_blank"); }, 380);
      order.waOpened = true;
    } else {
      // a browser may not let a page open WhatsApp after waiting for the server: the thank-you page has the button
      let w = null;
      try { w = window.open(order.waUrl, "_blank"); } catch { w = null; }
      order.waOpened = !!w;
    }
    onSubmitted(order);
  };

  // the server didn't answer: the same order, by WhatsApp (nothing is lost, and nothing pretends it was saved)
  const sendByWhatsApp = () => {
    const o = { ...form, phone: phoneOk ? phoneOk.pretty : form.phone, orderNumber: null, items: cart, subtotal: total, delivery, total: grandTotal, count: cart.reduce((sum, i) => sum + i.qty, 0) };
    if (remember) saveCheckoutInfo({ name: form.name.trim(), phone: o.phone, area: form.area, address: form.address.trim() });
    o.waUrl = waLink(o);
    o.viaWhatsApp = true;
    o.waOpened = true;
    setTimeout(() => onSubmitted(o), 300);
    return o.waUrl;
  };

  if (cart.length === 0) {
    return (
      <div className="max-w-lg mx-auto px-4 sm:px-6 py-20 text-center">
        <ShoppingBag className="w-10 h-10 text-muted mx-auto mb-4" style={{ opacity: 0.3 }} />
        <p className="font-body text-muted mb-2">Your cart is empty</p>
        <p className="font-body text-muted text-sm mb-6">Add a few things before checking out.</p>
        {goCatalog && <button onClick={() => goCatalog("all")} className="glass-btn rounded-full font-body font-medium px-6 py-3 tap-scale" style={{ background: "var(--coral)", color: "#fff" }}>Shop the collection</button>}
      </div>
    );
  }

  const fieldCls = (k) => `field${bad === k ? " field-bad" : ""}`;
  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 py-10 grid md:grid-cols-5 gap-10">
      <form onSubmit={handleSubmit} noValidate className="md:col-span-3 space-y-5">
        <h1 className="font-display font-bold text-2xl mb-2">Delivery details</h1>
        {saved && (
          <p className="font-body text-xs -mt-2 mb-1" style={{ color: "var(--teal-text)" }}>
            Filled in from your last order — check it's still right.
          </p>
        )}

        <Field label="Full name" required id="co-name">
          <input id="co-name" ref={refs.name} value={form.name} onChange={set("name")} className={fieldCls("name")} placeholder="Your name" autoComplete="name" enterKeyHint="next" aria-invalid={bad === "name"} />
        </Field>
        <Field label="Phone number" required id="co-phone" hint={form.phone && phoneOk ? `We'll call ${phoneOk.pretty}` : "The driver calls before coming"}>
          <input id="co-phone" ref={refs.phone} value={form.phone} onChange={set("phone")} onBlur={() => { if (phoneOk) setForm((f) => ({ ...f, phone: phoneOk.lebanon ? phoneOk.national : phoneOk.pretty })); }} className={fieldCls("phone")} placeholder="03 123 456" type="tel" inputMode="tel" autoComplete="tel" enterKeyHint="next" aria-invalid={bad === "phone"} />
        </Field>
        <Field label="Governorate" required id="co-area">
          <select id="co-area" ref={refs.area} value={form.area} onChange={set("area")} className={fieldCls("area")} autoComplete="address-level1" aria-invalid={bad === "area"}>
            <option value="" disabled>Choose…</option>
            {LEBANON_GOVERNORATES.map((a) => (
              <option key={a} value={a}>{a}</option>
            ))}
          </select>
        </Field>
        <Field label="Address" required id="co-address">
          <input id="co-address" ref={refs.address} value={form.address} onChange={set("address")} className={fieldCls("address")} placeholder="Town, street, building, a landmark" autoComplete="street-address" enterKeyHint="done" aria-invalid={bad === "address"} />
        </Field>
        <Field label="Notes (optional)" id="co-notes">
          <textarea id="co-notes" value={form.notes} onChange={set("notes")} rows={3} className="field resize-none" placeholder="A time that suits you, a size question…" />
        </Field>
        <label className="flex items-center gap-2.5 font-body text-sm text-muted cursor-pointer select-none">
          <input type="checkbox" checked={remember} onChange={(e) => setRemember(e.target.checked)} className="w-4 h-4 accent-[var(--coral)]" />
          Remember my details on this device
        </label>

        {/* the total right above the button, on a phone too: no surprise at the door */}
        <div className="md:hidden glass rounded-2xl px-4 py-3 flex items-center justify-between font-body text-sm">
          <span className="text-muted">{(() => { const n = cart.reduce((a, i) => a + i.qty, 0); return `${n} ${n === 1 ? "piece" : "pieces"}`; })()} · {delivery ? `${money(delivery)} delivery` : "free delivery"}</span>
          <span className="font-num text-lg">{money(grandTotal)}</span>
        </div>

        {error && <p role="alert" className="font-body text-sm" style={{ color: "var(--coral-text)" }}>{error}</p>}

        {offline ? (
          <div role="alert" className="glass rounded-2xl p-4 space-y-3">
            <p className="font-body text-sm"><b>We couldn't reach the shop just now.</b> Your order isn't lost — send it to us on WhatsApp and we'll confirm it there.</p>
            <a href={waLink({ ...form, phone: phoneOk ? phoneOk.pretty : form.phone, orderNumber: null, items: cart, subtotal: total, delivery, total: grandTotal })} target="_blank" rel="noopener noreferrer" onClick={(e) => { e.currentTarget.href = sendByWhatsApp(); }} className="glass-btn w-full font-body font-semibold py-3.5 rounded-full tap-scale flex items-center justify-center gap-2" style={{ background: "var(--teal)", color: "#062420" }}>
              <MessageCircle className="w-5 h-5" /> Send the order on WhatsApp
            </a>
            <button type="submit" className="w-full font-body text-sm text-muted underline">Try again</button>
          </div>
        ) : (
          <>
            <Magnetic strength={8} className="block w-full">
              <button type="submit" disabled={sending} className="glass-btn w-full font-body font-semibold py-3.5 rounded-full tap-scale flex items-center justify-center gap-2" style={{ background: "var(--coral)", color: "#fff", opacity: sending ? 0.7 : 1 }}>
                {sending ? "Placing your order…" : <>Place order · {money(grandTotal)}</>}
              </button>
            </Magnetic>
            <p className="font-body text-xs text-muted text-center">Pay cash at your door. WhatsApp opens with your order so you can message us about it.</p>
          </>
        )}

        <style>{`
          .field { width: 100%; border: 1px solid var(--border); background: var(--field-bg); color: var(--fg); border-radius: 14px; padding: 0.7rem 1rem; font-family: 'Inter', sans-serif; font-size: 16px; }
          .field:focus { outline: none; border-color: var(--coral); box-shadow: 0 0 0 3px rgba(255,69,34,0.15); }
          .field-bad { border-color: var(--coral); box-shadow: 0 0 0 3px rgba(255,69,34,0.12); }
        `}</style>
      </form>

      <div className="md:col-span-2">
        <div className="glass rounded-3xl p-5 sticky top-24">
          <h2 className="font-display font-bold text-lg mb-4">Order summary</h2>
          <div className="space-y-3 mb-4">
            {cart.map((i) => (
              <div key={i.key} className="flex justify-between gap-3 font-body text-sm">
                <span className="text-muted">{i.name} <span className="whitespace-nowrap">· {i.size} × {i.qty}</span></span>
                <span className="font-num">{money(i.price * i.qty)}</span>
              </div>
            ))}
          </div>
          <FreeDeliveryMeter subtotal={total} money={money} />
          <div className="border-t pt-3 space-y-1.5" style={{ borderColor: "var(--border)" }}>
            <div className="flex justify-between font-body text-sm text-muted">
              <span>Subtotal</span>
              <span className="font-num">{money(total)}</span>
            </div>
            <div className="flex justify-between font-body text-sm text-muted">
              <span>Delivery</span>
              <span className="font-num">{delivery ? money(delivery) : "Free"}</span>
            </div>
            <div className="flex justify-between items-center pt-1.5">
              <span className="font-body text-sm font-medium">Total · cash on delivery</span>
              <span className="font-num text-xl">{money(grandTotal)}</span>
            </div>
          </div>
          {site.exchangeDays > 0 && <p className="font-body text-xs text-muted mt-3 flex items-center gap-1.5"><RotateCcw className="w-3.5 h-3.5" /> Exchange within {site.exchangeDays} days</p>}
        </div>
      </div>
    </div>
  );
}

function Field({ label, children, required, id, hint }) {
  return (
    <div>
      <label htmlFor={id} className="font-body text-sm block mb-1.5">
        {label} {required && <span className="text-required" aria-hidden="true">*</span>}
      </label>
      {children}
      {hint && <p className="font-body text-xs text-muted mt-1.5">{hint}</p>}
    </div>
  );
}

/* ============================================================
   CONFIRMATION
   ============================================================ */
function ConfirmationView({ order, goHome }) {
  useEffect(() => { document.title = `Thank you — ${STORE_NAME}`; }, []);
  return (
    <div className="max-w-lg mx-auto px-4 sm:px-6 py-20 text-center">
      <div className="glass w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-6">
        <Check className="w-8 h-8 text-teal" />
      </div>
      <h1 className="font-display font-bold text-2xl mb-2">{order && order.viaWhatsApp ? "Over to WhatsApp" : "Thank you — your order is in"}</h1>
      {order && (
        <>
          <p className="font-body text-muted mb-5">
            {order.viaWhatsApp
              ? "Send the message in WhatsApp and we'll confirm your order there."
              : <>We'll call {order.phone} to confirm, then deliver to {order.area || "you"}. Pay <b className="font-num" style={{ color: "var(--fg)" }}>{money(order.total)}</b> in cash at your door.</>}
          </p>
          {order.orderNumber && (
            <div className="glass inline-flex flex-col items-center rounded-2xl px-6 py-4 mb-5">
              <span className="font-body text-xs text-muted">Your order number</span>
              <span className="font-num text-2xl mt-1" style={{ color: "var(--coral-text)" }}>#{order.orderNumber}</span>
            </div>
          )}
          {order.waUrl && (
            <div className="mb-8">
              <a href={order.waUrl} target="_blank" rel="noopener noreferrer" className={`${order.waOpened ? "glass" : "glass-btn"} inline-flex items-center justify-center gap-2 rounded-full font-body font-semibold px-6 py-3 tap-scale`} style={order.waOpened ? undefined : { background: "var(--teal)", color: "#062420" }}>
                <MessageCircle className="w-5 h-5" /> {order.waOpened ? "WhatsApp didn't open? Send it here" : "Send it to us on WhatsApp"}
              </a>
            </div>
          )}
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
              className="native-badge absolute top-0.5 right-0.5 bg-coral text-white text-[9px] font-num rounded-full flex items-center justify-center"
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

  /* Two fixes here.

     One: the animation used to play only once per session. `animating`
     flipped to false when the first transition ended and nothing ever set
     it back, so every navigation after the first was an instant swap.
     Resetting it on each path change is what makes it actually work.

     Two: it was gated to the app only. The website navigated with a hard
     cut — the old page gone, the new one abruptly there. */
  useEffect(() => { setAnimating(true); }, [path]);

  if (reducedMotion) return <>{children}</>;

  // The app slides horizontally, the way a native screen stack does. The
  // website rises and fades, which suits a page load rather than a push.
  const animClass = isNativeApp
    ? (direction === "back" ? "page-slide-back" : "page-slide-forward")
    : "page-in";
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
                className="native-badge absolute -top-1.5 -right-2 text-white text-[9px] font-num rounded-full flex items-center justify-center"
                style={{ background: active ? "rgba(255,255,255,0.35)" : "var(--coral)" }}
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
/* The footer listed eleven categories in one tall column, which left most
   of its width empty and pushed contact details far down the page. It now
   works as three real blocks: who the shop is, everything it sells in two
   readable columns, and the ways to actually reach it — including where
   it physically is, which for a shop with a storefront in Saida is worth
   as much as the phone number. */
const MAPS_URL = "https://maps.app.goo.gl/APgMmZV7bCxhFXSz7";
const MAPS_EMBED =
  "https://www.google.com/maps/embed?pb=!1m18!1m12!1m3!1d6649.532326482181!2d35.37186094409013!3d33.559451343385746!2m3!1f0!2f0!3f0!3m2!1i1024!2i768!4f13.1!3m3!1m2!1s0x151ef1c9383886bb%3A0xefd93ea18e16a716!2sKanaan%20shop!5e0!3m2!1sen!2slb!4v1785150833911!5m2!1sen!2slb";

function Footer({ goCatalog, goSale }) {
  const half = Math.ceil(CATEGORIES.length / 2);
  const columns = [CATEGORIES.slice(0, half), CATEGORIES.slice(half)];

  return (
    <footer className="mt-10 px-4 sm:px-6 pb-6 section-lazy">
      <div className="glass max-w-6xl mx-auto rounded-3xl px-5 sm:px-8 py-10 sm:py-12">
        <div className="grid gap-10 lg:grid-cols-12">

          {/* Identity */}
          <div className="lg:col-span-4">
            <LogoMark variant="full" className="h-14 sm:h-16 w-auto mb-4" />
            <p className="font-body text-sm text-muted leading-6" style={{ maxWidth: 300 }}>
              Menswear in heavy fabrics with a youthful edge, from Saida to all of Lebanon.
            </p>
            <button
              onClick={goSale}
              className="mt-5 inline-flex items-center gap-2 rounded-full px-4 py-2 font-body text-sm font-medium tap-scale"
              style={{ background: "rgba(255,69,34,0.12)", border: "1px solid rgba(255,69,34,0.3)", color: "var(--coral)" }}
            >
              <Tag className="w-3.5 h-3.5" /> Shop the sale
            </button>
          </div>

          {/* Everything the shop sells, two columns so it reads at a glance */}
          <div className="lg:col-span-4">
            <p className="font-body text-sm font-medium mb-4">Shop</p>
            <div className="grid grid-cols-2 gap-x-4 gap-y-2.5">
              {columns.map((col, ci) => (
                <div key={ci} className="flex flex-col gap-2.5">
                  {col.map((c) => (
                    <button
                      key={c.id}
                      onClick={() => goCatalog(c.id)}
                      className="font-body text-sm text-muted hover:text-coral text-left transition-colors"
                    >
                      {c.label}
                    </button>
                  ))}
                </div>
              ))}
            </div>
          </div>

          {/* Reaching the shop */}
          <div className="lg:col-span-4">
            <p className="font-body text-sm font-medium mb-4">Get in touch</p>

            <div className="flex flex-col gap-2.5 mb-5">
              <a
                href={`https://wa.me/${WHATSAPP_NUMBER}`}
                target="_blank"
                rel="noopener noreferrer"
                className="glass rounded-2xl px-4 py-3 flex items-center gap-3 tap-scale group"
              >
                <span className="rounded-full p-2 flex-shrink-0" style={{ background: "rgba(18,179,160,0.14)" }}>
                  <MessageCircle className="w-4 h-4" style={{ color: "var(--teal)" }} />
                </span>
                <span className="min-w-0">
                  <span className="block font-body text-sm font-medium">WhatsApp</span>
                  <span className="block font-num text-xs text-muted" dir="ltr">+961 81 445 681</span>
                </span>
                <ArrowRight className="w-4 h-4 text-muted ml-auto flex-shrink-0 transition-transform duration-300 group-hover:translate-x-0.5" />
              </a>

              <a
                href={INSTAGRAM_URL}
                target="_blank"
                rel="noopener noreferrer"
                className="glass rounded-2xl px-4 py-3 flex items-center gap-3 tap-scale group"
              >
                <span className="rounded-full p-2 flex-shrink-0" style={{ background: "rgba(255,69,34,0.12)" }}>
                  <AtSign className="w-4 h-4" style={{ color: "var(--coral)" }} />
                </span>
                <span className="min-w-0">
                  <span className="block font-body text-sm font-medium">Instagram</span>
                  <span className="block font-body text-xs text-muted truncate">{INSTAGRAM_HANDLE}</span>
                </span>
                <ArrowRight className="w-4 h-4 text-muted ml-auto flex-shrink-0 transition-transform duration-300 group-hover:translate-x-0.5" />
              </a>
            </div>

            {/* The real storefront, on a real map. Loading is deferred so it
                never competes with the shop itself for bandwidth. */}
            <a
              href={MAPS_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="block rounded-2xl overflow-hidden tap-scale"
              style={{ border: "1px solid var(--glass-border)" }}
            >
              <div className="relative" style={{ height: 128 }}>
                <iframe
                  src={MAPS_EMBED}
                  title="Kanaan Shop on Google Maps"
                  loading="lazy"
                  referrerPolicy="strict-origin-when-cross-origin"
                  style={{ border: 0, width: "100%", height: "100%", filter: "grayscale(0.25)" }}
                />
                {/* Keeps the whole tile behaving as one link instead of the
                    map swallowing the tap and panning. */}
                <span className="absolute inset-0" aria-hidden="true" />
              </div>
              <div className="px-4 py-3 flex items-center gap-3" style={{ background: "var(--glass-bg)" }}>
                <MapPin className="w-4 h-4 flex-shrink-0" style={{ color: "var(--coral)" }} />
                <span className="min-w-0">
                  <span className="block font-body text-sm font-medium">Kanaan Shop</span>
                  <span className="block font-body text-xs text-muted">H93H+RPQ, Sidon · Get directions</span>
                </span>
              </div>
            </a>
          </div>
        </div>

        <div className="border-t mt-10 pt-5 flex flex-col sm:flex-row items-center justify-between gap-2" style={{ borderColor: "var(--border)" }}>
          <p className="font-body text-xs text-muted">Designed with care for {STORE_NAME}, 2026.</p>
          <a href="/privacy" className="font-body text-xs text-muted hover:text-coral transition-colors underline">Privacy Policy</a>
        </div>
      </div>
    </footer>
  );
}

/* Shared with the homepage (src/home/HomeLab.jsx), so it reuses the shop's
   own product card and data helpers instead of copies. */
export {
  useApp,
  ProductCard,
  ScrollProgress,
  AppTeaser,
  CATEGORIES,
  getImages,
  thumbUrlFor,
  isOnSale,
  money,
  effectivePrice,
  STORE_NAME,
  WHATSAPP_NUMBER,
  MAPS_URL,
};
