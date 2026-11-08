import { json, releaseExpiredOrders, releaseReservation, rateLimit, tooManyRequests } from "../_shared/util.js";
import { notifyShop } from "../_shared/webpush.js";
import { loadSettings, deliveryFor, activeWelcome, welcomeOn } from "../_shared/settings.js";
import { parsePhone } from "../_shared/phone.js";
import { ensureSchema } from "../_shared/site.js";
import { orderedBefore } from "../_shared/welcome.js";
import { ensureMembers, randomToken } from "../_shared/members.js";
import { whishOn, whishConfig, createPayment, HOLD_MIN } from "../_shared/whish.js";

/* POST /api/orders
   ------------------------------------------------------------
   Called when a customer submits checkout, BEFORE WhatsApp opens.

   Creates a 'pending' order and RESERVES the stock (doesn't deduct it).
   The shop takes it in Kanaan POS (it becomes a delivery invoice) or
   rejects it; a pending order nobody took lets go of its pieces after 24h.

   This is what stops the same piece being sold twice, while never
   deducting stock for an order that was never actually completed.

   Delivery: the website (pricing: 2) charges what Kanaan POS set (the fee,
   free from an amount); an app installed before that showed $5 and pays $5,
   so every shopper pays exactly what their screen said.

   The welcome offer (when the shop switched it on): a first website order —
   no order before from that phone number, apart from ones rejected,
   cancelled or never taken — gets N% off the pieces without an offer of
   their own, to the nearest dollar. Free delivery still counts from the
   amount before it. The invoice in Kanaan POS carries the same discount.

   Paid with Whish Money (pay: "whish", when the shop switched it on and its keys are in Cloudflare): the same
   order, held as 'paying' — not shown to the shop until Whish says it is paid — and a payment at Whish for its
   total; the answer carries Whish's page (payUrl) for the shopper. Whish not answering: nothing is kept, the
   shopper is told and can pay cash instead. Same prices either way. (functions/_shared/whish.js)
   ============================================================ */

const LEGACY_DELIVERY = 5;
const MAX_LINES = 20; // a real cart is a few pieces; this keeps one call inside the free plan's limits
const MAX_PIECES = 40;

function orderNumber() {
  // 6 digits — collision-checked against the DB below.
  return String(Math.floor(100000 + Math.random() * 900000));
}

/** Sent from the website itself (not from the Android / iPhone app, which calls from its own origin). */
function fromWebsite(request) {
  const o = request.headers.get("Origin") || "";
  if (!o) return true;
  try { const u = new URL(o); return u.host === new URL(request.url).host || /(^|\.)kanaanshop\.com$/.test(u.hostname); } catch { return true; }
}

