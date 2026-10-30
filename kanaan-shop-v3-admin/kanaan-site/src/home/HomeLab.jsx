/* ============================================================
   THE HOMEPAGE — the Kanaan shop in Saida, in 3D
   ------------------------------------------------------------
   The website's homepage ("/", chosen by the owner on 29 Oct 2026: walk;
   on 30 Oct the realistic drawing walked by section went live).
   /lab still shows all three directions with a switch, for comparing
   (not indexed, not linked).

     walk      Scroll walks you into the shop: storefront, through the
               door, then section by section — knitwear, hoodies, jackets &
               coats, pants & jeans, shoes — to the counter. A bar of the
               sections lets anyone jump straight to one. The pieces hang
               on paper tags in the shop itself. The 3D store is the spine
               of the page.
     facade    Just the storefront in 3D at the top, then a calm page.
     lite      No 3D engine at all: a still of the storefront, the same
               calm page. This is also what any weak or reduced-motion
               device gets automatically in the other two.

   Everything a shopper needs — products, prices, categories, the cart —
   is plain HTML on top of the 3D, never inside it, so the shop still
   works (and is still readable by Google) whatever the 3D does.
   ============================================================ */
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ArrowDown, MapPin, MessageCircle, RotateCcw, ShieldCheck, Truck } from "lucide-react";
import {
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
} from "../App.jsx";
import { detectTier } from "../store3d/tier.js";
import { useSiteSettings } from "../lib/siteSettings.js";
import { OpenNow } from "../components/SiteBits.jsx";

const StoreStage = React.lazy(() => import("../store3d/StoreStage.jsx"));

const clamp = (v, a, b) => Math.min(b, Math.max(a, v));

const FADE = 0.035;

/* The walk goes by the shop's own sections, in the order you meet them in
   the real shop. Each has a name the site can adopt as a category, the
   words for its stop, where along the walk it is (at: where the section bar
   jumps to) and which side its words sit — always the side the camera
   ISN'T looking at, so the words never cover the stock.
   A section collects the site's categories whose id or name matches it
   (the owner adds categories in Kanaan POS); pieces in no matching
   category are placed by their name. A section with nothing online yet
   still shows — it's on the rails in Saida — with a WhatsApp question. */
const SECTIONS = [
  { id: "knit", label: "Knitwear", title: "Knitwear", ask: "knitwear", at: 0.315, side: "end", re: /knit|sweater|pullover|jumper|cardigan|turtle ?neck|كنز/i },
  { id: "hoodies", label: "Hoodies", title: "Hoodies", ask: "hoodies", at: 0.45, side: "start", re: /hood|sweatshirt|هود/i },
  { id: "jackets", label: "Jackets", title: "Jackets & coats", ask: "jackets and coats", at: 0.58, side: "start", re: /jacket|coat|puffer|parka|bomber|blazer|gilet|overshirt|جاك/i },
  { id: "pants", label: "Pants", title: "Pants & jeans", ask: "pants and jeans", at: 0.71, side: "end", re: /jean|pant|trouser|chino|cargo|jogger|denim|بنطل|بناطل/i },
  { id: "shoes", label: "Shoes", title: "Shoes", ask: "shoes", at: 0.84, side: "end", re: /shoe|sneaker|\bboots?\b|loafer|slipper|sandal|صباب|حذ/i },
];
// which section claims a category or a name first: the most specific
// words first ("denim jacket" is a jacket, not pants)
const CLAIM_ORDER = ["jackets", "hoodies", "knit", "shoes", "pants"];
// Where along the walk each block of words shows (0 = on the pavement, 1 =
// at the counter). Each window sits around its camera stop (KanaanStore's
// walk keys), with a gap of at least two fades between neighbours, so on a
// phone — where every block sits at the bottom — two never show at once.
const SECTION_STATIONS = [
  { id: "hero", from: 0, to: 0.06 },
  { id: "knit", from: 0.27, to: 0.35 },
  { id: "hoodies", from: 0.42, to: 0.48 },
  { id: "jackets", from: 0.55, to: 0.61 },
  { id: "pants", from: 0.68, to: 0.74 },
  { id: "shoes", from: 0.81, to: 0.87 },
  { id: "desk", from: 0.94, to: 1.2 },
];

function claim(text) {
  for (const id of CLAIM_ORDER) {
    const sec = SECTIONS.find((x) => x.id === id);
    if (sec.re.test(text)) return id;
  }
  return null;
}

/* products → { [section id]: { cats: [category], items: [product] } } */
function sortIntoSections(products, counts) {
  const out = Object.fromEntries(SECTIONS.map((x) => [x.id, { cats: [], items: [] }]));
  const catSection = {};
  for (const c of CATEGORIES) {
    const id = claim(`${c.id} ${c.label}`);
    if (id) {
      catSection[c.id] = id;
      if (counts[c.id]) out[id].cats.push(c);
    }
  }
  for (const p of products) {
    const id = catSection[p.category] || claim(p.name || "");
    if (id) out[id].items.push(p);
  }
  return out;
}

function stationLevel(st, p) {
  if (st.from === 0) return p <= st.to ? 1 : clamp(1 - (p - st.to) / FADE, 0, 1);
  if (p < st.from) return clamp(1 - (st.from - p) / FADE, 0, 1);
  if (p > st.to) return clamp(1 - (p - st.to) / FADE, 0, 1);
  return 1;
}

/* Two from every category, newest first — the same rule as the current
   homepage, so the shop always looks like a shop and not a wall of one
   thing that happened to arrive in bulk. */
function pickFeatured(products, total = 12) {
  const picked = [];
  const used = new Set();
  for (const c of CATEGORIES) {
    for (const p of products.filter((x) => x.category === c.id).slice(0, 2)) {
      picked.push(p);
      used.add(p.id);
    }
  }
  for (let round = 2; picked.length < total && round < 12; round++) {
    let added = false;
    for (const c of CATEGORIES) {
      if (picked.length >= total) break;
      const next = products.filter((x) => x.category === c.id)[round];
      if (next && !used.has(next.id)) {
        picked.push(next);
        used.add(next.id);
        added = true;
      }
    }
    if (!added) break;
  }
  picked.sort((a, b) => products.indexOf(a) - products.indexOf(b));
  return picked.slice(0, total);
}

