import { json, releaseExpiredOrders, releaseReservation, rateLimit, tooManyRequests } from "../_shared/util.js";

/* POST /api/orders
   ------------------------------------------------------------
   Called when a customer submits checkout, BEFORE WhatsApp opens.

   Creates a 'pending' order and RESERVES the stock (doesn't deduct it).
   The shop owner then confirms or rejects the order from /admin:
     confirm -> stock is really deducted
     reject  -> reservation released, stock available again
   A pending order that's never confirmed auto-releases after 24h.

   This is what stops the same piece being sold twice, while never
   deducting stock for an order that was never actually completed.
   ============================================================ */

const DELIVERY_FEE = 5;

function orderNumber() {
  // 6 digits — collision-checked against the DB below.
  return String(Math.floor(100000 + Math.random() * 900000));
}

export async function onRequestPost(context) {
  const { request, env } = context;
  if (!env.DB) return json({ error: "Database not configured." }, 500);

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

  const clean = (s, max = 300) => String(s == null ? "" : s).trim().slice(0, max);
  const name = clean(body.name, 120);
  const phone = clean(body.phone, 40);
  const area = clean(body.area, 80);
  const address = clean(body.address, 300);
  const notes = clean(body.notes, 500);
  const rawItems = Array.isArray(body.items) ? body.items : [];

  if (!name || !phone || !address) return json({ error: "Missing customer details." }, 400);
  if (rawItems.length === 0) return json({ error: "Cart is empty." }, 400);

  try { await releaseExpiredOrders(env); } catch { /* non-fatal */ }

  /* Load every product in the cart in ONE query instead of one per line.
     A five-item cart used to mean fifteen sequential round trips to the
     database before WhatsApp even opened; now it's two. */
  const wanted = [];
  for (const raw of rawItems) {
    const productId = clean(raw.productId, 120);
    if (!productId) continue;
    wanted.push({
      productId,
      colorKey: clean(raw.colorKey, 40),
      size: clean(raw.size, 20),
      color: clean(raw.color, 40),
      qty: Math.max(1, Math.min(99, Math.round(Number(raw.qty) || 1))),
    });
  }
  if (wanted.length === 0) return json({ error: "Cart is empty." }, 400);

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
    if (!p || !p.active) return json({ error: "A product in your cart is no longer available." }, 409);
    if (p.sold_out) return json({ error: `${p.name} is sold out.` }, 409);

    const base = Math.round(Number(p.price) || 0);
    const disc = p.badge === "sale" ? Number(p.discount) || 0 : 0;
    const price = disc > 0 ? Math.round(base * (1 - disc / 100)) : base;

    items.push({
      productId: w.productId, name: p.name, colorKey: w.colorKey,
      color: w.color || w.colorKey, size: w.size, qty: w.qty, price,
    });
    subtotal += price * w.qty;
  }

  /* Reserve the stock.
     ------------------------------------------------------------
     This used to read the stock level, compare it, and then write the
     reservation as a separate step. Two shoppers checking out at the
     same moment could both read "1 left", both pass the check, and both
     get the piece — the exact double-sell this whole system exists to
     prevent.

     Now the condition lives inside the UPDATE itself: the row is only
     touched if enough is genuinely still free at that instant. SQLite
     applies it atomically, so of two simultaneous requests exactly one
     can win. RETURNING tells us which. */
  const reserved = [];
  const rollback = async () => {
    if (reserved.length > 0) await releaseReservation(env, reserved);
  };

  for (const it of items) {
    if (!tracked.has(it.productId)) continue; // untracked = unlimited

    const row = await env.DB.prepare(
      `UPDATE variants SET reserved = reserved + ?
       WHERE product_id = ? AND color = ? AND size = ? AND (quantity - reserved) >= ?
       RETURNING quantity, reserved`
    ).bind(it.qty, it.productId, it.colorKey, it.size, it.qty).first();

    if (!row) {
      // Couldn't reserve this line — hand back whatever we already took,
      // so a failed checkout never leaves stock stuck for 24 hours.
      await rollback();

      const current = await env.DB.prepare(
        "SELECT quantity, reserved FROM variants WHERE product_id = ? AND color = ? AND size = ?"
      ).bind(it.productId, it.colorKey, it.size).first();
      const available = current
        ? Math.max(0, (Number(current.quantity) || 0) - (Number(current.reserved) || 0))
        : 0;

      return json({
        error: `Sorry — only ${available} left of ${it.name} (${it.colorKey} / ${it.size}). Please adjust your cart.`,
        productId: it.productId, colorKey: it.colorKey, size: it.size, available,
      }, 409);
    }

    reserved.push(it);
  }

  // Unique order number.
  let id = orderNumber();
  for (let i = 0; i < 5; i++) {
    const hit = await env.DB.prepare("SELECT id FROM orders WHERE id = ?").bind(id).first();
    if (!hit) break;
    id = orderNumber();
  }

  const now = Date.now();
  const total = subtotal + DELIVERY_FEE;

  try {
    await env.DB.prepare(
      `INSERT INTO orders (id, status, customer_name, phone, area, address, notes, items, subtotal, delivery, total, created_at, updated_at)
       VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)`
    ).bind(id, "pending", name, phone, area, address, notes, JSON.stringify(items), subtotal, DELIVERY_FEE, total, now, now).run();
  } catch {
    // Stock was reserved but the order record didn't save — release it
    // rather than leaving pieces held by an order that doesn't exist.
    await rollback();
    return json({ error: "Could not save your order. Please try again." }, 500);
  }

  return json({ ok: true, orderNumber: id, subtotal, delivery: DELIVERY_FEE, total, items });
}
