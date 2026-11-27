/* ============================================================
   THE APP'S HOME — three directions under trial (27 Nov 2026)
   ------------------------------------------------------------
   The owner found the app's home "made by AI": a greeting with a waving
   hand, two tiles counting 0 favourites and 0 in the bag, ten pastel icon
   squares for the categories, slogans ("A curated edit, not just another
   category", "🔥 App Exclusives"). These three start from the shop's own
   pieces and its own things instead:
     window  — the shop window: the newest pieces, big, edge to edge; the
               sections as a line of words; prices set in type
     tag     — the shop's paper: every price on the Kanaan swing tag (the
               one the pieces hang on in the 3D shop and the posts), the
               sections as a ledger with their newest piece and a count
     shop    — the shop in Saida: its real front, open now, delivery; the
               sections walked as photo tiles of what is in them now
   /applab shows them side by side with a switch (noindex), on the live
   catalogue. The chosen one becomes NativeHomeView.
   No emoji, no greeting, no counters at zero, no icon in a coloured square.
   ============================================================ */
import React, { useMemo, useState } from "react";
import { ArrowRight, ChevronRight, Heart } from "lucide-react";
import { OpenNow } from "../components/SiteBits.jsx";
import { useSiteSettings, saidaNote } from "../lib/siteSettings.js";

/* what the home needs from App.jsx, passed in once (kit) */
function useHomeData(products, kit) {
  return useMemo(() => {
    const live = products.filter((p) => p.active !== false && !p.soldOut);
    const newest = [...live].sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
    const sale = live.filter(kit.isOnSale);
    const maxOff = sale.length ? Math.max(...sale.map((p) => p.discount || 0)) : 0;
    const exclusives = live.filter((p) => p.appExclusive);
    const sections = kit.CATEGORIES
      .map((c) => {
        const inIt = newest.filter((p) => p.category === c.id);
        return { ...c, count: inIt.length, lead: inIt[0] || null };
      })
      .filter((c) => c.count > 0);
    return { live, newest, sale, maxOff, exclusives, sections };
  }, [products, kit]);
}

const photo = (kit, p, big = false) => {
  const u = p && kit.getImages(p)[0];
  if (!u) return { src: "", full: "" };
  return { src: (big ? kit.bigUrlFor(u) : kit.thumbUrlFor(u)) || u, full: u };
};

function Img({ kit, p, big, className = "", style }) {
  const { src, full } = photo(kit, p, big);
  if (!src) return <div className={className} style={{ background: "var(--border)", ...style }} />;
  return <img src={src} alt={p.name} loading={big ? "eager" : "lazy"} decoding="async" onError={kit.photoFallback(full)} className={className} style={style} />;
}

const Price = ({ kit, p, className = "" }) => (
  <span className={`ah-price ${className}`}>
    {kit.isOnSale(p) && <s>{kit.money(p.price)}</s>}
    <b className={kit.isOnSale(p) ? "is-sale" : ""}>{kit.money(kit.effectivePrice(p))}</b>
  </span>
);

function Head({ title, onAll, all = "All" }) {
  return (
    <div className="ah-head">
      <h2>{title}</h2>
      {onAll && <button onClick={onAll}>{all}<ChevronRight size={15} strokeWidth={2.2} /></button>}
    </div>
  );
}

function Rail({ items, kit, nav, likes, toggleLike, width = 150 }) {
  const { ProductCard } = kit;
  return (
    <div className="ah-rail">
      {items.map((p) => (
        <div key={p.id} style={{ width }} className="flex-shrink-0">
          <ProductCard product={p} onOpen={nav.openProduct} liked={likes.includes(p.id)} onToggleLike={toggleLike} />
        </div>
      ))}
    </div>
  );
}

/* the bits every direction keeps: only in the app, recently viewed */
function AppOnly({ d, kit, nav, dark = true }) {
  if (!d.exclusives.length) return null;
  return (
    <section className={`ah-only ${dark ? "is-dark" : ""}`}>
      <div className="ah-head">
        <h2>Only in the app</h2>
        <button onClick={nav.goExclusives}>All<ChevronRight size={15} strokeWidth={2.2} /></button>
      </div>
      <p className="ah-only-line">These prices aren't on the website.</p>
      <div className="ah-rail">
        {d.exclusives.slice(0, 8).map((p) => (
          <button key={p.id} className="ah-only-piece" onClick={() => nav.openProduct(p)}>
            <Img kit={kit} p={p} className="ah-only-img" />
            <span className="ah-only-name">{p.name}</span>
            <Price kit={kit} p={p} />
          </button>
        ))}
      </div>
    </section>
  );
}