const firstImage = (p) => {
  const url = getImages(p)[0];
  return url ? thumbUrlFor(url) || url : "";
};

/* The still of the storefront: the page's first image while the 3D engine
   loads, and the whole hero on devices that don't get 3D. Rendered from
   the same scene, so the hand-over is seamless. */
function posterFor(theme, tall) {
  return `/home/store-${theme === "dark" ? "night" : "day"}-${tall ? "tall" : "wide"}.webp`;
}

function useIsTall() {
  const get = () => (typeof window === "undefined" ? false : window.innerWidth / Math.max(1, window.innerHeight) < 1.05);
  const [tall, setTall] = useState(get);
  useEffect(() => {
    const on = () => setTall(get());
    window.addEventListener("resize", on, { passive: true });
    return () => window.removeEventListener("resize", on);
  }, []);
  return tall;
}

export default function HomeLab({ home = false, products, loading, goCatalog, goSale, openProduct, likes, toggleLike, appExclusiveCount = 0 }) {
  const { theme } = useApp();
  const tall = useIsTall();
  // ?tier=high|mid|static lets the owner (and our tests) see a given
  // version on any device; normally the device decides
  const [tier] = useState(() => {
    try {
      const t = new URLSearchParams(window.location.search).get("tier");
      if (t === "high" || t === "mid" || t === "static") return t;
    } catch { /* fall through */ }
    return detectTier();
  });
  const forced = useMemo(() => {
    try { return new URLSearchParams(window.location.search).get("v"); } catch { return null; }
  }, []);
  // the homepage is always the walk; only /lab can switch
  const [variant, setVariant] = useState(() => (!home && (forced === "facade" || forced === "lite") ? forced : "walk"));
  const canDo3D = tier === "high" || tier === "mid";
  const mode = canDo3D ? variant : "lite";

  useEffect(() => {
    document.title = `${STORE_NAME} — Menswear from Saida, Lebanon`;
    if (home) return;
    // keep the chosen variant in the address bar, so a refresh or a shared
    // link opens the same one
    try {
      const u = new URL(window.location.href);
      u.searchParams.set("v", variant);
      window.history.replaceState(window.history.state, "", u.pathname + u.search);
    } catch { /* fine */ }
  }, [variant, home]);

  const featured = useMemo(() => pickFeatured(products), [products]);
  const onSale = useMemo(() => products.filter(isOnSale), [products]);
  const saleCount = onSale.length;
  const maxDiscount = saleCount ? Math.max(...onSale.map((p) => p.discount)) : 0;

  const counts = useMemo(() => {
    const m = {};
    for (const p of products) m[p.category] = (m[p.category] || 0) + 1;
    return m;
  }, [products]);
  const sections = useMemo(() => sortIntoSections(products, counts), [products, counts]);

  return (
    // lab-is-*, not lab-walk etc.: those name the tall scroll sections, and
    // on this wrapper they made it exactly as tall as the walk, so the page
    // footer was laid over the products below it
    <div className={`lab lab-is-${mode}`}>
      <LabStyles />
      {home && <ScrollProgress />}
      {mode === "walk" && (
        <SectionWalk
          theme={theme}
          tall={tall}
          tier={tier}
          sections={sections}
          counts={counts}
          saleCount={saleCount}
          maxDiscount={maxDiscount}
          goCatalog={goCatalog}
          goSale={goSale}
          openProduct={openProduct}
        />
      )}
      {mode === "facade" && <FacadeHero theme={theme} tall={tall} tier={tier} goCatalog={goCatalog} openProduct={openProduct} />}
      {mode === "lite" && <LiteHero theme={theme} tall={tall} goCatalog={goCatalog} />}

      <div id="lab-shop" className="lab-page">
        <NewIn featured={featured} loading={loading} goCatalog={goCatalog} openProduct={openProduct} likes={likes} toggleLike={toggleLike} />
        <Shelves products={products} counts={counts} goCatalog={goCatalog} />
        {saleCount > 0 && <SaleBand count={saleCount} maxDiscount={maxDiscount} goSale={goSale} />}
        <VisitStore />
        <Promises />
        <AppTeaser appExclusiveCount={appExclusiveCount} />
      </div>

      {!home && <LabSwitcher variant={variant} setVariant={setVariant} canDo3D={canDo3D} />}
    </div>
  );
}

/* ------------------------------------------------------------------
   The 3D stage plus the still behind it. The still is shown first; when the
   live scene has drawn its first frame it fades in on top.
   ------------------------------------------------------------------ */
function Stage({ mode, theme, tall, tier, tags, safe, onStore, openProduct }) {
  const [ready, setReady] = useState(false);
  const onSelect = useCallback((piece) => piece && piece.product && openProduct(piece.product), [openProduct]);
  return (
    <div className="lab-stage" aria-hidden="true">
      <img className="lab-poster" src={posterFor(theme, tall)} alt="" decoding="async" fetchPriority="high" />
      <React.Suspense fallback={null}>
        <StoreStage
          mode={mode}
          theme={theme}
          tier={tier}
          tags={tags}
          safeLeft={safe ? safe.left : 0}
          safeBottom={safe ? safe.bottom : 0}
          onSelect={onSelect}
          onStore={onStore}
          onReady={() => setReady(true)}
          className={`lab-canvas${ready ? " is-ready" : ""}`}
        />
      </React.Suspense>
    </div>
  );
}

/* Where the opening words sit, as shares of the screen, so the 3D camera
   can keep the sign clear of them: on a wide screen where the headline ends
   (left), on a phone where the words begin (bottom). Measured on the words
   themselves (a heading's box spans the whole card), and again once the
   web fonts have loaded, since they change how wide the headline is. */
