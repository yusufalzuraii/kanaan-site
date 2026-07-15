import { json, releaseExpiredOrders } from "../_shared/util.js";

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

  // Rebuild every line from the DB — never trust prices sent by the browser.
  const items = [];
  let subtotal = 0;

  for (const raw of rawItems) {
    const productId = clean(raw.productId, 120);
    const colorKey = clean(raw.colorKey, 40);
    const size = clean(raw.size, 20);
    const qty = Math.max(1, Math.min(99, Math.round(Number(raw.qty) || 1)));
    if (!productId) continue;

    const p = await env.DB.prepare(
      "SELECT id, name, price, badge, discount, sold_out, active FROM products WHERE id = ?"
    ).bind(productId).first();

    if (!p || !p.active) return json({ error: "A product in your cart is no longer available." }, 409);
    if (p.sold_out) return json({ error: `${p.name} is sold out.` }, 409);

    const base = Math.round(Number(p.price) || 0);
    const disc = p.badge === "sale" ? Number(p.discount) || 0 : 0;
    const price = disc > 0 ? Math.round(base * (1 - disc / 100)) : base;

    // Stock check — only for products that actually track stock.
    const variant = await env.DB.prepare(
      "SELECT quantity, reserved FROM variants WHERE product_id = ? AND color = ? AND size = ?"
    ).bind(productId, colorKey, size).first();

    const tracked = await env.DB.prepare(
      "SELECT COUNT(*) AS n FROM variants WHERE product_id = ?"
    ).bind(productId).first();

    if (tracked && Number(tracked.n) > 0) {
      const available = variant ? Math.max(0, (Number(variant.quantity) || 0) - (Number(variant.reserved) || 0)) : 0;
      if (available < qty) {
        return json({
          error: `Sorry — only ${available} left of ${p.name} (${colorKey} / ${size}). Please adjust your cart.`,
          productId, colorKey, size, available,
        }, 409);
      }
    }

    items.push({ productId, name: p.name, colorKey, color: clean(raw.color, 40) || colorKey, size, qty, price });
    subtotal += price * qty;
  }

  if (items.length === 0) return json({ error: "Cart is empty." }, 400);

  // Reserve stock for tracked variants.
  for (const it of items) {
    await env.DB.prepare(
      "UPDATE variants SET reserved = reserved + ? WHERE product_id = ? AND color = ? AND size = ?"
    ).bind(it.qty, it.productId, it.colorKey, it.size).run();
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

  await env.DB.prepare(
    `INSERT INTO orders (id, status, customer_name, phone, area, address, notes, items, subtotal, delivery, total, created_at, updated_at)
     VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)`
  ).bind(id, "pending", name, phone, area, address, notes, JSON.stringify(items), subtotal, DELIVERY_FEE, total, now, now).run();

  return json({ ok: true, orderNumber: id, subtotal, delivery: DELIVERY_FEE, total, items });
}