function Recent({ recent, kit, nav, likes, toggleLike }) {
  if (!recent.length) return null;
  return (
    <section className="ah-sec">
      <Head title="You looked at" />
      <Rail items={recent} kit={kit} nav={nav} likes={likes} toggleLike={toggleLike} width={130} />
    </section>
  );
}

/* ---------------- 1. the shop window ---------------- */
function WindowHome({ d, kit, nav, likes, toggleLike, recent }) {
  const hero = d.newest.slice(0, 5);
  const [at, setAt] = useState(0);
  const onScroll = (e) => {
    const el = e.currentTarget;
    setAt(Math.round(el.scrollLeft / Math.max(1, el.clientWidth)));
  };
  const cur = hero[at] || hero[0];
  return (
    <div className="ah ah-window">
      <div className="ah-top">
        <kit.LogoMark variant="compact" className="ah-logo" />
        <OpenNow className="ah-open" />
      </div>

      {cur && (
        <section className="ahw-hero">
          <div className="ahw-strip" onScroll={onScroll}>
            {hero.map((p, i) => (
              <button key={p.id} className="ahw-slide" onClick={() => nav.openProduct(p)}>
                <Img kit={kit} p={p} big={i < 2} className="ahw-img" />
              </button>
            ))}
          </div>
          <div className="ahw-caption">
            <div className="min-w-0">
              <p className="ahw-kicker">Just in · {at + 1} of {hero.length}</p>
              <p className="ahw-name">{cur.name}</p>
            </div>
            <Price kit={kit} p={cur} className="ahw-price" />
          </div>
        </section>
      )}

      <nav className="ahw-sections" aria-label="Sections">
        {d.sections.map((c) => (
          <button key={c.id} onClick={() => nav.goCatalog(c.id)}>
            {c.label}<sup>{c.count}</sup>
          </button>
        ))}
      </nav>

      {d.sale.length > 0 && (
        <button className="ahw-sale" onClick={nav.goSale}>
          <span className="ahw-sale-off">−{d.maxOff}%</span>
          <span className="ahw-sale-words">{d.sale.length} {d.sale.length === 1 ? "piece" : "pieces"} on sale</span>
          <ArrowRight size={18} />
        </button>
      )}

      <section className="ah-sec">
        <Head title="New this week" onAll={() => nav.goCatalog("all")} />
        <div className="ahw-grid">
          {d.newest.slice(5, 11).map((p) => (
            <kit.ProductCard key={p.id} product={p} onOpen={nav.openProduct} liked={likes.includes(p.id)} onToggleLike={toggleLike} />
          ))}
        </div>
      </section>

      <AppOnly d={d} kit={kit} nav={nav} />
      <Recent recent={recent} kit={kit} nav={nav} likes={likes} toggleLike={toggleLike} />
    </div>
  );
}

/* ---------------- 2. the shop's paper: the swing tag ---------------- */
function Tag({ kit, p, big = false, sizes = true }) {
  const left = (p.sizes || []).slice(0, 5);
  return (
    <span className={`aht-tag ${big ? "is-big" : ""}`}>
      <i className="aht-eye" aria-hidden="true" />
      {big && <span className="aht-tag-name">{p.name}</span>}
      <Price kit={kit} p={p} className="aht-tag-price" />
      {big && kit.isOnSale(p) && <span className="aht-off">−{p.discount}%</span>}
      {big && sizes && left.length > 0 && (
        <span className="aht-sizes">{left.map((s) => <em key={s}>{s}</em>)}</span>
      )}
      {big && <span className="aht-brand">KANAAN</span>}
    </span>
  );
}

function TagPiece({ kit, p, nav, likes, toggleLike }) {
  return (
    <button className="aht-piece" onClick={() => nav.openProduct(p)}>
      <span className="aht-piece-photo"><Img kit={kit} p={p} className="aht-piece-img" /></span>
      <Tag kit={kit} p={p} />
      <span className="aht-piece-name">{p.name}</span>
    </button>
  );
}