function useSafeArea(cardRef) {
  const [safe, setSafe] = useState({ left: 0, bottom: 0 });
  useEffect(() => {
    let raf = 0;
    let alive = true;
    const measure = () => {
      raf = 0;
      const card = cardRef.current;
      const stage = card && card.closest(".lab-sticky");
      if (!card || !stage) return;
      const vw = document.documentElement.clientWidth || window.innerWidth;
      let left = 0, bottom = 0;
      if (vw >= 1024) {
        let right = 0;
        const range = document.createRange();
        for (const el of card.querySelectorAll(".lab-display, .lab-lede")) {
          range.selectNodeContents(el);
          for (const r of range.getClientRects()) right = Math.max(right, r.right);
        }
        for (const el of card.querySelectorAll(".lab-actions > *")) right = Math.max(right, el.getBoundingClientRect().right);
        left = Math.round((right / vw) * 100) / 100;
      } else {
        const first = card.firstElementChild;
        const st = stage.getBoundingClientRect();
        if (first && st.height > 0) bottom = Math.round(((first.getBoundingClientRect().top - st.top) / st.height) * 100) / 100;
      }
      setSafe((s) => (s.left === left && s.bottom === bottom ? s : { left, bottom }));
    };
    const on = () => { if (alive && !raf) raf = requestAnimationFrame(measure); };
    // a phone fires resize every time its browser bars slide in or out;
    // only a real change of width (rotating, resizing a window) re-measures
    let lastW = window.innerWidth;
    const onResize = () => {
      if (window.innerWidth === lastW) return;
      lastW = window.innerWidth;
      on();
    };
    measure();
    if (document.fonts && document.fonts.ready) document.fonts.ready.then(on).catch(() => {});
    window.addEventListener("resize", onResize, { passive: true });
    return () => {
      alive = false;
      window.removeEventListener("resize", onResize);
      cancelAnimationFrame(raf);
    };
  }, [cardRef]);
  return safe;
}

/* Scroll position inside a tall section, 0..1, handed to the 3D store and to
   the text blocks without re-rendering React on every frame. */
function useSectionProgress(ref, onProgress) {
  useEffect(() => {
    let raf = 0;
    const update = () => {
      raf = 0;
      const el = ref.current;
      if (!el) return;
      const r = el.getBoundingClientRect();
      // the stretch the stage stays pinned for (its own height, not the
      // window's, which changes as a phone's browser bars come and go)
      const stage = el.querySelector(".lab-sticky");
      const total = r.height - (stage ? stage.offsetHeight : window.innerHeight);
      const p = total > 0 ? clamp(-r.top / total, 0, 1) : 0;
      onProgress(p);
    };
    const on = () => { if (!raf) raf = requestAnimationFrame(update); };
    window.addEventListener("scroll", on, { passive: true });
    window.addEventListener("resize", on, { passive: true });
    update();
    return () => {
      window.removeEventListener("scroll", on);
      window.removeEventListener("resize", on);
      cancelAnimationFrame(raf);
    };
  }, [ref, onProgress]);
}

/* The walk, section by section. The scroll drives the camera, one stop's
   words at a time, and a bar of the shop's sections sits at the top: tap
   one and the walk carries you there, so nobody has to scroll through the
   whole shop to reach the shoes. */
