/* ============================================================
   REAL REVIEWS ON THE SITE
   ------------------------------------------------------------
   ReviewPage      /review/<token> — the buyer's own page, from the link
                   the shop sends on WhatsApp after an order: each piece
                   they bought with its photo, big stars, how it fits, a
                   few words. Nothing goes up before the shop reads it.
   ProductReviews  under a piece's words: the average, how it fits, the
                   reviews the shop approved (with its answers). Nothing at
                   all while there are none.
   RatingLine      the stars next to the price (a tap goes to the reviews)
   CardStars       small stars and the count on the grid's cards
   The server side: functions/_shared/reviews.js.
   ============================================================ */
import React, { useEffect, useMemo, useRef, useState } from "react";
import { Check, BadgeCheck, PenLine, Heart, Store, LoaderCircle, ArrowRight } from "lucide-react";

const STAR = "M12 2.6c.3 0 .58.17.72.45l2.5 5.06 5.58.81c.66.1.92.9.44 1.37l-4.04 3.93.95 5.56c.11.65-.57 1.15-1.16.84L12 18.0l-4.99 2.62c-.59.31-1.27-.19-1.16-.84l.95-5.56-4.04-3.93c-.48-.47-.22-1.27.44-1.37l5.58-.81 2.5-5.06c.14-.28.42-.45.72-.45z";
const FIT = { small: "Runs small", true: "True to size", large: "Runs large" };
const WORDS = ["", "Not for me", "It's okay", "Good", "Really good", "Love it"];
const TEXT_MAX = 600;
const date = (ms) => (ms ? new Date(ms).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" }) : "");
const reviewsWord = (n) => `${n} ${n === 1 ? "review" : "reviews"}`;

/** "Rami Haddad" → "Rami H." (the server writes it the same way). */
export function shownName(raw, fallback = "") {
  const words = (s) => String(s || "").replace(/[^\p{L}\p{M}\s'’-]/gu, " ").replace(/\s+/g, " ").trim().split(" ").filter(Boolean);
  let w = words(raw);
  if (!w.length) w = words(fallback);
  if (!w.length) return "Kanaan customer";
  const cap = (x) => x.charAt(0).toLocaleUpperCase("en") + x.slice(1).toLocaleLowerCase("en");
  const first = cap(w[0]).slice(0, 20);
  if (w.length < 2) return first;
  const initial = w[w.length - 1].replace(/^(al|el)[-’']/i, "").charAt(0).toLocaleUpperCase("en");
  return initial ? `${first} ${initial}.` : first;
}

/** Five stars, filled to the value (4.5 fills four and a half). */
export function Stars({ value = 0, size = 14, gap = 2, className = "", label }) {
  const v = Math.max(0, Math.min(5, Number(value) || 0));
  const fill = Math.floor(v) * (size + gap) + (v % 1) * size;
  const row = (cls) => (
    <span className={cls} style={{ gap }} aria-hidden="true">
      {[0, 1, 2, 3, 4].map((i) => <svg key={i} width={size} height={size} viewBox="0 0 24 24"><path d={STAR} fill="currentColor" /></svg>)}
    </span>
  );
  return (
    <span className={`rv-stars ${className}`} role="img" aria-label={label || `${v} out of 5 stars`} style={{ height: size }}>
      {row("rv-s-base")}
      <span className="rv-s-fill" style={{ width: fill }}>{row("rv-s-on")}</span>
    </span>
  );
}

/** Next to the price: ★★★★½ 4.6 · 12 reviews — a tap goes down to them. */
export function RatingLine({ reviews, className = "" }) {
  if (!reviews || !reviews.count) return null;
  const go = () => { const el = document.getElementById("reviews"); if (el) el.scrollIntoView({ behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth", block: "start" }); };
  return (
    <button type="button" className={`rv-line tap-scale ${className}`} onClick={go} data-testid="rating-line" aria-label={`Rated ${reviews.avg} out of 5 from ${reviewsWord(reviews.count)} — read them`}>
      <Stars value={reviews.avg} size={15} />
      <b className="font-num">{reviews.avg.toFixed(1)}</b>
      <span>{reviewsWord(reviews.count)}</span>
    </button>
  );
}

/** On a card of the grid: small stars and the count. */
export function CardStars({ reviews }) {
  if (!reviews || !reviews.count) return null;
  return (
    <span className="rv-cardstars" data-testid="card-stars" aria-label={`${reviews.avg} out of 5, ${reviewsWord(reviews.count)}`}>
      <Stars value={reviews.avg} size={11} gap={1} />
      <span className="font-num" aria-hidden="true">({reviews.count})</span>
    </span>
  );
}

/* ---------------- the piece's page ---------------- */
function FitBars({ fit }) {
  const total = (fit.small || 0) + (fit.true || 0) + (fit.large || 0);
  if (!total) return null;
  const top = ["true", "small", "large"].reduce((a, k) => ((fit[k] || 0) > (fit[a] || 0) ? k : a), "true");
  const verdict = top === "true" ? "Most say it's true to size" : top === "small" ? "Most say it runs small — think one size up" : "Most say it runs large — think one size down";
  return (
    <div className="rv-fit" data-testid="reviews-fit">
      <p className="rv-fit-h"><b>Fit</b><span>{verdict}</span></p>
      {["small", "true", "large"].map((k) => (
        <div className={`rv-fitrow ${k === top ? "is-top" : ""}`} key={k}>
          <span>{FIT[k]}</span>
          <span className="rv-fitbar" aria-hidden="true"><i style={{ width: `${((fit[k] || 0) / total) * 100}%` }} /></span>
          <span className="font-num">{fit[k] || 0}</span>
        </div>
      ))}
    </div>
  );
}

function OneReview({ r }) {
  return (
    <li className="rv-item" data-testid="review-item">
      <div className="rv-item-top">
        <Stars value={r.rating} size={14} />
        {r.fit ? <span className="rv-fitchip">{FIT[r.fit]}</span> : null}
        <time className="rv-date">{date(r.date)}</time>
      </div>
      <p className="rv-who"><b>{r.name}</b><span className="rv-verified"><BadgeCheck size={14} strokeWidth={2.2} aria-hidden="true" />Verified buyer{r.bought ? ` · bought ${r.bought}` : ""}</span></p>
      {r.text ? <p className="rv-text">{r.text}</p> : null}
      {r.reply ? (
        <div className="rv-reply" data-testid="review-reply">
          <p className="rv-reply-h"><span className="rv-reply-ic"><Store size={12} strokeWidth={2.4} aria-hidden="true" /></span>Kanaan Shop</p>
          <p className="rv-reply-t">{r.reply}</p>
        </div>
      ) : null}
    </li>
  );
}

export function ProductReviews({ product, apiBase = "" }) {
  const count = (product.reviews && product.reviews.count) || 0;
  const [data, setData] = useState(null);
  const [all, setAll] = useState(false);
  useEffect(() => {
    setData(null); setAll(false);
    if (!count) return undefined;
    let live = true;
    fetch(`${apiBase}/api/reviews?product=${encodeURIComponent(product.id)}`).then((r) => r.json()).then((d) => { if (live) setData(d); }).catch(() => { if (live) setData({ summary: { count: 0 }, reviews: [] }); });
    return () => { live = false; };
  }, [product.id, count]); // eslint-disable-line react-hooks/exhaustive-deps
  if (!count) return null;
  const s = (data && data.summary) || { avg: product.reviews.avg, count, fit: {} };
  const list = (data && data.reviews) || [];
  if (data && !s.count) return null;
  const shown = all ? list : list.slice(0, 4);
  return (
    <section id="reviews" className="rv-sec" aria-labelledby="reviews-h" data-testid="product-reviews">
      <div className="rv-sec-head">
        <h2 id="reviews-h" className="font-display font-bold text-xl">Reviews</h2>
        <span className="rv-sec-sub"><BadgeCheck size={15} strokeWidth={2.2} aria-hidden="true" />From people who bought it, checked by the shop</span>
      </div>
      <div className="rv-grid">
        <aside className="rv-sum" data-testid="reviews-summary">
          <div className="rv-avg">
            <b className="font-num" data-testid="reviews-avg">{Number(s.avg || 0).toFixed(1)}</b>
            <span className="rv-avg-r"><Stars value={s.avg} size={18} gap={2} /><span className="rv-count" data-testid="reviews-count">{reviewsWord(s.count)} · out of 5</span></span>
          </div>
          {s.fit ? <FitBars fit={s.fit} /> : null}
        </aside>
        <div className="rv-main">
          {!data ? <div className="rv-wait" aria-label="Loading the reviews"><i /><i /><i /></div> : (
            <ol className="rv-list">{shown.map((r) => <OneReview key={r.id} r={r} />)}</ol>
          )}
          {data && list.length > shown.length && (
            <button type="button" className="rv-more tap-scale" onClick={() => setAll(true)} data-testid="reviews-more">Show all {list.length} reviews</button>
          )}
        </div>
      </div>
    </section>
  );
}

/* ---------------- the buyer's page ---------------- */
function StarPick({ value, onChange, name }) {
  const [hover, setHover] = useState(0);
  const [pop, setPop] = useState(0);
  const shown = hover || value;
  const keys = (e) => {
    if (e.key === "ArrowRight" || e.key === "ArrowUp") { e.preventDefault(); onChange(Math.min(5, (value || 0) + 1)); }
    if (e.key === "ArrowLeft" || e.key === "ArrowDown") { e.preventDefault(); onChange(Math.max(1, (value || 1) - 1)); }
  };
  return (
    <div className="rv-pick">
      <div className="rv-pick-row" role="radiogroup" aria-label={`Your stars for ${name}`} onPointerLeave={() => setHover(0)} onKeyDown={keys}>
        {[1, 2, 3, 4, 5].map((n) => (
          <button key={n} type="button" role="radio" aria-checked={value === n} aria-label={`${n} ${n === 1 ? "star" : "stars"} — ${WORDS[n]}`}
            tabIndex={value ? (value === n ? 0 : -1) : n === 1 ? 0 : -1}
            className={`rv-pick-star ${n <= shown ? "on" : ""} ${pop === n ? "pop" : ""}`}
            onPointerEnter={(e) => { if (e.pointerType === "mouse") setHover(n); }}
            onClick={() => { onChange(n); setPop(n); try { navigator.vibrate && navigator.vibrate(8); } catch { /* not on this phone */ } }}
            data-testid={`rv-star-${n}`}>
            <svg viewBox="0 0 24 24" width="34" height="34" aria-hidden="true"><path d={STAR} /></svg>
          </button>
        ))}
      </div>
      <p className="rv-pick-word" aria-live="polite">{shown ? WORDS[shown] : "Tap the stars"}</p>
    </div>
  );
}

function PieceCard({ piece, token, apiBase, who, onSaved, index }) {
  const had = piece.review;
  const [edit, setEdit] = useState(!had);
  const [rating, setRating] = useState(had ? had.rating : 0);
  const [fit, setFit] = useState(had ? had.fit : "");
  const [text, setText] = useState(had ? had.text : "");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const [fresh, setFresh] = useState(false);
  const send = async () => {
    if (!rating) { setErr("Tap the stars first."); return; }
    setBusy(true); setErr("");
    try {
      const r = await fetch(`${apiBase}/api/review/${token}`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ productId: piece.productId, rating, fit, text, name: who }) });
      const d = await r.json().catch(() => ({}));
      if (!r.ok) { setErr(d.error || "That didn't go through — try again in a moment."); setBusy(false); return; }
      setFresh(true); setEdit(false); onSaved(d);
    } catch { setErr("No connection — check the internet and send it again."); }
    setBusy(false);
  };
  const status = had && had.status;
  return (
    <article className="rv-card" style={{ animationDelay: `${80 + index * 70}ms` }} data-testid={`rv-piece-${piece.productId}`}>
      <div className="rv-card-top">
        <div className="rv-photo">{piece.image ? <img src={/^\//.test(piece.image) ? `${apiBase}${piece.image}` : piece.image} alt="" loading={index ? "lazy" : "eager"} /> : null}</div>
        <div className="rv-card-name">
          <h2 className="font-display">{piece.name}</h2>
          {piece.bought ? <p>{piece.bought}</p> : null}
        </div>
      </div>
      {!edit && had ? (
        <div className={`rv-done ${fresh ? "is-fresh" : ""}`} data-testid="rv-done">
          <div className="rv-done-row">
            <span className="rv-done-ic"><Check size={16} strokeWidth={3} aria-hidden="true" /></span>
            <p data-testid="rv-done-words">{status === "approved" ? "Thanks — it's on the site" : status === "hidden" ? "Thanks — the shop has read it" : "Thanks — waiting for the shop to check it"}</p>
          </div>
          <div className="rv-done-mine">
            <Stars value={had.rating} size={15} />
            {had.fit ? <span className="rv-fitchip">{FIT[had.fit]}</span> : null}
            {status === "pending" && <button type="button" className="rv-edit tap-scale" onClick={() => { setEdit(true); setFresh(false); }} data-testid="rv-edit"><PenLine size={14} aria-hidden="true" />Edit</button>}
          </div>
          {had.text ? <p className="rv-done-text">{had.text}</p> : null}
        </div>
      ) : (
        <div className="rv-form">
          <StarPick value={rating} onChange={(n) => { setRating(n); setErr(""); }} name={piece.name} />
          <fieldset className="rv-fitpick">
            <legend>How does it fit?</legend>
            <div role="radiogroup" aria-label="How does it fit?">
              {["small", "true", "large"].map((k) => (
                <button key={k} type="button" role="radio" aria-checked={fit === k} className={`rv-chip tap-scale ${fit === k ? "on" : ""}`} onClick={() => setFit(fit === k ? "" : k)} data-testid={`rv-fit-${k}`}>{FIT[k]}</button>
              ))}
            </div>
          </fieldset>
          <label className="rv-textlab">
            <span>A few words <i>(if you like)</i></span>
            <textarea value={text} maxLength={TEXT_MAX} rows={4} onChange={(e) => setText(e.target.value)} placeholder="The fabric, the colour, how it wears…" data-testid="rv-text" />
            <small className="font-num" aria-live="polite">{text.length}/{TEXT_MAX}</small>
          </label>
          {err ? <p className="rv-err" role="alert">{err}</p> : null}
          <button type="button" className={`rv-send tap-scale ${rating ? "" : "is-off"}`} onClick={send} disabled={busy} data-testid="rv-send">
            {busy ? <LoaderCircle size={18} className="rv-spin" aria-hidden="true" /> : null}{had ? "Send the change" : "Send"}
          </button>
        </div>
      )}
    </article>
  );
}

export function ReviewPage({ token, apiBase = "", goHome }) {
  const [data, setData] = useState(null);
  const [who, setWho] = useState("");
  const [nameEdit, setNameEdit] = useState(false);
  const named = useRef(false);
  const load = () => fetch(`${apiBase}/api/review/${encodeURIComponent(token)}`).then(async (r) => {
    const d = await r.json().catch(() => ({}));
    if (!r.ok) { setData({ error: d.error || "This review link isn't right.", code: d.code || "ERROR", name: d.name || "" }); return; }
    setData(d);
    if (!named.current) { named.current = true; const mine = (d.pieces || []).find((p) => p.review); setWho(mine && mine.review.name ? mine.review.name : d.name || ""); }
  }).catch(() => setData({ error: "No connection — check the internet and open the link again.", code: "OFFLINE" }));
  useEffect(() => { load(); document.title = "Your review — Kanaan Shop"; }, [token]); // eslint-disable-line react-hooks/exhaustive-deps
  const pieces = (data && data.pieces) || [];
  const done = pieces.filter((p) => p.review).length;
  const allDone = pieces.length > 0 && done === pieces.length;
  const many = pieces.length > 1;
  const onSaved = (d) => { if (d && Array.isArray(d.pieces)) setData((x) => ({ ...x, pieces: d.pieces, done: d.done })); };
  const thanks = useRef(null);
  const wasDone = useRef(null);
  useEffect(() => {
    if (wasDone.current === false && allDone && thanks.current) thanks.current.scrollIntoView({ behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth", block: "center" });
    if (data && !data.error) wasDone.current = allDone;
  }, [allDone, data]);
  const preview = useMemo(() => shownName(who, data && data.name), [who, data]);

  if (!data) return <div className="rv-page" data-testid="review-page"><div className="rv-wait big"><i /><i /><i /></div></div>;
  if (data.error) {
    return (
      <div className="rv-page" data-testid="review-page">
        <div className="rv-oops" data-testid="review-error">
          <span className="rv-oops-ic"><Heart size={22} aria-hidden="true" /></span>
          <h1 className="font-display">{data.code === "EXPIRED" ? "This link has expired" : data.code === "OFFLINE" ? "No connection" : "This link isn't right"}</h1>
          <p>{data.code === "EXPIRED" ? `Thank you for shopping with us${data.name ? `, ${data.name}` : ""}! Review links stay open for two months.` : data.error}</p>
          {goHome && <button type="button" className="rv-send" onClick={goHome}>Go to the shop<ArrowRight size={17} aria-hidden="true" /></button>}
        </div>
      </div>
    );
  }
  return (
    <div className="rv-page" data-testid="review-page">
      <header className="rv-hero">
        <p className="rv-eyebrow">Kanaan Shop · Saida</p>
        <h1 className="font-display" data-testid="review-title">{many ? "How are your Kanaan pieces?" : "How's your Kanaan piece?"}</h1>
        <p className="rv-lead">{data.name ? `Hi ${data.name} — ` : ""}a few taps help the next person pick the right size. The shop reads every review before it goes up.</p>
        {many && <p className="rv-progress font-num" data-testid="review-progress"><span style={{ width: `${(done / pieces.length) * 100}%` }} /><b>{done} of {pieces.length} done</b></p>}
      </header>

      {allDone && (
        <div className="rv-thanks" ref={thanks} data-testid="review-thanks">
          <span className="rv-thanks-ic"><Heart size={22} strokeWidth={2.2} aria-hidden="true" /></span>
          <div>
            <h2 className="font-display">Thank you{data.name ? `, ${data.name}` : ""}!</h2>
            <p>Your words help the next person choose. We'll put {many ? "them" : "it"} up as soon as we've read {many ? "them" : "it"}.</p>
          </div>
          {goHome && <button type="button" className="rv-home tap-scale" onClick={goHome}>Back to the shop<ArrowRight size={16} aria-hidden="true" /></button>}
        </div>
      )}

      {!allDone && <div className={`rv-who-line ${nameEdit ? "is-edit" : ""}`} data-testid="rv-who">
        {nameEdit ? (
          <>
            <input value={who} maxLength={40} onChange={(e) => setWho(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") setNameEdit(false); }} placeholder="Your name" autoComplete="name" aria-label="Your name on the review" autoFocus data-testid="rv-name" />
            <button type="button" className="rv-who-btn is-done tap-scale" onClick={() => setNameEdit(false)} data-testid="rv-name-done">Done</button>
          </>
        ) : (
          <>
            <span className="rv-who-av font-num" aria-hidden="true">{preview.charAt(0)}</span>
            <p><span>Shown as <b data-testid="rv-shown">{preview}</b></span><small>Phone &amp; order stay private</small></p>
            <button type="button" className="rv-who-btn tap-scale" onClick={() => setNameEdit(true)} data-testid="rv-name-change">Change</button>
          </>
        )}
      </div>}

      <div className="rv-cards">
        {pieces.map((p, i) => <PieceCard key={p.productId} piece={p} token={token} apiBase={apiBase} who={who} onSaved={onSaved} index={i} />)}
      </div>
    </div>
  );
}

export const REVIEWS_CSS = `
.rv-stars { position: relative; display: inline-block; vertical-align: middle; line-height: 0; flex-shrink: 0; }
.rv-stars .rv-s-base, .rv-stars .rv-s-on { display: inline-flex; }
.rv-stars .rv-s-base { color: color-mix(in srgb, var(--fg) 17%, transparent); }
.rv-stars .rv-s-fill { position: absolute; left: 0; top: 0; height: 100%; overflow: hidden; white-space: nowrap; }
.rv-stars .rv-s-on { color: var(--fg); }
.rv-line { display: inline-flex; align-items: center; gap: 8px; margin: -10px 0 18px; padding: 4px 0; font-family: 'Inter', sans-serif; font-size: 13.5px; color: var(--fg); }
.rv-line b { font-size: 14px; font-weight: 600; }
.rv-line span { color: var(--fg-muted); text-decoration: underline; text-underline-offset: 3px; text-decoration-color: color-mix(in srgb, var(--fg) 25%, transparent); }
.rv-cardstars { margin-left: auto; display: inline-flex; align-items: center; gap: 4px; height: 12px; font-size: 11px; line-height: 12px; color: var(--fg-muted); white-space: nowrap; }

.rv-sec { margin-top: 64px; scroll-margin-top: calc(var(--header-h, 80px) + 12px); }
.rv-sec-head { display: flex; align-items: baseline; justify-content: space-between; gap: 6px 16px; flex-wrap: wrap; margin-bottom: 20px; }
.rv-sec-sub { display: inline-flex; align-items: center; gap: 6px; font-family: 'Inter', sans-serif; font-size: 13px; color: var(--fg-muted); }
.rv-sec-sub svg { color: var(--teal-text); }
.rv-grid { display: grid; gap: 24px; }
@media (min-width: 768px) { .rv-grid { grid-template-columns: 300px minmax(0, 1fr); gap: 44px; align-items: start; } .rv-sum { position: sticky; top: calc(var(--header-h, 80px) + 16px); } }
.rv-sum { padding: 22px 20px 20px; border-radius: 26px; background: var(--bg-soft); border: 1px solid var(--border); }
.rv-avg { display: flex; align-items: center; gap: 14px; }
.rv-avg b { font-size: 52px; line-height: .9; font-weight: 700; letter-spacing: -0.04em; }
.rv-avg-r { display: flex; flex-direction: column; gap: 6px; min-width: 0; }
.rv-count { font-family: 'Inter', sans-serif; font-size: 13px; color: var(--fg-muted); }
.rv-fit { margin-top: 18px; padding-top: 16px; border-top: 1px solid var(--border); font-family: 'Inter', sans-serif; }
.rv-fit-h { margin: 0 0 10px; font-size: 13.5px; line-height: 1.35; }
.rv-fit-h b { display: block; font-family: 'Space Grotesk', sans-serif; font-size: 15px; margin-bottom: 2px; }
.rv-fit-h span { color: var(--fg-muted); }
.rv-fitrow { display: grid; grid-template-columns: 92px minmax(0, 1fr) 22px; align-items: center; gap: 10px; padding: 4px 0; font-size: 13px; color: var(--fg-muted); }
.rv-fitrow .font-num { text-align: right; }
.rv-fitrow.is-top { color: var(--fg); font-weight: 600; }
.rv-fitbar { display: block; height: 6px; border-radius: 999px; background: var(--border); overflow: hidden; }
.rv-fitbar i { display: block; height: 100%; border-radius: inherit; background: color-mix(in srgb, var(--fg) 45%, transparent); }
.rv-fitrow.is-top .rv-fitbar i { background: var(--teal); }
.rv-list { list-style: none; margin: 0; padding: 0; }
.rv-item { padding: 18px 0 20px; border-top: 1px solid var(--border); font-family: 'Inter', sans-serif; }
.rv-item:first-child { border-top: 0; padding-top: 2px; }
.rv-item-top { display: flex; align-items: center; gap: 10px; flex-wrap: wrap; }
.rv-date { margin-left: auto; font-size: 12.5px; color: var(--fg-muted); }
.rv-fitchip { display: inline-flex; align-items: center; height: 24px; padding: 0 10px; border-radius: 999px; font-family: 'Inter', sans-serif; font-size: 12px; font-weight: 600; background: color-mix(in srgb, var(--teal) 13%, transparent); color: var(--teal-text); }
.rv-who { display: flex; align-items: center; flex-wrap: wrap; gap: 4px 10px; margin: 10px 0 0; font-size: 14px; }
.rv-verified { display: inline-flex; align-items: center; gap: 5px; font-size: 12.5px; color: var(--fg-muted); }
.rv-verified svg { color: var(--teal-text); flex-shrink: 0; }
.rv-text { margin: 8px 0 0; font-size: 15px; line-height: 1.6; color: var(--fg); white-space: pre-line; overflow-wrap: anywhere; max-width: 62ch; }
.rv-reply { margin-top: 12px; padding: 11px 14px 12px; border-radius: 6px 18px 18px 18px; background: var(--bg-soft); border: 1px solid var(--border); max-width: 62ch; }
.rv-reply-h { display: flex; align-items: center; gap: 7px; margin: 0 0 4px; font-family: 'Space Grotesk', sans-serif; font-size: 13px; font-weight: 700; }
.rv-reply-ic { width: 20px; height: 20px; border-radius: 999px; display: grid; place-items: center; background: var(--coral); color: #fff; }
.rv-reply-t { margin: 0; font-size: 14px; line-height: 1.55; color: var(--fg); white-space: pre-line; overflow-wrap: anywhere; }
.rv-more { margin-top: 8px; height: 46px; padding: 0 22px; border-radius: 999px; font-family: 'Inter', sans-serif; font-size: 14px; font-weight: 600; background: var(--glass-bg); border: 1px solid var(--glass-border); color: var(--fg); }
.rv-wait { display: grid; gap: 12px; }
.rv-wait i { display: block; height: 76px; border-radius: 20px; background: var(--border); opacity: .55; animation: rvPulse 1.4s ease-in-out infinite; }
.rv-wait.big { padding-top: 40px; } .rv-wait.big i { height: 220px; border-radius: 26px; }
.rv-wait i:nth-child(2) { animation-delay: .15s; } .rv-wait i:nth-child(3) { animation-delay: .3s; }
@keyframes rvPulse { 50% { opacity: .25; } }

.rv-page { max-width: 560px; margin: 0 auto; padding: 22px 16px 120px; font-family: 'Inter', sans-serif; }
.rv-hero { padding: 6px 2px 18px; }
.rv-eyebrow { margin: 0 0 8px; font-size: 12px; font-weight: 600; letter-spacing: .08em; text-transform: uppercase; color: var(--coral-text); }
.rv-hero h1 { margin: 0; font-size: clamp(30px, 8.4vw, 40px); line-height: 1.04; font-weight: 700; letter-spacing: -0.03em; text-wrap: balance; }
.rv-lead { margin: 12px 0 0; font-size: 15.5px; line-height: 1.55; color: var(--fg-muted); text-wrap: pretty; }
.rv-progress { position: relative; display: block; height: 30px; margin: 16px 0 0; border-radius: 999px; background: var(--field-bg); border: 1px solid var(--border); overflow: hidden; }
.rv-progress span { position: absolute; inset: 0 auto 0 0; background: color-mix(in srgb, var(--teal) 26%, transparent); transition: width .5s cubic-bezier(.2,.8,.2,1); }
.rv-progress b { position: relative; display: grid; place-items: center; height: 100%; font-size: 13px; font-weight: 600; }
.rv-who-line { display: flex; align-items: center; gap: 12px; height: 68px; margin: 4px 0 14px; padding: 0 12px 0 14px; border-radius: 22px; background: var(--bg-soft); border: 1px solid var(--border); }
.rv-who-line.is-edit { padding: 0 12px; }
.rv-who-av { width: 38px; height: 38px; border-radius: 999px; display: grid; place-items: center; flex-shrink: 0; background: color-mix(in srgb, var(--coral) 12%, transparent); color: var(--coral-text); font-size: 16px; font-weight: 700; }
.rv-who-line p { flex: 1; min-width: 0; margin: 0; }
.rv-who-line p span { display: block; font-size: 14px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.rv-who-line p small { display: block; margin-top: 2px; font-size: 11.5px; color: var(--fg-muted); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.rv-who-line input { flex: 1; min-width: 0; height: 44px; padding: 0 14px; border-radius: 14px; border: 1px solid var(--border); background: var(--field-bg); color: var(--fg); font: inherit; font-size: 16px; }
.rv-who-btn { flex-shrink: 0; height: 36px; padding: 0 13px; border-radius: 999px; font-size: 13.5px; font-weight: 600; color: var(--fg); background: var(--field-bg); border: 1px solid var(--border); }
.rv-who-btn.is-done { height: 44px; padding: 0 18px; background: var(--fg); color: var(--bg); border-color: var(--fg); }
.rv-cards { display: grid; gap: 14px; }
.rv-card { padding: 16px; border-radius: 28px; background: var(--bg-soft); border: 1px solid var(--border); box-shadow: 0 1px 0 rgba(20,20,26,0.02), 0 12px 32px -18px rgba(20,20,26,0.18); animation: rvIn .5s cubic-bezier(.2,.8,.2,1) both; }
@keyframes rvIn { from { opacity: 0; transform: translateY(10px); } }
.rv-card-top { display: flex; align-items: center; gap: 14px; }
.rv-photo { width: 76px; height: 95px; border-radius: 18px; overflow: hidden; flex-shrink: 0; background: var(--field-bg); border: 1px solid var(--border); }
.rv-photo img { width: 100%; height: 100%; object-fit: cover; display: block; }
.rv-card-name { min-width: 0; }
.rv-card-name h2 { margin: 0; font-size: 19px; line-height: 1.2; font-weight: 700; letter-spacing: -0.01em; overflow-wrap: anywhere; }
.rv-card-name p { margin: 5px 0 0; font-size: 13.5px; color: var(--fg-muted); }
.rv-form { margin-top: 14px; }
.rv-pick { padding: 12px 0 4px; border-top: 1px solid var(--border); }
.rv-pick-row { display: flex; justify-content: space-between; max-width: 330px; margin: 0 auto; }
.rv-pick-star { width: 56px; height: 56px; display: grid; place-items: center; border-radius: 999px; color: color-mix(in srgb, var(--fg) 16%, transparent); transition: color .15s ease, transform .15s ease; -webkit-tap-highlight-color: transparent; }
.rv-pick-star svg path { fill: currentColor; }
.rv-pick-star.on { color: var(--coral); }
.rv-pick-star:active { transform: scale(.9); }
.rv-pick-star:focus-visible { outline: 2px solid var(--coral); outline-offset: -4px; }
.rv-pick-star.pop svg { animation: rvPop .38s cubic-bezier(.3,1.6,.5,1); }
@keyframes rvPop { 0% { transform: scale(.7); } 60% { transform: scale(1.18); } 100% { transform: scale(1); } }
.rv-pick-word { height: 20px; margin: 2px 0 0; text-align: center; font-family: 'Space Grotesk', sans-serif; font-size: 15px; font-weight: 600; color: var(--fg); }
.rv-fitpick { border: 0; margin: 14px 0 0; padding: 0; min-width: 0; }
.rv-fitpick legend { padding: 0; margin-bottom: 8px; font-size: 13px; font-weight: 600; }
.rv-fitpick > div { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 8px; }
.rv-chip { height: 44px; padding: 0 6px; border-radius: 999px; font-family: 'Inter', sans-serif; font-size: 13.5px; font-weight: 600; color: var(--fg); background: var(--field-bg); border: 1px solid var(--border); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.rv-chip.on { background: var(--fg); color: var(--bg); border-color: var(--fg); }
@media (max-width: 359px) { .rv-chip { font-size: 12.5px; } }
.rv-textlab { position: relative; display: block; margin-top: 14px; }
.rv-textlab > span { display: block; font-size: 13px; font-weight: 600; margin-bottom: 8px; }
.rv-textlab > span i { font-style: normal; font-weight: 400; color: var(--fg-muted); }
.rv-textlab textarea { display: block; width: 100%; min-height: 108px; padding: 12px 14px 26px; border-radius: 18px; border: 1px solid var(--border); background: var(--field-bg); color: var(--fg); font: inherit; font-size: 16px; line-height: 1.5; resize: vertical; }
.rv-textlab textarea:focus, .rv-who-line input:focus { outline: none; border-color: var(--coral); box-shadow: 0 0 0 3px color-mix(in srgb, var(--coral) 18%, transparent); }
.rv-textlab small { position: absolute; right: 14px; bottom: 9px; font-size: 11.5px; color: var(--fg-muted); pointer-events: none; }
.rv-err { margin: 10px 0 0; font-size: 13.5px; color: var(--coral-text); }
.rv-send { display: flex; align-items: center; justify-content: center; gap: 8px; width: 100%; height: 54px; margin-top: 14px; border-radius: 999px; background: var(--coral); color: #fff; font-family: 'Inter', sans-serif; font-size: 16px; font-weight: 600; box-shadow: 0 10px 24px -12px rgba(255,69,34,0.7); }
.rv-send.is-off { background: var(--field-bg); color: var(--fg-muted); border: 1px solid var(--border); box-shadow: none; }
.rv-send:disabled { opacity: .7; }
.rv-spin { animation: rvSpin 1s linear infinite; }
@keyframes rvSpin { to { transform: rotate(360deg); } }
.rv-done { margin-top: 14px; padding-top: 14px; border-top: 1px solid var(--border); }
.rv-done-row { display: flex; align-items: center; gap: 10px; }
.rv-done-row p { margin: 0; font-size: 15px; font-weight: 600; }
.rv-done-ic { width: 30px; height: 30px; border-radius: 999px; display: grid; place-items: center; flex-shrink: 0; background: var(--teal); color: #fff; }
.rv-done.is-fresh .rv-done-ic { animation: rvPop .5s cubic-bezier(.3,1.6,.5,1); }
.rv-done-mine { display: flex; align-items: center; flex-wrap: wrap; gap: 8px 10px; margin-top: 12px; }
.rv-edit { margin-left: auto; display: inline-flex; align-items: center; gap: 6px; height: 34px; padding: 0 14px; border-radius: 999px; font-size: 13px; font-weight: 600; color: var(--fg); background: var(--field-bg); border: 1px solid var(--border); }
.rv-done-text { margin: 10px 0 0; font-size: 14.5px; line-height: 1.55; color: var(--fg-muted); white-space: pre-line; overflow-wrap: anywhere; }
.rv-thanks { display: grid; grid-template-columns: auto minmax(0, 1fr); gap: 12px 14px; align-items: start; margin: 0 0 16px; padding: 18px; border-radius: 28px; background: color-mix(in srgb, var(--teal) 14%, var(--bg-soft)); border: 1px solid color-mix(in srgb, var(--teal) 35%, transparent); animation: rvIn .5s cubic-bezier(.2,.8,.2,1) both; }
.rv-thanks-ic { width: 44px; height: 44px; border-radius: 999px; display: grid; place-items: center; background: var(--teal); color: #fff; }
.rv-thanks h2 { margin: 2px 0 4px; font-size: 22px; line-height: 1.15; font-weight: 700; }
.rv-thanks p { margin: 0; font-size: 14.5px; line-height: 1.5; color: var(--fg); }
.rv-home { grid-column: 1 / -1; display: inline-flex; align-items: center; justify-content: center; gap: 8px; height: 48px; border-radius: 999px; background: var(--fg); color: var(--bg); font-size: 15px; font-weight: 600; }
.rv-oops { margin-top: 40px; padding: 26px 22px; border-radius: 28px; background: var(--bg-soft); border: 1px solid var(--border); text-align: center; }
.rv-oops-ic { width: 52px; height: 52px; margin: 0 auto 12px; border-radius: 999px; display: grid; place-items: center; background: color-mix(in srgb, var(--coral) 12%, transparent); color: var(--coral-text); }
.rv-oops h1 { margin: 0 0 8px; font-size: 26px; font-weight: 700; letter-spacing: -0.02em; }
.rv-oops p { margin: 0 0 6px; font-size: 15px; line-height: 1.55; color: var(--fg-muted); }
@media (prefers-reduced-motion: reduce) {
  .rv-card, .rv-thanks, .rv-pick-star.pop svg, .rv-done.is-fresh .rv-done-ic, .rv-wait i { animation: none; }
  .rv-progress span, .rv-pick-star { transition: none; }
}
`;