function TagHome({ d, kit, nav, likes, toggleLike, recent }) {
  const hero = d.newest[0];
  return (
    <div className="ah ah-tag">
      <div className="aht-top">
        <kit.LogoMark variant="compact" className="ah-logo" />
        <p>Menswear from Saida, Lebanon</p>
      </div>

      {hero && (
        <section className="aht-hero">
          <button className="aht-hero-photo" onClick={() => nav.openProduct(hero)}>
            <Img kit={kit} p={hero} big className="aht-hero-img" />
          </button>
          <button className="aht-hero-tag" onClick={() => nav.openProduct(hero)}><Tag kit={kit} p={hero} big /></button>
        </section>
      )}

      <section className="ah-sec">
        <div className="aht-chapter"><h2>The shop</h2><span>{d.live.length} pieces</span></div>
        <div className="aht-ledger">
          {d.sections.map((c) => (
            <button key={c.id} onClick={() => nav.goCatalog(c.id)} className="aht-line">
              {c.lead ? <Img kit={kit} p={c.lead} className="aht-line-img" /> : <span className="aht-line-img" />}
              <span className="aht-line-name">{c.label}</span>
              <span className="aht-dots" aria-hidden="true" />
              <span className="aht-line-n">{c.count}</span>
              <ChevronRight size={16} className="aht-line-go" />
            </button>
          ))}
          {d.sale.length > 0 && (
            <button onClick={nav.goSale} className="aht-line is-sale">
              <span className="aht-line-img aht-sale-mark">%</span>
              <span className="aht-line-name">On sale, up to −{d.maxOff}%</span>
              <span className="aht-dots" aria-hidden="true" />
              <span className="aht-line-n">{d.sale.length}</span>
              <ChevronRight size={16} className="aht-line-go" />
            </button>
          )}
        </div>
      </section>

      <section className="ah-sec">
        <div className="aht-chapter"><h2>New in</h2><button onClick={() => nav.goCatalog("all")}>All <ChevronRight size={15} /></button></div>
        <div className="aht-grid">
          {d.newest.slice(1, 7).map((p) => <TagPiece key={p.id} kit={kit} p={p} nav={nav} likes={likes} toggleLike={toggleLike} />)}
        </div>
      </section>

      <AppOnly d={d} kit={kit} nav={nav} />
      <Recent recent={recent} kit={kit} nav={nav} likes={likes} toggleLike={toggleLike} />
    </div>
  );
}

/* ---------------- 3. the shop in Saida ---------------- */
function ShopHome({ d, kit, nav, likes, toggleLike, recent }) {
  const s = useSiteSettings();
  const saida = saidaNote(s, kit.money);
  return (
    <div className="ah ah-shop">
      <section className="ahs-front">
        <img src="/home/shop-front.webp" alt="Kanaan Shop in Saida" className="ahs-front-img" width="640" height="800" decoding="async" />
        <div className="ahs-front-words">
          <p className="ahs-where">Kanaan · Saida</p>
          <OpenNow className="ahs-open" />
          <p className="ahs-deliver">Delivery all over Lebanon {kit.money(s.deliveryFee)}{saida ? `, ${saida}` : ""}. Cash at your door.</p>
        </div>
      </section>

      <section className="ah-sec">
        <Head title="Walk in" onAll={() => nav.goCatalog("all")} all="Everything" />
        <div className="ahs-tiles">
          {d.sections.map((c, i) => (
            <button key={c.id} className={`ahs-tile ${i === 0 ? "is-wide" : ""}`} onClick={() => nav.goCatalog(c.id)}>
              {c.lead && <Img kit={kit} p={c.lead} big={i === 0} className="ahs-tile-img" />}
              <span className="ahs-tile-words"><b>{c.label}</b><small>{c.count}</small></span>
            </button>
          ))}
        </div>
      </section>

      {d.sale.length > 0 && (
        <section className="ah-sec">
          <Head title={`On sale, up to −${d.maxOff}%`} onAll={nav.goSale} />
          <Rail items={d.sale.slice(0, 8)} kit={kit} nav={nav} likes={likes} toggleLike={toggleLike} />
        </section>
      )}

      <section className="ah-sec">
        <Head title="Just arrived" onAll={() => nav.goCatalog("all")} />
        <Rail items={d.newest.slice(0, 10)} kit={kit} nav={nav} likes={likes} toggleLike={toggleLike} />
      </section>

      <AppOnly d={d} kit={kit} nav={nav} />
      <Recent recent={recent} kit={kit} nav={nav} likes={likes} toggleLike={toggleLike} />
    </div>
  );
}

/* ---------------- 4. Kanaan: the shop in Saida, on its own paper (2 + 3, his pick) ----------------
   The shop's real front, then what is yours (the bag, the hearts — only when there is something), the newest
   piece on its swing tag, the sections walked as photo tiles labelled on small tags, the sale, new in. Every
   card is the shop's own ProductCard (heart, quick add, photos that flick, your size). */
function Thumbs({ kit, items }) {
  return (
    <span className="ahk-thumbs">
      {items.slice(0, 3).map((p, i) => <Img key={p.id + i} kit={kit} p={p} className="ahk-thumb" />)}
    </span>
  );
}