function SectionWalk({ theme, tall, tier, sections, counts, saleCount, maxDiscount, goCatalog, goSale, openProduct }) {
  const site = useSiteSettings();
  const sectionRef = useRef(null);
  const storeRef = useRef(null);
  const stationRefs = useRef({});
  const barRef = useRef(null);
  const heroCardRef = useRef(null);
  const safe = useSafeArea(heroCardRef);
  const lastP = useRef(0);
  const activeRef = useRef(null);

  const apply = useCallback((p) => {
    lastP.current = p;
    if (storeRef.current) storeRef.current.setProgress(p);
    let active = null;
    for (const st of SECTION_STATIONS) {
      const el = stationRefs.current[st.id];
      if (!el) continue;
      const v = stationLevel(st, p);
      el.style.opacity = String(v);
      el.style.transform = `translate3d(0, ${(1 - v) * 18}px, 0)`;
      el.style.visibility = v < 0.05 ? "hidden" : "visible";
      el.toggleAttribute("inert", v < 0.6);
    }
    // the section you're in (or walking towards) lights up in the bar
    for (const st of SECTION_STATIONS) {
      if (SECTIONS.some((x) => x.id === st.id) && p >= st.from - 0.06 && p <= st.to + 0.03) active = st.id;
    }
    const bar = barRef.current;
    if (bar && active !== activeRef.current) {
      activeRef.current = active;
      for (const b of bar.querySelectorAll("button")) {
        const on = b.dataset.id === active;
        b.classList.toggle("is-on", on);
        if (on) b.setAttribute("aria-current", "location");
        else b.removeAttribute("aria-current");
        // keep the lit name in view on a narrow phone
        if (on && bar.scrollWidth > bar.clientWidth) {
          bar.scrollTo({ left: b.offsetLeft - (bar.clientWidth - b.offsetWidth) / 2, behavior: "smooth" });
        }
      }
    }
  }, []);
  useSectionProgress(sectionRef, apply);

  const onStore = useCallback((s) => {
    storeRef.current = s;
    if (s) s.setProgress(lastP.current);
  }, []);

  const jumpTo = (p) => {
    const el = sectionRef.current;
    if (!el) return;
    const top = el.getBoundingClientRect().top + window.scrollY;
    const stage = el.querySelector(".lab-sticky");
    const total = el.offsetHeight - (stage ? stage.offsetHeight : window.innerHeight);
    window.scrollTo({ top: top + total * p, behavior: "smooth" });
  };

  const picks = (list) => (
    <ul className="lab-picks">
      {list.map((p) => (
        <li key={p.id}>
          <button onClick={() => openProduct(p)} className="lab-pick tap-scale" aria-label={p.name}>
            {firstImage(p) ? <img src={firstImage(p)} alt="" loading="lazy" decoding="async" /> : <span className="lab-pick-ph" />}
            <span className="lab-pick-name">{p.name}</span>
            <span className="lab-pick-price font-num">{money(effectivePrice(p))}</span>
          </button>
        </li>
      ))}
    </ul>
  );
  const chips = (cats) => (
    <div className="lab-chips">
      {cats.map((c) => (
        <button key={c.id} onClick={() => goCatalog(c.id)} className="glass rounded-full font-body text-sm px-4 py-2 tap-scale">
          {c.label} <span className="text-muted font-num">{counts[c.id]}</span>
        </button>
      ))}
    </div>
  );
  const ask = (sec) => `https://wa.me/${WHATSAPP_NUMBER}?text=${encodeURIComponent(`Hi Kanaan! What ${sec.ask} do you have in my size?`)}`;
  // each section's pieces, for the 3D: they hang on paper swing tags in
  // that part of the shop (store3d/hangtags.js)
  const tags = useMemo(() => SECTIONS.map((sec) => {
    const st = SECTION_STATIONS.find((x) => x.id === sec.id);
    const items = sections[sec.id].items.filter((p) => firstImage(p)).slice(0, 4).map((p) => ({
      id: p.id,
      name: p.name,
      image: firstImage(p),
      product: p,
      price: money(effectivePrice(p)),
      was: isOnSale(p) ? money(p.price) : null,
    }));
    return { id: sec.id, from: st.from, to: st.to, side: sec.side, items };
  }), [sections]);
  const reg = (id) => (el) => { stationRefs.current[id] = el; };

  return (
    <section ref={sectionRef} className="lab-walk" aria-label="Kanaan Shop">
      <div className="lab-sticky">
        <Stage mode="walk" theme={theme} tall={tall} tier={tier} tags={tags} safe={safe} onStore={onStore} openProduct={openProduct} />

        <nav ref={barRef} className="lab-aisles glass" aria-label="Sections of the shop">
          {SECTIONS.map((sec) => (
            <button key={sec.id} data-id={sec.id} onClick={() => jumpTo(sec.at)}>{sec.label}</button>
          ))}
        </nav>

        <div ref={reg("hero")} className="lab-station lab-side-start lab-hero-station">
          <div className="lab-scrim" />
          <div ref={heroCardRef} className="lab-card">
            <h1 className="lab-display">Everyday wear, refined.</h1>
            <p className="lab-lede lab-sub">Our shop in Saida, in 3D. Scroll to walk in, or pick a section.</p>
            <div className="lab-actions">
              <button onClick={() => goCatalog("all")} className="glass glass-btn rounded-full font-body font-medium px-6 py-3 tap-scale lab-primary">Shop the collection</button>
              <button onClick={() => jumpTo(SECTIONS[0].at)} className="glass rounded-full font-body px-5 py-3 tap-scale inline-flex items-center gap-2">
                <ArrowDown className="w-4 h-4" /> Walk in
              </button>
            </div>
            <a href="#lab-shop" className="lab-skip">Skip to new arrivals</a>
          </div>
        </div>

        {SECTIONS.map((sec) => {
          const { cats, items } = sections[sec.id];
          const shown = items.filter((p) => firstImage(p)).slice(0, 4);
          return (
            <div key={sec.id} ref={reg(sec.id)} className={`lab-station lab-side-${sec.side}`} data-section={sec.id}>
              <div className="lab-scrim" />
              <div className="lab-card">
                <h2 className="lab-title">{sec.title}</h2>
                {shown.length > 0 && <p className="lab-lede lab-hint">Tap a tag to see the piece.</p>}
                {/* the pieces hang on tags in the 3D; this list is for
                    keyboards and screen readers, and shows itself when a
                    keyboard reaches it */}
                {shown.length > 0 && <div className="lab-sr">{picks(shown)}</div>}
                {cats.length > 0 && chips(cats)}
                {items.length === 0 && (
                  <>
                    <p className="lab-lede">On the rails in Saida now. Ask us what's in your size.</p>
                    <div className="lab-actions">
                      <a href={ask(sec)} target="_blank" rel="noopener noreferrer" className="glass rounded-full font-body px-5 py-3 tap-scale inline-flex items-center gap-2">
                        <MessageCircle className="w-4 h-4" /> Ask on WhatsApp
                      </a>
                    </div>
                  </>
                )}
              </div>
            </div>
          );
        })}

        <div ref={reg("desk")} className="lab-station lab-side-end">
          <div className="lab-scrim" />
          <div className="lab-card">
            <h2 className="lab-title">Order here, pay at your door</h2>
            <ul className="lab-promises">
              <li><Truck className="w-4 h-4" /> {site.freeOver ? `Free delivery from ${money(site.freeOver)}` : "All of Lebanon"}</li>
              <li><ShieldCheck className="w-4 h-4" /> Cash on delivery</li>
              {site.exchangeDays > 0 && <li><RotateCcw className="w-4 h-4" /> {site.exchangeDays}-day exchanges</li>}
            </ul>
            <OpenNow className="lab-open" />
            <div className="lab-actions">
              <button onClick={() => goCatalog("all")} className="glass glass-btn rounded-full font-body font-medium px-6 py-3 tap-scale lab-primary">Start shopping</button>
              <a href={`https://wa.me/${WHATSAPP_NUMBER}`} target="_blank" rel="noopener noreferrer" className="glass rounded-full font-body px-5 py-3 tap-scale inline-flex items-center gap-2">
                <MessageCircle className="w-4 h-4" /> WhatsApp
              </a>
            </div>
            {saleCount > 0 && <button onClick={goSale} className="lab-link">Up to {maxDiscount}% off in the sale</button>}
          </div>
        </div>
      </div>
    </section>
  );
}