export async function onRequestPost(context) {
  const { request, env } = context;
  if (!env.DB) return json({ error: "Database not configured." }, 500);

  // the website shut by hand: no orders from it (the shop's apps stay open — they call from their own origin)
  try {
    const st = await loadSettings(env);
    if (st.shut && st.shut.on && fromWebsite(request)) return json({ error: "The website is closed for a little while — message us on WhatsApp and we'll help you.", closed: true }, 409);
  } catch { /* settings unreadable: orders go on */ }

  /* Without a limit here, a script could submit hundreds of fake orders
     and reserve the whole catalogue for 24 hours — the shop would show
     as sold out to real customers. 8 per hour is far above what a real
     shopper does (usually one), while making that attack pointless. */
  const limit = await rateLimit(request, env, "orders", 8, 60 * 60 * 1000);
  if (!limit.allowed) {
    return tooManyRequests(limit.retryAfter, "You've placed several orders already. Please message us on WhatsApp to continue.");
  }

  let body = {};
  try { body = await request.json(); } catch { return json({ error: "bad json" }, 400); }
  const byWhish = body.pay === "whish";

  const clean = (s, max = 300) => String(s == null ? "" : s).trim().slice(0, max);
  const name = clean(body.name, 120);
  const rawPhone = clean(body.phone, 40);
  const area = clean(body.area, 80);
  const address = clean(body.address, 300);
  const notes = clean(body.notes, 500);
  const rawItems = Array.isArray(body.items) ? body.items : [];

  if (!name || !rawPhone || !address) return json({ error: "Missing customer details." }, 400);
  // one way of writing a number, the way the shop's program reads it (the driver calls it, WhatsApp opens it)
  const ph = parsePhone(rawPhone);
  if (!ph) return json({ error: "Check the phone number — for example 03 123 456 or 70 123 456 (with + for a number outside Lebanon).", field: "phone" }, 400);
  const phone = ph.pretty;
  if (rawItems.length === 0) return json({ error: "Cart is empty." }, 400);
  if (rawItems.length > MAX_LINES) return json({ error: `That's a lot for one order — up to ${MAX_LINES} different pieces, please (or message us on WhatsApp).` }, 400);

  try { await releaseExpiredOrders(env); } catch { /* non-fatal */ }

  // the same piece twice is one line
  const merged = new Map();
  for (const raw of rawItems) {
    const productId = clean(raw.productId, 120);
    if (!productId) continue;
    const w = { productId, colorKey: clean(raw.colorKey, 40), size: clean(raw.size, 20), color: clean(raw.color, 40), qty: Math.max(1, Math.min(99, Math.round(Number(raw.qty) || 1))) };
    const key = `${w.productId}|${w.colorKey}|${w.size}`;
    if (merged.has(key)) merged.get(key).qty = Math.min(99, merged.get(key).qty + w.qty); else merged.set(key, w);
  }
  const wanted = [...merged.values()];
  if (wanted.length === 0) return json({ error: "Cart is empty." }, 400);
  if (wanted.reduce((a, w) => a + w.qty, 0) > MAX_PIECES) return json({ error: `Up to ${MAX_PIECES} pieces in one order, please — message us on WhatsApp for more.` }, 400);

  /* Load every product in the cart in ONE query instead of one per line. */
  const uniqueIds = [...new Set(wanted.map((w) => w.productId))];
  const placeholders = uniqueIds.map(() => "?").join(",");

  const { results: productRows } = await env.DB.prepare(
    `SELECT id, name, price, badge, discount, sold_out, active FROM products WHERE id IN (${placeholders})`
  ).bind(...uniqueIds).all();
  const productById = new Map((productRows || []).map((p) => [p.id, p]));

  // Which of these products track stock at all. Products with no variant
  // rows are "untracked" and stay always available, exactly as before.
  const { results: trackedRows } = await env.DB.prepare(
    `SELECT DISTINCT product_id FROM variants WHERE product_id IN (${placeholders})`
  ).bind(...uniqueIds).all();
  const tracked = new Set((trackedRows || []).map((r) => r.product_id));

  // Rebuild every line from the DB — never trust prices sent by the browser.
  const items = [];
  let subtotal = 0;

  for (const w of wanted) {
    const p = productById.get(w.productId);
    if (!p || !p.active) return json({ error: `A piece in your cart is no longer available${p ? ` (${p.name})` : ""}. Please remove it and try again.`, productId: w.productId }, 409);
    if (p.sold_out) return json({ error: `${p.name} is sold out.`, productId: w.productId }, 409);

    const base = Math.round(Number(p.price) || 0);
    const disc = p.badge === "sale" ? Number(p.discount) || 0 : 0;
    const price = disc > 0 ? Math.round(base * (1 - disc / 100)) : base;

    items.push({
      productId: w.productId, name: p.name, colorKey: w.colorKey,
      color: w.color || w.colorKey, size: w.size, qty: w.qty, price,
      ...(disc > 0 && price < base ? { was: base, off: disc } : {}), // a piece with its own offer (the welcome offer leaves it)
    });
    subtotal += price * w.qty;
  }

  /* Reserve the stock: the condition lives inside the UPDATE itself, so of
     two shoppers checking out at the same instant exactly one gets the last
     piece. Anything going wrong on the way — a piece just sold, the database
     hiccuping — hands back every piece already held, so a failed checkout
     never leaves stock stuck. */
  const reserved = [];
  const rollback = async () => {
    if (reserved.length > 0) { try { await releaseReservation(env, reserved); } catch { /* the 24h expiry has no order to free: best effort */ } }
  };

  try {
    for (const it of items) {
      if (!tracked.has(it.productId)) continue; // untracked = unlimited

      const row = await env.DB.prepare(
        `UPDATE variants SET reserved = reserved + ?
         WHERE product_id = ? AND color = ? AND size = ? AND (quantity - reserved) >= ?
         RETURNING quantity, reserved`
      ).bind(it.qty, it.productId, it.colorKey, it.size, it.qty).first();

      if (!row) {
        await rollback();
        const current = await env.DB.prepare(
          "SELECT quantity, reserved FROM variants WHERE product_id = ? AND color = ? AND size = ?"
        ).bind(it.productId, it.colorKey, it.size).first();
        const available = current
          ? Math.max(0, (Number(current.quantity) || 0) - (Number(current.reserved) || 0))
          : 0;
        return json({
          error: available
            ? `Sorry — only ${available} left of ${it.name} (${it.color || it.colorKey} / ${it.size}). Please adjust your cart.`
            : `Sorry — ${it.name} (${it.color || it.colorKey} / ${it.size}) just sold out. Please remove it from your cart.`,
          productId: it.productId, colorKey: it.colorKey, size: it.size, available,
        }, 409);
      }

      reserved.push(it);
    }
  } catch {
    await rollback();
    return json({ error: "Could not save your order. Please try again." }, 500);
  }

  // Unique order number.
  let id = orderNumber();
  for (let i = 0; i < 5; i++) {
    const hit = await env.DB.prepare("SELECT id FROM orders WHERE id = ?").bind(id).first();
    if (!hit) break;
    id = orderNumber();
  }

  const now = Date.now();
  let delivery = LEGACY_DELIVERY;
  let settings = null;
  try { settings = await loadSettings(env); } catch { settings = null; }
  if (byWhish && !whishOn(env, settings)) {
    await rollback();
    return json({ error: "Whish isn't available right now — choose cash on delivery.", field: "pay", whishOff: true }, 409);
  }
  // (a Whish order always pays the shop's own delivery: only today's site and app offer Whish, and the total goes to
  // Whish as it is — the old apps' flat fee is never what a card is charged)
  if ((Number(body.pricing) >= 2 || byWhish) && settings) delivery = deliveryFor(settings, subtotal);
  // the welcome offer on a first order (the lines it is on are marked, so the invoice spreads it on them only)
  let welcome = null;
  try {
    const w = activeWelcome(settings, now);
    if (w && !(await orderedBefore(env, ph))) welcome = welcomeOn(w, items.map((it) => ({ price: it.price, qty: it.qty, onSale: !!it.off })));
  } catch { welcome = null; }
  if (welcome) for (const i of welcome.lines) items[i].welcome = 1;
  const discount = welcome ? welcome.discount : 0;
  const promo = welcome ? `welcome:${welcome.pct}` : "";
  const total = subtotal - discount + delivery;

  const track = randomToken(12); // the order's own page: /order/<number>?t=<track>
  // Whish: the order is kept first (as 'paying', unseen by the shop), then the payment is made at Whish — a checkout
  // cut off half way leaves an order that lets go of its pieces by itself, never pieces held by nothing
  const payKey = byWhish ? randomToken(18) : "";
  const cfg = byWhish ? whishConfig(env) : null;
  try {
    await ensureSchema(env);
    await ensureMembers(env);
    await env.DB.prepare(
      `INSERT INTO orders (id, status, customer_name, phone, area, address, notes, items, subtotal, discount, promo, delivery, total, created_at, updated_at, track,
         pay, pay_status, pay_key, pay_until, whish_mode)
       VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`
    ).bind(id, byWhish ? "paying" : "pending", name, phone, area, address, notes, JSON.stringify(items), subtotal, discount, promo, delivery, total, now, now, track,
      byWhish ? "whish" : "cod", byWhish ? "waiting" : "", payKey, byWhish ? now + HOLD_MIN * 60000 : 0, cfg ? (cfg.sandbox ? "sandbox" : "live") : "").run();
  } catch {
    // Stock was reserved but the order record didn't save — release it
    // rather than leaving pieces held by an order that doesn't exist.
    await rollback();
    return json({ error: "Could not save your order. Please try again." }, 500);
  }
  let whish = null;
  if (byWhish) {
    try {
      whish = await createPayment(env, request, { id, total, track, payKey });
      await env.DB.prepare("UPDATE orders SET whish_ext = ?, whish_url = ?, whish_link_at = ? WHERE id = ? AND status = 'paying'").bind(whish.ext, whish.url, Date.now(), id).run();
    } catch {
      // Whish not answering: the order goes (never shown to the shop) and its pieces are free again
      const gone = await env.DB.prepare("UPDATE orders SET status = 'expired', updated_at = ? WHERE id = ? AND status = 'paying' AND whish_ext = '' RETURNING id").bind(Date.now(), id).first().catch(() => null);
      if (gone) await rollback();
      return json({ error: "Whish isn't answering right now. Try again in a minute, or choose cash on delivery.", field: "pay", whishDown: true }, 502);
    }
  }

  // the shop's iPhones (Kanaan POS on the phone) hear about it at once — after the answer, never delaying it
  // (a Whish order once it is paid: functions/_shared/whish.js)
  if (!whish) {
    const pieces = items.reduce((a, it) => a + it.qty, 0);
    const job = (async () => {
      const w = await env.DB.prepare("SELECT COUNT(*) AS n FROM orders WHERE status IN ('pending','processing')").first().catch(() => null);
      await notifyShop(env, { title: `🛍 New order #${id}`, body: `${name} · ${pieces} ${pieces === 1 ? "piece" : "pieces"} · $${total}${discount ? ` (first order −$${discount})` : ""}${area ? ` · ${area}` : ""}`, tag: `order-${id}`, url: "/pos/#orders", badge: w ? w.n : 1 });
    })();
    if (context.waitUntil) context.waitUntil(job); else await job;
  }

  return json({ ok: true, orderNumber: id, track, subtotal, discount, welcome: welcome ? { pct: welcome.pct, discount } : null, delivery, total, items, phone,
    pay: whish ? "whish" : "cod", ...(whish ? { payUrl: whish.url, until: now + HOLD_MIN * 60000 } : {}) });
}