function KanaanHome({ d, kit, nav, likes, toggleLike, recent, cart = [], products = [] }) {
  const s = useSiteSettings();
  const saida = saidaNote(s, kit.money);
  const hero = d.newest[0];
  const byId = (id) => products.find((p) => p.id === id);
  const bagPieces = cart.map((i) => byId(i.productId)).filter(Boolean);
  const bagCount = cart.reduce((a, i) => a + (i.qty || 1), 0);
  const bagTotal = cart.reduce((a, i) => a + (i.qty || 1) * (i.price || 0), 0);
  const saved = likes.map(byId).filter(Boolean);
  const heroLiked = hero && likes.includes(hero.id);
  return (
    <div className="ah ah-kanaan">

      <section className="ahs-front ahk-front">
        <img src="/home/shop-front.webp" alt="Kanaan Shop in Saida" className="ahs-front-img" width="640" height="800" decoding="async" />
        <div className="ahs-front-words">
          <p className="ahs-where">Kanaan · Saida</p>
          <OpenNow className="ahs-open" />
          <p className="ahs-deliver">Delivery all over Lebanon {kit.money(s.deliveryFee)}{saida ? `, ${saida}` : ""}. Cash at your door.</p>
        </div>
      </section>

      {(bagCount > 0 || saved.length > 0) && (
        <section className="ahk-yours">
          {bagCount > 0 && (
            <button className="aht-line" onClick={nav.onCart}>
              <Thumbs kit={kit} items={bagPieces} />
              <span className="aht-line-name">Your bag</span>
              <span className="aht-dots" aria-hidden="true" />
              <span className="aht-line-n">{bagCount} · {kit.money(bagTotal)}</span>
              <ChevronRight size={16} className="aht-line-go" />
            </button>
          )}
          {saved.length > 0 && (
            <button className="aht-line" onClick={nav.goFavorites}>
              <Thumbs kit={kit} items={saved} />
              <span className="aht-line-name">Saved</span>
              <span className="aht-dots" aria-hidden="true" />
              <span className="aht-line-n">{saved.length}</span>
              <ChevronRight size={16} className="aht-line-go" />
            </button>
          )}
        </section>
      )}

      {hero && (
        <section className="ah-sec">
          <div className="aht-chapter"><h2>Just in</h2><button onClick={() => nav.goCatalog("all")}>New in <ChevronRight size={15} /></button></div>
          <div className="aht-hero ahk-hero">
            <button className="aht-hero-photo" onClick={() => nav.openProduct(hero)}>
              <Img kit={kit} p={hero} big className="aht-hero-img" />
            </button>
            <button className={`ahk-like ${heroLiked ? "is-on" : ""}`} aria-label={heroLiked ? "Remove from saved" : "Save"} aria-pressed={heroLiked} onClick={() => toggleLike(hero.id)}>
              <Heart size={20} fill={heroLiked ? "currentColor" : "none"} />
            </button>
            <button className="aht-hero-tag" onClick={() => nav.openProduct(hero)}><Tag kit={kit} p={hero} big /></button>
          </div>
        </section>
      )}

      <section className="ah-sec">
        <div className="aht-chapter"><h2>Walk in</h2><span>{d.live.length} pieces</span></div>
        <div className="ahs-tiles ahk-tiles">
          {d.sections.map((c, i) => (
            <button key={c.id} className={`ahs-tile ${i === 0 ? "is-wide" : ""}`} onClick={() => nav.goCatalog(c.id)}>
              {c.lead && <Img kit={kit} p={c.lead} big={i === 0} className="ahs-tile-img" />}
              <span className="ahk-label"><i className="aht-eye" aria-hidden="true" /><b>{c.label}</b><small>{c.count}</small></span>
            </button>
          ))}
        </div>
      </section>

      {d.sale.length > 0 && (
        <section className="ah-sec">
          <div className="aht-chapter is-sale"><h2>On sale, up to −{d.maxOff}%</h2><button onClick={nav.goSale}>All <ChevronRight size={15} /></button></div>
          <div className="ahk-pad" />
          <Rail items={d.sale.slice(0, 8)} kit={kit} nav={nav} likes={likes} toggleLike={toggleLike} />
        </section>
      )}

      <section className="ah-sec">
        <div className="aht-chapter"><h2>New in</h2><button onClick={() => nav.goCatalog("all")}>All <ChevronRight size={15} /></button></div>
        <div className="ahw-grid ahk-grid">
          {d.newest.slice(1, 7).map((p) => (
            <kit.ProductCard key={p.id} product={p} onOpen={nav.openProduct} liked={likes.includes(p.id)} onToggleLike={toggleLike} />
          ))}
        </div>
      </section>

      <AppOnly d={d} kit={kit} nav={nav} />
      <Recent recent={recent} kit={kit} nav={nav} likes={likes} toggleLike={toggleLike} />
    </div>
  );
}