function FacadeHero({ theme, tall, tier, goCatalog, openProduct }) {
  const sectionRef = useRef(null);
  const storeRef = useRef(null);
  const textRef = useRef(null);
  const cardRef = useRef(null);
  const safe = useSafeArea(cardRef);
  const apply = useCallback((p) => {
    if (storeRef.current) storeRef.current.setProgress(p);
    const el = textRef.current;
    if (!el) return;
    el.style.transform = `translate3d(0, ${p * -40}px, 0)`;
    // On a wide screen the camera pushes in until the shop fills the
    // picture, so the words step aside as it does. A phone keeps them: there
    // the shop stays in the top half.
    const v = window.innerWidth >= 1024 ? clamp(1 - (p - 0.3) / 0.45, 0, 1) : 1;
    el.style.opacity = String(v);
    el.style.visibility = v < 0.02 ? "hidden" : "visible";
    el.toggleAttribute("inert", v < 0.5);
  }, []);
  useSectionProgress(sectionRef, apply);
  const onStore = useCallback((s) => { storeRef.current = s; }, []);
  return (
    <section ref={sectionRef} className="lab-facade" aria-label="Kanaan Shop">
      <div className="lab-sticky">
        <Stage mode="facade" theme={theme} tall={tall} tier={tier} safe={safe} onStore={onStore} openProduct={openProduct} />
        <div ref={textRef} className="lab-station lab-side-start lab-hero-station" style={{ opacity: 1, visibility: "visible" }}>
          <div className="lab-scrim" />
          <div ref={cardRef} className="lab-card">
            <h1 className="lab-display">Everyday wear, refined.</h1>
            <p className="lab-lede lab-sub">From our shop in Saida to all of Lebanon.</p>
            <div className="lab-actions">
              <button onClick={() => goCatalog("all")} className="glass glass-btn rounded-full font-body font-medium px-6 py-3 tap-scale lab-primary">Shop the collection</button>
              <a href="#lab-shop" className="glass rounded-full font-body px-5 py-3 tap-scale inline-flex items-center gap-2"><ArrowDown className="w-4 h-4" /> New in</a>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

function LiteHero({ theme, tall, goCatalog }) {
  const imgRef = useRef(null);
  const { reducedMotion } = useApp();
  useEffect(() => {
    if (reducedMotion) return undefined;
    let raf = 0;
    const on = () => {
      if (raf) return;
      raf = requestAnimationFrame(() => {
        raf = 0;
        const y = Math.min(window.scrollY || 0, 900);
        if (imgRef.current) imgRef.current.style.transform = `translate3d(0, ${y * 0.25}px, 0) scale(${1 + y * 0.00018})`;
      });
    };
    window.addEventListener("scroll", on, { passive: true });
    return () => { window.removeEventListener("scroll", on); cancelAnimationFrame(raf); };
  }, [reducedMotion]);
  return (
    <section className="lab-lite" aria-label="Kanaan Shop">
      <div className="lab-lite-frame">
        <img ref={imgRef} className="lab-lite-img" src={posterFor(theme, tall)} alt="The Kanaan Shop storefront in Saida" fetchPriority="high" decoding="async" />
        <div className="lab-station lab-side-start lab-hero-station" style={{ opacity: 1, visibility: "visible" }}>
          <div className="lab-scrim" />
          <div className="lab-card">
            <h1 className="lab-display">Everyday wear, refined.</h1>
            <p className="lab-lede lab-sub">From our shop in Saida to all of Lebanon.</p>
            <div className="lab-actions">
              <button onClick={() => goCatalog("all")} className="glass glass-btn rounded-full font-body font-medium px-6 py-3 tap-scale lab-primary">Shop the collection</button>
              <a href="#lab-shop" className="glass rounded-full font-body px-5 py-3 tap-scale inline-flex items-center gap-2"><ArrowDown className="w-4 h-4" /> New in</a>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

/* ------------------------------------------------------------------
   The calm half of the page
   ------------------------------------------------------------------ */
function NewIn({ featured, loading, goCatalog, openProduct, likes, toggleLike }) {
  return (
    <section className="lab-section max-w-6xl mx-auto px-4 sm:px-6">
      <div className="lab-head">
        <h2 className="lab-h2">New in</h2>
        <button onClick={() => goCatalog("all")} className="lab-link">See all</button>
      </div>
      <div className="lab-grid">
        {loading && featured.length === 0
          ? Array.from({ length: 4 }).map((_, i) => <div key={i} className="rounded-2xl glass" style={{ aspectRatio: "4/5", opacity: 0.5 }} />)
          : featured.map((p, i) => (
              <div key={p.id} className={i === 0 ? "lab-grid-feature" : ""}>
                <ProductCard product={p} onOpen={openProduct} liked={likes.includes(p.id)} onToggleLike={toggleLike} />
              </div>
            ))}
      </div>
      {!loading && featured.length === 0 && <p className="font-body text-muted text-sm text-center py-8">New pieces are on their way — check back soon.</p>}
    </section>
  );
}

function Shelves({ products, counts, goCatalog }) {
  const cats = CATEGORIES.filter((c) => counts[c.id]);
  if (!cats.length) return null;
  return (
    <section className="lab-section">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lab-head">
        <h2 className="lab-h2">Shop by category</h2>
      </div>
      <div className="lab-shelf" role="list">
        {cats.map((c) => {
          const lead = products.find((p) => p.category === c.id && firstImage(p));
          return (
            <button key={c.id} role="listitem" onClick={() => goCatalog(c.id)} className="lab-shelf-item tap-scale">
              {lead ? <img src={firstImage(lead)} alt="" loading="lazy" decoding="async" /> : <span className="lab-shelf-ph" />}
              <span className="lab-shelf-label">
                <span className="font-display font-semibold">{c.label}</span>
                <span className="font-num text-xs">{counts[c.id]} {counts[c.id] === 1 ? "piece" : "pieces"}</span>
              </span>
            </button>
          );
        })}
      </div>
    </section>
  );
}

function SaleBand({ count, maxDiscount, goSale }) {
  return (
    <section className="lab-section px-4 sm:px-6">
      <div className="lab-sale max-w-6xl mx-auto">
        <span className="lab-neon" aria-hidden="true">sale</span>
        <div className="lab-sale-copy">
          <h2 className="lab-h2" style={{ color: "#f5f5f7" }}>Up to {maxDiscount}% off</h2>
          <p className="font-body" style={{ color: "rgba(245,245,247,0.7)" }}>{count} {count === 1 ? "piece" : "pieces"} marked down, while sizes last.</p>
          <button onClick={goSale} className="glass glass-btn rounded-full font-body font-medium px-6 py-3 tap-scale lab-primary mt-5">Shop the sale</button>
        </div>
      </div>
    </section>
  );
}

function VisitStore() {
  return (
    <section className="lab-section max-w-6xl mx-auto px-4 sm:px-6">
      <div className="lab-visit">
        <div className="lab-visit-copy">
          <h2 className="lab-h2">Come by the shop</h2>
          <p className="font-body text-muted mt-3" style={{ maxWidth: "42ch" }}>
            Everything here is also on the rails in Saida. Try it on, or order online and pay at your door.
          </p>
          <p className="font-body mt-5 inline-flex items-center gap-2"><MapPin className="w-4 h-4" style={{ color: "var(--coral)" }} /> Eastern Boulevard, Saida</p>
          <div className="mt-2"><OpenNow /></div>
          <div className="lab-actions mt-5">
            <a href={MAPS_URL} target="_blank" rel="noopener noreferrer" className="glass glass-btn rounded-full font-body font-medium px-6 py-3 tap-scale lab-primary">Get directions</a>
            <a href={`https://wa.me/${WHATSAPP_NUMBER}`} target="_blank" rel="noopener noreferrer" className="glass rounded-full font-body px-5 py-3 tap-scale inline-flex items-center gap-2"><MessageCircle className="w-4 h-4" /> WhatsApp</a>
          </div>
        </div>
        <div className="lab-prints" aria-hidden="true">
          <img src="/home/shop-front.webp" alt="" loading="lazy" decoding="async" className="lab-print lab-print-a" />
          <img src="/home/shop-inside.webp" alt="" loading="lazy" decoding="async" className="lab-print lab-print-b" />
        </div>
      </div>
    </section>
  );
}

function Promises() {
  const site = useSiteSettings();
  return (
    <section className="lab-section max-w-6xl mx-auto px-4 sm:px-6">
      <ul className="lab-promise-row">
        <li><Truck className="w-5 h-5" /> <span>{site.freeOver ? `Free delivery from ${money(site.freeOver)}, all of Lebanon` : `Delivery to all of Lebanon · ${money(site.deliveryFee)}`}</span></li>
        <li><ShieldCheck className="w-5 h-5" /> <span>Cash on delivery</span></li>
        <li><RotateCcw className="w-5 h-5" /> <span>{site.exchangeDays > 0 ? `Exchange within ${site.exchangeDays} days` : "Try it on at the shop in Saida"}</span></li>
      </ul>
    </section>
  );
}

/* The owner's switch between the three directions. Lab only. */
function LabSwitcher({ variant, setVariant, canDo3D }) {
  const opts = [
    ["walk", "Walk in"],
    ["facade", "Storefront"],
    ["lite", "Light"],
  ];
  return (
    <div className="lab-switch glass" role="group" aria-label="Homepage preview">
      {opts.map(([id, label]) => (
        <button
          key={id}
          onClick={() => { setVariant(id); window.scrollTo(0, 0); }}
          aria-pressed={variant === id}
          disabled={!canDo3D && id !== "lite"}
          className={variant === id ? "is-on" : ""}
        >
          {label}
        </button>
      ))}
    </div>
  );
}

/* Scoped styles for the lab. Plain CSS so it can't collide with the shop's
   own classes; everything is prefixed lab-. */
function LabStyles() {
  return <style>{LAB_CSS}</style>;
}

const LAB_CSS = String.raw`
.lab { --lab-scrim: 242,242,244; }
[data-theme="dark"] .lab { --lab-scrim: 11,11,14; }

.lab-walk { position: relative; height: 720vh; margin-top: calc(-1 * var(--header-h)); }
.lab-facade { position: relative; height: 150vh; margin-top: calc(-1 * var(--header-h)); }
@supports (height: 100svh) { .lab-walk { height: 720svh; } .lab-facade { height: 150svh; } }
/* The 3D fills the whole screen, also once a phone's browser bars slide
   away while scrolling (100lvh: the screen with the bars hidden, so the
   picture runs on underneath them while they show). The words above it
   follow the part that's actually visible (100dvh), so they always sit just
   above the bottom edge. */
.lab-sticky { position: sticky; top: 0; height: 100vh; overflow: hidden; }
@supports (height: 100lvh) { .lab-sticky { height: 100lvh; } }

.lab-stage { position: absolute; inset: 0; }
.lab-poster, .lab-canvas { position: absolute; inset: 0; width: 100%; height: 100%; display: block; }
.lab-poster { object-fit: cover; }
.lab-canvas { opacity: 0; transition: opacity 0.6s ease; touch-action: pan-y; }
.lab-canvas.is-ready { opacity: 1; }

.lab-station { position: absolute; top: 0; left: 0; right: 0; height: 100%; pointer-events: none; display: flex; align-items: flex-end; will-change: opacity, transform; }
@supports (height: 100dvh) { .lab-station { height: 100dvh; } }
.lab-station .lab-card { pointer-events: auto; position: relative; width: 100%; padding: 0 20px calc(28px + env(safe-area-inset-bottom)); }
/* on a phone the words sit at the bottom on a short, soft fade: the shop
   above stays in full view */
.lab-scrim { position: absolute; inset: 0; background: linear-gradient(to top, rgba(var(--lab-scrim), 0.95) 0%, rgba(var(--lab-scrim), 0.82) 20%, rgba(var(--lab-scrim), 0.38) 34%, rgba(var(--lab-scrim), 0) 46%); }
.lab-hero-station .lab-card { padding-bottom: calc(36px + env(safe-area-inset-bottom)); }
/* room for the preview switch and the WhatsApp button on phones */
@media (max-width: 1023px) { .lab-station .lab-card, .lab-hero-station .lab-card { padding-bottom: calc(86px + env(safe-area-inset-bottom)); } }

@media (min-width: 1024px) {
  .lab-station { align-items: center; }
  .lab-station .lab-card { width: min(470px, 42vw); padding: 0; }
  .lab-side-start { justify-content: flex-start; padding-left: max(32px, calc((100vw - 1152px) / 2 + 24px)); }
  .lab-side-end { justify-content: flex-end; padding-right: max(96px, calc((100vw - 1152px) / 2 + 72px)); }
  .lab-side-start .lab-scrim { background: linear-gradient(to right, rgba(var(--lab-scrim), 0.95) 0%, rgba(var(--lab-scrim), 0.88) 38%, rgba(var(--lab-scrim), 0.5) 52%, rgba(var(--lab-scrim), 0) 68%); }
  .lab-side-end .lab-scrim { background: linear-gradient(to left, rgba(var(--lab-scrim), 0.95) 0%, rgba(var(--lab-scrim), 0.88) 38%, rgba(var(--lab-scrim), 0.5) 52%, rgba(var(--lab-scrim), 0) 68%); }
  /* the opening shot keeps its scrim light: the storefront is the point */
  .lab-hero-station .lab-scrim { background: linear-gradient(to right, rgba(var(--lab-scrim), 0.85) 0%, rgba(var(--lab-scrim), 0.55) 30%, rgba(var(--lab-scrim), 0) 50%); }
  .lab-hero-station { align-items: flex-end; padding-bottom: 11vh; }
  .lab-hero-station .lab-lede { max-width: 38ch; }
}

.lab-display { font-family: "Space Grotesk", system-ui, sans-serif; font-weight: 700; font-size: clamp(2rem, 4.2vw, 3.6rem); line-height: 1.02; letter-spacing: -0.028em; color: var(--fg); }
.lab-title { font-family: "Space Grotesk", system-ui, sans-serif; font-weight: 700; font-size: clamp(1.5rem, 3vw, 2.5rem); line-height: 1.06; letter-spacing: -0.022em; color: var(--fg); }
.lab-sub { margin-top: 8px; font-size: 0.95rem; }
.lab-lede { font-family: Inter, system-ui, sans-serif; font-size: 1rem; line-height: 1.55; color: var(--fg-muted); margin-top: 12px; max-width: 44ch; }
.lab-actions { display: flex; flex-wrap: wrap; gap: 10px; margin-top: 18px; }
.lab-primary { background: var(--coral) !important; color: #fff !important; border-color: var(--coral) !important; }
/* for keyboards and screen readers: out of sight until it has focus */
.lab-skip { position: absolute; left: -9999px; font-family: Inter, system-ui, sans-serif; font-size: 0.85rem; color: var(--fg-muted); text-decoration: underline; text-underline-offset: 3px; }
.lab-skip:focus-visible { position: static; display: inline-block; margin-top: 12px; }
.lab-link { font-family: Inter, system-ui, sans-serif; font-size: 0.92rem; color: var(--coral); margin-top: 16px; text-underline-offset: 3px; }
.lab-link:hover { text-decoration: underline; }

.lab-picks { list-style: none; margin: 18px 0 0; padding: 0; display: grid; gap: 8px; }
.lab-pick { width: 100%; display: grid; grid-template-columns: 44px 1fr auto; align-items: center; gap: 12px; text-align: left; padding: 6px; border-radius: 16px; background: var(--glass-bg); border: 1px solid var(--glass-border); backdrop-filter: blur(14px); -webkit-backdrop-filter: blur(14px); }
.lab-pick img, .lab-pick-ph { width: 44px; height: 55px; border-radius: 10px; object-fit: cover; background: var(--field-bg); }
.lab-pick-name { font-family: Inter, system-ui, sans-serif; font-size: 0.92rem; color: var(--fg); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.lab-pick-price { font-size: 0.95rem; color: var(--fg); padding-right: 8px; }

.lab-chips { display: flex; flex-wrap: wrap; gap: 8px; margin-top: 16px; }
.lab-promises { list-style: none; padding: 0; margin: 12px 0 0; display: flex; flex-wrap: wrap; gap: 6px 16px; font-family: Inter, system-ui, sans-serif; font-size: 0.92rem; color: var(--fg); }
.lab-promises li { display: flex; align-items: center; gap: 6px; }
/* on a phone the picks are a row of photos — the names are on the
   product page a tap away */
@media (max-width: 1023px) {
  .lab-picks { display: flex; gap: 8px; margin-top: 14px; }
  .lab-pick { display: block; width: 62px; padding: 0; border: 0; border-radius: 14px; background: none; backdrop-filter: none; -webkit-backdrop-filter: none; }
  .lab-pick img, .lab-pick-ph { display: block; width: 62px; height: 78px; border-radius: 14px; }
  .lab-pick-name, .lab-pick-price { display: none; }
  .lab-chips { flex-wrap: nowrap; overflow-x: auto; scrollbar-width: none; margin: 14px -20px 0; padding: 2px 20px; }
  .lab-chips::-webkit-scrollbar { display: none; }
  .lab-chips > * { flex: 0 0 auto; }
}
.lab-promises svg { color: var(--teal); }

/* The shop's sections, at the top of the walk: tap one to walk there.
   Glass (it floats over the 3D, like the header). One line; on a narrow
   phone it scrolls sideways and keeps the lit section in view. */
.lab-open { margin: 2px 0 14px; }
.lab-aisles { position: absolute; z-index: 3; top: calc(var(--header-h) + 10px); left: 50%; transform: translateX(-50%); max-width: calc(100% - 32px); display: flex; gap: 2px; padding: 4px; border-radius: 999px; overflow-x: auto; scrollbar-width: none; }
.lab-aisles::-webkit-scrollbar { display: none; }
.lab-aisles button { flex: 0 0 auto; font-family: Inter, system-ui, sans-serif; font-size: 0.84rem; padding: 8px 14px; border-radius: 999px; color: var(--fg); white-space: nowrap; transition: background 0.3s, color 0.3s; }
.lab-aisles button.is-on { background: var(--fg); color: var(--bg); }
.lab-aisles button:focus-visible { outline: 2px solid var(--coral); outline-offset: 1px; }
@media (max-width: 420px) { .lab-aisles button { padding: 7px 11px; font-size: 0.8rem; } }

.lab-hint { margin-top: 6px; font-size: 0.92rem; }
.lab-sr:not(:focus-within) { position: absolute; width: 1px; height: 1px; padding: 0; margin: -1px; overflow: hidden; clip: rect(0 0 0 0); white-space: nowrap; border: 0; }

/* Lite hero */
.lab-lite { margin-top: calc(-1 * var(--header-h)); }
.lab-lite-frame { position: relative; height: 92vh; overflow: hidden; }
@supports (height: 100svh) { .lab-lite-frame { height: 92svh; } }
.lab-lite-img { position: absolute; inset: 0; width: 100%; height: 100%; object-fit: cover; will-change: transform; }

/* The calm page */
.lab-page { position: relative; z-index: 1; background: var(--bg); padding-top: 28px; }
.lab-section { padding-top: 40px; padding-bottom: 40px; }
.lab-head { display: flex; align-items: baseline; justify-content: space-between; margin-bottom: 20px; }
.lab-h2 { font-family: "Space Grotesk", system-ui, sans-serif; font-weight: 700; font-size: clamp(1.6rem, 2.6vw, 2.2rem); letter-spacing: -0.02em; line-height: 1.1; color: var(--fg); }
.lab-grid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 16px; }
@media (min-width: 640px) { .lab-grid { grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 24px; } .lab-grid-feature { grid-column: span 2; grid-row: span 2; } }

.lab-shelf { --lab-gutter: max(16px, calc((100vw - 1152px) / 2 + 24px)); display: flex; gap: 14px; overflow-x: auto; scroll-snap-type: x mandatory; scroll-padding-inline: var(--lab-gutter); padding: 4px var(--lab-gutter) 12px; scrollbar-width: none; }
.lab-shelf::-webkit-scrollbar { display: none; }
.lab-shelf-item { position: relative; flex: 0 0 auto; width: 168px; aspect-ratio: 4 / 5; border-radius: 22px; overflow: hidden; scroll-snap-align: start; background: var(--field-bg); text-align: left; }
@media (min-width: 1024px) { .lab-shelf-item { width: 206px; } }
.lab-shelf-item img, .lab-shelf-ph { position: absolute; inset: 0; width: 100%; height: 100%; object-fit: cover; transition: transform 0.6s cubic-bezier(0.16, 1, 0.3, 1); }
.lab-shelf-item:hover img { transform: scale(1.04); }
.lab-shelf-label { position: absolute; left: 0; right: 0; bottom: 0; padding: 40px 14px 12px; display: flex; flex-direction: column; gap: 2px; color: #fff; background: linear-gradient(to top, rgba(10,10,12,0.78), rgba(10,10,12,0)); }
.lab-shelf-label .font-num { opacity: 0.8; }

.lab-sale { position: relative; overflow: hidden; border-radius: 28px; padding: 44px 28px; display: grid; gap: 18px; align-items: center;
  background: repeating-linear-gradient(90deg, #121215 0 13px, #19191d 13px 15px, #0e0e11 15px 16px); }
@media (min-width: 768px) { .lab-sale { grid-template-columns: 1fr 1fr; padding: 56px 56px; } }
.lab-neon { font-family: "Space Grotesk", system-ui, sans-serif; font-weight: 600; font-size: clamp(4.2rem, 11vw, 8.5rem); line-height: 1; color: #fff4ec; letter-spacing: -0.01em;
  text-shadow: 0 0 6px #fff, 0 0 18px #ff4522, 0 0 42px #ff4522, 0 0 90px rgba(255,69,34,0.7); }
@media (prefers-reduced-motion: no-preference) { .lab-neon { animation: labNeon 7s infinite; } }
@keyframes labNeon { 0%, 92%, 100% { opacity: 1; } 93% { opacity: 0.55; } 94% { opacity: 1; } 95.5% { opacity: 0.7; } 96.5% { opacity: 1; } }

.lab-visit { display: grid; gap: 32px; align-items: center; }
@media (min-width: 900px) { .lab-visit { grid-template-columns: 1fr 1fr; } }
.lab-prints { position: relative; height: 380px; perspective: 1200px; }
.lab-print { position: absolute; width: 52%; aspect-ratio: 4 / 5; object-fit: cover; border-radius: 18px; border: 6px solid var(--bg-soft); box-shadow: 0 24px 60px rgba(20,20,26,0.22); transition: transform 0.7s cubic-bezier(0.16, 1, 0.3, 1); }
.lab-print-a { left: 4%; top: 6%; transform: rotate(-5deg); }
.lab-print-b { right: 4%; top: 14%; transform: rotate(4deg); }
.lab-prints:hover .lab-print-a { transform: rotate(-8deg) translate(-10px, -6px); }
.lab-prints:hover .lab-print-b { transform: rotate(7deg) translate(10px, 4px); }

.lab-promise-row { list-style: none; margin: 0; padding: 22px 0 8px; display: flex; flex-wrap: wrap; gap: 14px 32px; border-top: 1px solid var(--border); font-family: Inter, system-ui, sans-serif; color: var(--fg); }
.lab-promise-row li { display: inline-flex; align-items: center; gap: 10px; }
.lab-promise-row svg { color: var(--teal); }

/* Preview switch */
.lab-switch { position: fixed; z-index: 60; left: 50%; bottom: calc(16px + env(safe-area-inset-bottom)); transform: translateX(-50%); display: flex; gap: 4px; padding: 4px; border-radius: 999px; }
.lab-switch button { font-family: Inter, system-ui, sans-serif; font-size: 0.82rem; padding: 8px 14px; border-radius: 999px; color: var(--fg); white-space: nowrap; }
@media (max-width: 420px) { .lab-switch { left: 16px; transform: none; } .lab-switch button { padding: 8px 11px; font-size: 0.78rem; } }
.lab-switch button.is-on { background: var(--fg); color: var(--bg); }
.lab-switch button:disabled { opacity: 0.35; }

@media (prefers-reduced-motion: reduce) {
  .lab-canvas { transition: none; }
  .lab-print, .lab-shelf-item img { transition: none; }
}
`;