export const APP_HOMES = [
  { id: "kanaan", label: "Kanaan", C: KanaanHome },
  { id: "window", label: "Window", C: WindowHome },
  { id: "tag", label: "Hang tag", C: TagHome },
  { id: "shop", label: "The shop", C: ShopHome },
];

/** One of the app's homes (which = window | tag | shop). */
export function AppHome({ which = "kanaan", products, kit, nav, likes, toggleLike, recent = [], cart = [], loading = false, error = null, onRetry }) {
  const d = useHomeData(products, kit);
  const H = (APP_HOMES.find((h) => h.id === which) || APP_HOMES[0]).C;
  if (!products.length) {
    return (
      <div className="ah">
        <style>{AH_CSS}</style>
        <div className="ah-top"><kit.LogoMark variant="compact" className="ah-logo" /><OpenNow className="ah-open" /></div>
        {error && !loading ? (
          <div className="ah-empty">
            <p>Couldn't load the pieces. Check your connection.</p>
            <button onClick={onRetry}>Try again</button>
          </div>
        ) : (
          <div className="ah-wait" aria-label="Loading">
            <span className="ah-wait-front" />
            <span className="ah-wait-row"><i /><i /></span>
          </div>
        )}
      </div>
    );
  }
  return (
    <>
      <style>{AH_CSS}</style>
      <H d={d} kit={kit} nav={nav} likes={likes} toggleLike={toggleLike} recent={recent} cart={cart} products={products} />
    </>
  );
}

/** /applab — the three, a switch between them, in a phone-wide column. */
export function AppHomeLab(props) {
  const [which, setWhich] = useState(() => {
    try { return new URLSearchParams(window.location.search).get("v") || "kanaan"; } catch { return "kanaan"; }
  });
  const pick = (id) => {
    setWhich(id);
    try { const u = new URL(window.location.href); u.searchParams.set("v", id); window.history.replaceState(window.history.state, "", u); } catch { /* fine */ }
    window.scrollTo(0, 0);
  };
  return (
    <div className="ah-lab">
      <div className="ah-lab-bar glass" role="tablist">
        {APP_HOMES.map((h, i) => (
          <button key={h.id} role="tab" aria-selected={which === h.id} className={which === h.id ? "is-on" : ""} onClick={() => pick(h.id)}>
            <span>{i + 1}</span>{h.label}
          </button>
        ))}
      </div>
      <div className="ah-lab-phone">
        <AppHome which={which} {...props} />
      </div>
    </div>
  );
}

const AH_CSS = `
.ah { padding: 0 0 24px; color: var(--fg); }
.ah img { color: transparent; overflow: hidden; }
.ah-sec { padding: 0 0 30px; }
.ah-head { display: flex; align-items: baseline; justify-content: space-between; padding: 0 16px; margin-bottom: 12px; }
.ah-head h2 { font-family: 'Space Grotesk', sans-serif; font-weight: 700; font-size: 20px; letter-spacing: -0.01em; }
.ah-head button { display: inline-flex; align-items: center; gap: 1px; font-family: 'Inter', sans-serif; font-size: 14px; font-weight: 500; color: var(--fg-muted); min-height: 40px; }
.ah-rail { display: flex; gap: 12px; overflow-x: auto; padding: 0 16px 2px; scrollbar-width: none; scroll-snap-type: x mandatory; }
.ah-rail::-webkit-scrollbar { display: none; }
.ah-rail > * { scroll-snap-align: start; scroll-margin-left: 16px; }
.ah-price { display: inline-flex; align-items: baseline; gap: 6px; font-family: 'Space Grotesk', sans-serif; }
.ah-price s { font-size: .8em; color: var(--fg-muted); font-weight: 500; }
.ah-price b { font-weight: 700; }
.ah-price b.is-sale { color: var(--coral-text); }
.ah-top { display: flex; align-items: center; justify-content: space-between; padding: 14px 16px 12px; }
.ah-logo { height: 22px; width: auto; filter: var(--logo-filter, none); }
.ah-open { font-size: 12.5px; }

/* only in the app */
.ah-only { margin: 0 12px 30px; padding: 18px 0 18px; border-radius: 28px; background: var(--bg-soft); }
.ah-only.is-dark { background: #141416; color: #F5F5F7; }
.ah-only .ah-head { padding: 0 16px; margin-bottom: 2px; }
.ah-only.is-dark .ah-head button { color: rgba(245,245,247,.62); }
.ah-only-line { font-family: 'Inter', sans-serif; font-size: 13px; padding: 0 16px 14px; opacity: .62; }
.ah-only-piece { width: 124px; flex-shrink: 0; text-align: left; display: flex; flex-direction: column; gap: 3px; }
.ah-only-img { width: 124px; aspect-ratio: 4/5; object-fit: cover; border-radius: 16px; background: #232326; margin-bottom: 5px; }
.ah-only-name { font-family: 'Inter', sans-serif; font-size: 12.5px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; opacity: .9; }
.ah-only.is-dark .ah-price b.is-sale { color: #FF7A5C; }

/* 1. window */
.ahw-hero { padding: 0 0 18px; }
.ahw-strip { display: flex; overflow-x: auto; scroll-snap-type: x mandatory; scrollbar-width: none; gap: 0; }
.ahw-strip::-webkit-scrollbar { display: none; }
.ahw-slide { flex: 0 0 100%; scroll-snap-align: center; padding: 0 12px; }
.ahw-img { display: block; width: 100%; aspect-ratio: 4/5; object-fit: cover; border-radius: 28px; background: var(--border); }
.ahw-caption { display: flex; align-items: flex-end; justify-content: space-between; gap: 12px; padding: 14px 16px 0; }
.ahw-kicker { font-family: 'Inter', sans-serif; font-size: 13px; color: var(--fg-muted); }
.ahw-name { font-family: 'Space Grotesk', sans-serif; font-weight: 700; font-size: 26px; line-height: 1.1; letter-spacing: -0.02em; margin-top: 3px; }
.ahw-price { font-size: 22px; flex-shrink: 0; }
.ahw-sections { display: flex; gap: 20px; overflow-x: auto; padding: 6px 16px 22px; scrollbar-width: none; border-bottom: 1px solid var(--border); margin: 0 0 22px; }
.ahw-sections::-webkit-scrollbar { display: none; }
.ahw-sections button { font-family: 'Space Grotesk', sans-serif; font-weight: 600; font-size: 19px; white-space: nowrap; min-height: 40px; }
.ahw-sections sup { font-family: 'Inter', sans-serif; font-weight: 500; font-size: 11px; color: var(--fg-muted); margin-left: 3px; top: -0.7em; }
.ahw-sale { display: flex; align-items: center; gap: 12px; width: calc(100% - 32px); margin: 0 16px 30px; padding: 14px 18px; border-radius: 999px; background: var(--fg); color: var(--bg); text-align: left; }
.ahw-sale-off { font-family: 'Space Grotesk', sans-serif; font-weight: 700; font-size: 20px; color: var(--coral); }
.ahw-sale-words { flex: 1; font-family: 'Inter', sans-serif; font-weight: 500; font-size: 15px; }
.ahw-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 18px 12px; padding: 0 16px; }

/* 2. the tag */
.aht-top { display: flex; flex-direction: column; align-items: center; gap: 4px; padding: 16px 16px 14px; }
.aht-top p { font-family: 'Inter', sans-serif; font-size: 12.5px; color: var(--fg-muted); }
.aht-hero { position: relative; padding: 0 12px 34px; }
.aht-hero-photo { display: block; width: 100%; }
.aht-hero-img { display: block; width: 100%; aspect-ratio: 4/5; object-fit: cover; border-radius: 28px; background: var(--border); }
.aht-hero-tag::before { content: ''; position: absolute; left: 50%; top: -54px; width: 1.5px; height: 64px; background: #2a2a2e; border-radius: 2px; transform: rotate(8deg); transform-origin: bottom; z-index: 1; }
.aht-hero-tag { position: absolute; left: 28px; bottom: 10px; transform: rotate(-3deg); }
.aht-tag { --paper: #F7F4EE; position: relative; display: inline-flex; flex-direction: column; align-items: flex-start; gap: 2px; padding: 16px 12px 9px; background: var(--paper); color: #14141A; clip-path: polygon(10px 0, calc(100% - 10px) 0, 100% 10px, 100% 100%, 0 100%, 0 10px); border-radius: 0 0 6px 6px; filter: drop-shadow(0 6px 14px rgba(20,20,26,.18)); text-align: left; }
.aht-eye { position: absolute; top: 5px; left: 50%; width: 7px; height: 7px; margin-left: -3.5px; border-radius: 50%; background: var(--bg); box-shadow: inset 0 0 0 1.5px #9a958c; }
.aht-tag.is-big { min-width: 168px; max-width: 210px; padding: 20px 16px 12px; gap: 4px; }
.aht-tag.is-big .aht-eye { top: 7px; width: 10px; height: 10px; margin-left: -5px; }
.aht-tag-name { font-family: 'Inter', sans-serif; font-weight: 500; font-size: 14px; line-height: 1.25; }
.aht-tag-price { font-size: 15px; }
.aht-tag.is-big .aht-tag-price { font-size: 26px; }
.aht-tag .ah-price b.is-sale { color: #C93412; }
.aht-off { font-family: 'Space Grotesk', sans-serif; font-weight: 700; font-size: 12px; color: #fff; background: var(--coral); border-radius: 999px; padding: 2px 8px; }
.aht-sizes { display: flex; flex-wrap: wrap; gap: 4px; margin-top: 4px; }
.aht-sizes em { font-style: normal; font-family: 'Space Grotesk', sans-serif; font-weight: 600; font-size: 11px; border: 1px solid rgba(20,20,26,.35); border-radius: 999px; padding: 1px 7px; }
.aht-brand { align-self: stretch; border-top: 1px solid rgba(20,20,26,.15); margin-top: 8px; padding-top: 6px; font-family: 'Space Grotesk', sans-serif; font-weight: 700; font-size: 10px; letter-spacing: .34em; }
.aht-chapter { display: flex; align-items: baseline; justify-content: space-between; margin: 0 16px 6px; padding-bottom: 8px; border-bottom: 1.5px solid var(--fg); }
.aht-chapter h2 { font-family: 'Space Grotesk', sans-serif; font-weight: 700; font-size: 22px; letter-spacing: -0.01em; }
.aht-chapter span, .aht-chapter button { display: inline-flex; align-items: center; font-family: 'Inter', sans-serif; font-size: 13.5px; color: var(--fg-muted); }
.aht-ledger { display: flex; flex-direction: column; padding: 0 16px; }
.aht-line { display: flex; align-items: center; gap: 12px; min-height: 64px; border-bottom: 1px solid var(--border); text-align: left; }
.aht-line:active { background: var(--border); }
.aht-line-img { width: 42px; height: 52px; border-radius: 10px; object-fit: cover; background: var(--border); flex-shrink: 0; }
.aht-sale-mark { display: grid; place-items: center; background: var(--coral); color: #fff; font-family: 'Space Grotesk', sans-serif; font-weight: 700; font-size: 18px; }
.aht-line-name { font-family: 'Space Grotesk', sans-serif; font-weight: 600; font-size: 17px; white-space: nowrap; }
.aht-line.is-sale .aht-line-name { color: var(--coral-text); }
.aht-dots { flex: 1; min-width: 12px; height: 1px; border-bottom: 1.5px dotted var(--fg-muted); opacity: .6; transform: translateY(5px); }
.aht-line-n { font-family: 'Space Grotesk', sans-serif; font-weight: 600; font-size: 15px; color: var(--fg-muted); }
.aht-line-go { color: var(--fg-muted); flex-shrink: 0; }
.aht-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 22px 12px; padding: 14px 16px 0; }
.aht-piece { position: relative; display: flex; flex-direction: column; text-align: left; }
.aht-piece-photo { display: block; }
.aht-piece-img { display: block; width: 100%; aspect-ratio: 4/5; object-fit: cover; border-radius: 20px; background: var(--border); }
.aht-piece .aht-tag { position: absolute; right: 8px; top: calc(100% * 0 + 10px); transform: rotate(4deg); padding: 13px 9px 6px; }
.aht-piece-name { font-family: 'Inter', sans-serif; font-size: 13px; margin-top: 8px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }

/* 3. the shop */
.ahs-front { position: relative; margin: 0 12px 26px; border-radius: 28px; overflow: hidden; background: #141416; }
.ahs-front-img { display: block; width: 100%; aspect-ratio: 4/3.6; object-fit: cover; object-position: center 22%; }
.ahs-front-words { position: absolute; left: 0; right: 0; bottom: 0; padding: 60px 18px 16px; background: linear-gradient(to top, rgba(10,10,12,.86), rgba(10,10,12,0)); color: #fff; }
.ahs-where { font-family: 'Space Grotesk', sans-serif; font-weight: 700; font-size: 24px; letter-spacing: -0.01em; }
.ahs-open { color: rgba(255,255,255,.85) !important; font-size: 13px; margin-top: 2px; }
.ahs-open.is-open i { background: var(--teal); }
.ahs-deliver { font-family: 'Inter', sans-serif; font-size: 13px; color: rgba(255,255,255,.78); margin-top: 6px; line-height: 1.4; }
.ahs-tiles { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; padding: 0 16px; }
.ahs-tile { position: relative; aspect-ratio: 4/5; border-radius: 20px; overflow: hidden; background: var(--border); text-align: left; }
.ahs-tile.is-wide { grid-column: span 2; aspect-ratio: 16/10; }
.ahs-tile-img { position: absolute; inset: 0; width: 100%; height: 100%; object-fit: cover; }
.ahs-tile-words { position: absolute; left: 0; right: 0; bottom: 0; display: flex; align-items: baseline; justify-content: space-between; padding: 40px 12px 10px; background: linear-gradient(to top, rgba(10,10,12,.72), rgba(10,10,12,0)); color: #fff; }
.ahs-tile-words b { font-family: 'Space Grotesk', sans-serif; font-weight: 700; font-size: 17px; }
.ahs-tile.is-wide .ahs-tile-words b { font-size: 22px; }
.ahs-tile-words small { font-family: 'Inter', sans-serif; font-size: 12px; opacity: .8; }

/* 4. kanaan */
.ah-kanaan { padding-top: calc(env(safe-area-inset-top, 0px) + 12px); }
.ahk-front .ahs-front-img { aspect-ratio: 16/11; object-position: center 18%; }
.ahk-yours { display: flex; flex-direction: column; padding: 0 16px 26px; margin-top: -8px; }
.ahk-thumbs { display: flex; width: 64px; flex-shrink: 0; }
.ahk-thumb { width: 34px; height: 42px; border-radius: 9px; object-fit: cover; background: var(--border); border: 2px solid var(--bg); margin-left: -14px; }
.ahk-thumb:first-child { margin-left: 0; }
.ahk-hero { padding-top: 14px; padding-left: 0; padding-right: 0; margin: 0 12px; }
.ahk-like { position: absolute; top: 28px; right: 14px; width: 44px; height: 44px; border-radius: 50%; display: grid; place-items: center; background: rgba(247,244,238,.92); color: #14141A; box-shadow: 0 4px 14px rgba(20,20,26,.16); }
.ahk-like.is-on { color: var(--coral); }
.ahk-tiles { padding-top: 14px; }
.ahk-label { position: absolute; left: 10px; bottom: 10px; display: inline-flex; align-items: baseline; gap: 7px; padding: 13px 11px 7px; background: #F7F4EE; color: #14141A; clip-path: polygon(8px 0, calc(100% - 8px) 0, 100% 8px, 100% 100%, 0 100%, 0 8px); border-radius: 0 0 5px 5px; transform: rotate(-2deg); max-width: calc(100% - 20px); }
.ahk-label .aht-eye { top: 4px; width: 6px; height: 6px; margin-left: -3px; }
.ahk-label b { font-family: 'Space Grotesk', sans-serif; font-weight: 700; font-size: 15px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.ahs-tile.is-wide .ahk-label b { font-size: 19px; }
.ahk-label small { font-family: 'Space Grotesk', sans-serif; font-weight: 600; font-size: 12px; color: rgba(20,20,26,.55); }
.aht-chapter.is-sale h2 { color: var(--coral-text); }
.ahk-pad { height: 14px; }
.ahk-grid { padding-top: 16px; }

.ah-empty { padding: 40px 16px; font-family: 'Inter', sans-serif; font-size: 14px; color: var(--fg-muted); }
.ah-empty button { margin-top: 10px; min-height: 44px; padding: 0 20px; border-radius: 999px; background: var(--fg); color: var(--bg); font-weight: 600; }
.ah-wait { padding: 0 12px; }
.ah-wait-front { display: block; aspect-ratio: 16/11; border-radius: 28px; background: var(--border); }
.ah-wait-row { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; padding: 24px 4px 0; }
.ah-wait-row i { aspect-ratio: 4/5; border-radius: 20px; background: var(--border); }
@media (prefers-reduced-motion: no-preference) { .ah-wait span, .ah-wait i { animation: ahPulse 1.4s ease-in-out infinite alternate; } }
@keyframes ahPulse { from { opacity: .55; } to { opacity: 1; } }

/* the lab */
.ah-lab { max-width: 440px; margin: 0 auto; padding: 10px 0 40px; }
.ah-lab-bar { position: sticky; top: calc(var(--header-h, 64px) + 6px); z-index: 30; display: flex; gap: 4px; margin: 0 12px 14px; padding: 4px; border-radius: 999px; }
.ah-lab-bar button { flex: 1; display: inline-flex; align-items: center; justify-content: center; gap: 6px; min-height: 40px; border-radius: 999px; font-family: 'Inter', sans-serif; font-size: 13.5px; font-weight: 600; color: var(--fg-muted); }
.ah-lab-bar button span { font-family: 'Space Grotesk', sans-serif; font-size: 12px; width: 20px; height: 20px; border-radius: 50%; display: grid; place-items: center; background: var(--border); color: var(--fg); }
.ah-lab-bar button.is-on { background: var(--fg); color: var(--bg); }
.ah-lab-bar button.is-on span { background: var(--coral); color: #fff; }
.ah-lab-phone { border-radius: 32px; }
@media (min-width: 520px) { .ah-lab-phone { border: 1px solid var(--border); padding-top: 6px; background: var(--bg); overflow: hidden; } }
`;
