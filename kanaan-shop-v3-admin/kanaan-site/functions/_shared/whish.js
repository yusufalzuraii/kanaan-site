/* ============================================================
   WHISH MONEY — paying a website order in the Whish app
   ------------------------------------------------------------
   The shop's merchant keys live in Cloudflare (Pages → the project → Settings → Variables and secrets), never in
   the code or a chat:
     WHISH_CHANNEL, WHISH_SECRET, WHISH_WEBSITE_URL (the website address Whish registered for the shop)
     WHISH_SANDBOX = 1 while trying it with Whish's test account (then removed)
     WHISH_API_URL  only if Whish gives an address other than the usual one
   It shows at checkout only when the keys are there AND the shop switched it on (Kanaan POS → Website → Whish).

   The way an order goes:
     1. checkout → /api/orders { pay: "whish" }: the pieces are held (status 'paying' — not shown to the shop yet),
        a payment for the order's total is made at Whish, and the shopper is sent to Whish's page (their Whish
        number, then the code Whish sends them).
     2. Whish calls /api/whish/callback (with this order's own key in the address) and sends the shopper back to the
        order's page. Neither is believed by itself: the status is asked from Whish with the shop's keys, every time.
     3. paid → the order is 'pending' like any other: the shop sees it ("Paid · Whish") and gets the notification;
        not paid → the shopper tries again or pays cash at the door instead; nothing for 30 minutes → the pieces go
        back (Whish is asked one last time first; a payment that still comes later brings the order back).
   Money that comes in when it shouldn't is never lost and never silent: a payment after the order went to the shop
   as cash (not taken yet: it becomes paid; already accepted or cancelled: 'late', the shop is told not to collect or
   to send it back), a second payment of the same order (whish_extra: the shop is told to send one back), an amount
   that isn't the order's (not counted, the shop is told).
   ============================================================ */

export const HOLD_MIN = 30; // an order not paid in this time lets go of its pieces
const PROD = "https://api.whish.money/itel-service/api";
const SANDBOX = "https://lb.sandbox.whish.money/itel-service/api";
const CHECK_EVERY_MS = 4000; // Whish is asked about one order at most this often (the order page asks every 3 s)
const MAX_TRIES = 6; // payment links one order may have
export const LINK_OPEN_MS = 10 * 60000; // a link younger than this, not failed, is used again (never two open at once)

const yes = (v) => /^(1|true|yes|on)$/i.test(String(v || "").trim());

/** The keys in Cloudflare, or null when any is missing (then Whish is not offered). */
export function whishConfig(env) {
  const channel = String((env && env.WHISH_CHANNEL) || "").trim();
  const secret = String((env && env.WHISH_SECRET) || "").trim();
  const website = String((env && env.WHISH_WEBSITE_URL) || "").trim();
  if (!channel || !secret || !website) return null;
  const sandbox = yes(env.WHISH_SANDBOX);
  const base = String(env.WHISH_API_URL || (sandbox ? SANDBOX : PROD)).trim().replace(/\/+$/, "");
  return { channel, secret, website, sandbox, base };
}

/** Whish at checkout: the keys are in and the shop's switch is on. */
export function whishOn(env, settings) {
  return !!(settings && settings.whish && settings.whish.on && whishConfig(env));
}

export class WhishError extends Error {
  constructor(message, code = "whish", status = 0) { super(message); this.code = code; this.status = status; }
}

/** One call to Whish: { status: true, data } → data; anything else → WhishError (the secret never goes in a message). */
async function call(cfg, path, body, method = "POST", { timeout = 15000 } = {}) {
  let r;
  try {
    r = await fetch(`${cfg.base}${path}`, {
      method,
      headers: { "Content-Type": "application/json", Accept: "application/json", channel: cfg.channel, secret: cfg.secret, websiteurl: cfg.website },
      body: method === "POST" ? JSON.stringify(body || {}) : undefined,
      signal: AbortSignal.timeout(timeout),
    });
  } catch (e) {
    throw new WhishError(e && e.name === "TimeoutError" ? "Whish took too long to answer" : "Whish could not be reached", "offline");
  }
  let d = null;
  try { d = await r.json(); } catch { d = null; }
  if (!r.ok || !d) throw new WhishError(`Whish answered ${r.status}${d && d.dialog && d.dialog.message ? ` · ${String(d.dialog.message).slice(0, 120)}` : ""}`, r.status === 401 || r.status === 403 ? "keys" : "http", r.status);
  if (d.status === false) throw new WhishError(String((d.dialog && d.dialog.message) || d.code || "Whish said no").slice(0, 160), String(d.code || "refused"), r.status);
  return d.data || {};
}

/**
 * A number of our own for each payment (Whish's "externalId"): the order's number × 1000 + its try (counted in the
 * order itself, so it never repeats — not even after a try whose answer was lost). The order must be kept first.
 */
async function nextExternalId(env, orderId) {
  const r = await env.DB.prepare("UPDATE orders SET whish_n = whish_n + 1 WHERE id = ? RETURNING whish_n").bind(orderId).first();
  if (!r) throw new WhishError("The order is not kept", "noorder");
  return Number(orderId) * 1000 + Number(r.whish_n);
}

const origin = (env, request) => String(env.SITE_URL || new URL(request.url).origin).replace(/\/+$/, "");

/**
 * A payment at Whish for this order's total → { url (Whish's page), ext }.
 * order: { id, total, track, payKey }
 */
export async function createPayment(env, request, order) {
  const cfg = whishConfig(env);
  if (!cfg) throw new WhishError("Whish is not set up", "off");
  const ext = await nextExternalId(env, order.id);
  const site = origin(env, request);
  const back = `${site}/api/whish/callback?o=${encodeURIComponent(order.id)}&k=${encodeURIComponent(order.payKey)}&e=${ext}`;
  const page = `${site}/order/${encodeURIComponent(order.id)}?t=${encodeURIComponent(order.track)}`;
  const data = await call(cfg, "/payment/whish", {
    amount: Number(order.total),
    currency: "USD",
    invoice: `Kanaan Shop · order #${order.id}`,
    externalId: ext,
    successCallbackUrl: `${back}&r=ok`,
    failureCallbackUrl: `${back}&r=no`,
    successRedirectUrl: `${page}&w=ok`,
    failureRedirectUrl: `${page}&w=no`,
  });
  const url = String(data.collectUrl || "");
  if (!/^https?:\/\//.test(url)) throw new WhishError("Whish did not give a payment page", "nourl");
  return { url, ext: String(ext) };
}

/** Where one payment stands at Whish: { status: success | failed | pending, payer, amount (when Whish says it) }. */
export async function askStatus(cfg, ext, opts = {}) {
  const data = await call(cfg, "/payment/collect/status", { currency: "USD", externalId: Number(ext) }, "POST", opts);
  const s = String(data.collectStatus || data.status || "").toLowerCase();
  const payer = String(data.payerPhoneNumber || data.phoneNumber || "").replace(/[^\d+]/g, "").slice(0, 20);
  const amount = data.amount !== undefined && data.amount !== null && data.amount !== "" && Number.isFinite(Number(data.amount)) ? Number(data.amount) : null;
  const currency = data.currency ? String(data.currency).toUpperCase() : null;
  return { status: s === "success" ? "success" : s === "failed" ? "failed" : "pending", payer, amount, currency };
}
/** Whish's word on the amount (when it gives one) is the order's total, in dollars. */
const amountOk = (s, row) => (s.amount === null || Math.abs(s.amount - Number(row.total)) < 0.01) && (!s.currency || s.currency === "USD");

/** The keys work (the shop's check button): Whish is asked for the account's balance (the amount is not kept). */
export async function checkKeys(env) {
  const cfg = whishConfig(env);
  if (!cfg) return { ok: false, error: "The Whish keys are not in Cloudflare yet." };
  try {
    await call(cfg, "/payment/account/balance", null, "GET");
    return { ok: true, sandbox: cfg.sandbox };
  } catch (e) {
    return { ok: false, sandbox: cfg.sandbox, error: e.code === "keys" ? "Whish did not accept the keys — check them in Cloudflare." : e.code === "offline" ? "Whish could not be reached — try again in a minute." : e.message };
  }
}

const exts = (row) => String(row.whish_ext || "").split(",").map((s) => s.trim()).filter(Boolean);
/** Until when an order waiting for its payment holds its pieces (30 minutes; a new try gives it 15 more, up to an hour). */
export const holdUntil = (row) => Number(row.pay_until) || (Number(row.created_at) || 0) + HOLD_MIN * 60000;
const fetchRow = (env, id) => env.DB.prepare("SELECT * FROM orders WHERE id = ?").bind(id).first();
const money = (n) => `$${Math.round(Number(n) || 0)}`;
const plus = (p) => (p ? ` from +${String(p).replace(/^\+/, "")}` : "");

/** What the shopper and the shop see about the payment of an order. */
export function payOf(row, now = Date.now()) {
  if (!row) return { method: "cod" };
  // came in after it went to the shop as cash: it counts as paid for the shopper (the shop is told not to collect)
  if (row.pay_status === "late") return { method: "whish", status: "paid", late: true, paidAt: Number(row.paid_at) || 0, payer: String(row.payer || ""), until: 0, url: "", tries: exts(row).length, more: false, now };
  if (row.pay !== "whish") return { method: "cod" };
  const paid = row.pay_status === "paid";
  const status = paid ? "paid" : row.status === "paying" ? (row.pay_status === "failed" ? "failed" : "waiting") : "expired";
  return {
    method: "whish", status, paidAt: Number(row.paid_at) || 0, payer: paid ? String(row.payer || "") : "",
    until: row.status === "paying" ? holdUntil(row) : 0,
    url: status === "waiting" && row.whish_url ? String(row.whish_url) : "",
    tries: exts(row).length, more: exts(row).length < MAX_TRIES, now,
  };
}

/**
 * Ask Whish about this order (all its payment links, newest first) and write down what it says. Asked at most every
 * 4 s per order unless force. Returns the order's row as it is now.
 */
export async function checkPayment(env, row, { force = false, ctx = null, timeout = 15000 } = {}) {
  if (!row || !row.whish_ext || row.pay_status === "paid" || row.pay_status === "late") return row;
  const cfg = whishConfig(env);
  if (!cfg) return row;
  const now = Date.now();
  if (!force && now - (Number(row.whish_checked_at) || 0) < CHECK_EVERY_MS) return row;
  // the look is written first: two pages asking at once make one call
  const won = await env.DB.prepare("UPDATE orders SET whish_checked_at = ? WHERE id = ? AND whish_checked_at = ? RETURNING id")
    .bind(now, row.id, Number(row.whish_checked_at) || 0).first();
  if (!won && !force) return (await fetchRow(env, row.id)) || row;
  let failed = 0; let open = 0; const list = exts(row).reverse();
  for (const ext of list) {
    let s;
    try { s = await askStatus(cfg, ext, { timeout }); } catch { open++; continue; }
    if (s.status === "success") {
      if (amountOk(s, row)) return markPaid(env, row, { payer: s.payer, ext, ctx });
      await flag(env, row, `Whish says ${s.currency || "USD"} ${s.amount} was paid (payment ${ext}), not the order's ${money(row.total)} — not counted; check it in Whish`, ctx);
      continue;
    }
    if (s.status === "failed") failed++; else open++;
  }
  // every link failed (none still open): the shopper is told, and can try again or pay cash — only if no new link
  // was made meanwhile (the list we asked about is still the order's)
  if (list.length && failed === list.length && !open) {
    await env.DB.prepare("UPDATE orders SET pay_status = 'failed' WHERE id = ? AND pay_status = 'waiting' AND whish_ext = ?").bind(row.id, row.whish_ext).run();
  }
  return (await fetchRow(env, row.id)) || row;
}

/**
 * Whish said this payment of the order went through (asked by us). Once per order — whatever happened to the order
 * meanwhile, the money is never lost or silent:
 *   waiting ('paying')                 → paid: a real order for the shop ('pending')
 *   let go after its time ('expired')  → paid and back: its pieces held again where they still are (the others are
 *                                        marked unheld, so nothing else's hold is ever taken), the shop told
 *   switched to cash, not taken yet    → paid with Whish after all (the driver collects nothing)
 *   accepted as cash, or cancelled     → 'late': the shop is told (don't collect / send it back); nothing else moves
 */
export async function markPaid(env, row, { payer = "", ext = "", ctx = null } = {}) {
  const now = Date.now();
  const who = String(payer || "").slice(0, 20);
  for (let i = 0; i < 3; i++) {
    const cur = await fetchRow(env, row.id);
    if (!cur || cur.pay_status === "paid" || cur.pay_status === "late") return cur || row;
    if (cur.status === "paying") {
      const won = await env.DB.prepare(`UPDATE orders SET pay = 'whish', pay_status = 'paid', paid_at = ?, payer = ?, whish_paid_ext = ?, whish_url = '', status = 'pending', updated_at = ?
        WHERE id = ? AND status = 'paying' AND pay_status NOT IN ('paid','late') RETURNING id`).bind(now, who, String(ext), now, cur.id).first();
      if (!won) continue;
      const fresh = await fetchRow(env, cur.id);
      await tellShop(env, fresh, ctx);
      return fresh;
    }
    if (cur.status === "expired" && cur.pay === "whish") {
      let items = []; try { items = JSON.parse(cur.items || "[]"); } catch { items = []; }
      const held = [];
      for (let k = 0; k < items.length; k++) {
        const it = items[k];
        delete it.unheld;
        if (!it.productId || !it.colorKey || !it.size) continue;
        const qty = Math.max(1, Number(it.qty) || 1);
        let ok = null;
        try {
          ok = await env.DB.prepare("UPDATE variants SET reserved = reserved + ? WHERE product_id = ? AND color = ? AND size = ? AND (quantity - reserved) >= ? RETURNING reserved")
            .bind(qty, it.productId, it.colorKey, it.size, qty).first();
        } catch { ok = null; }
        // a piece the site doesn't count (no variant row) needs no hold; one sold meanwhile is marked
        if (ok) held.push(it); else {
          const v = await env.DB.prepare("SELECT 1 FROM variants WHERE product_id = ? AND color = ? AND size = ?").bind(it.productId, it.colorKey, it.size).first().catch(() => null);
          if (v) it.unheld = 1;
        }
      }
      const gone = items.filter((it) => it.unheld).map((it) => `${it.name} ${it.size}`);
      const note = `Paid with Whish after its 30 minutes — the order came back${gone.length ? `; not in stock on the site any more: ${gone.join(", ")}` : ""}`;
      const won = await env.DB.prepare(`UPDATE orders SET pay_status = 'paid', paid_at = ?, payer = ?, whish_paid_ext = ?, whish_url = '', status = 'pending', items = ?, pos_note = ?, updated_at = ?
        WHERE id = ? AND status = 'expired' AND pay = 'whish' AND pay_status NOT IN ('paid','late') RETURNING id`).bind(now, who, String(ext), JSON.stringify(items), note.slice(0, 300), now, cur.id).first();
      if (!won) {
        // changed meanwhile: the holds just made go back
        const { releaseStatements } = await import("./util.js");
        const st = releaseStatements(env, held); if (st.length) await env.DB.batch(st);
        continue;
      }
      const fresh = await fetchRow(env, cur.id);
      await tellShop(env, fresh, ctx);
      return fresh;
    }
    if (cur.pay === "cod" && (cur.status === "pending" || cur.status === "processing")) {
      const won = await env.DB.prepare(`UPDATE orders SET pay = 'whish', pay_status = 'paid', paid_at = ?, payer = ?, whish_paid_ext = ?, pos_note = ?, updated_at = ?
        WHERE id = ? AND pay = 'cod' AND status IN ('pending','processing') AND pay_status NOT IN ('paid','late') RETURNING id`)
        .bind(now, who, String(ext), "Paid with Whish just after choosing cash — the driver collects nothing", now, cur.id).first();
      if (!won) continue;
      const fresh = await fetchRow(env, cur.id);
      await tellShop(env, fresh, ctx, { title: `✅ Order #${cur.id} · paid with Whish after all`, body: `${cur.customer_name} chose cash, then paid ${money(cur.total)} with Whish${plus(who)} — the driver collects nothing` });
      return fresh;
    }
    // already accepted (as cash), cancelled, rejected: the money came in after — the shop decides, it is told now
    const what = cur.status === "confirmed" ? "it was accepted as cash — don't collect at the door (or send it back in Whish)" : `it was ${cur.status} — send it back in Whish`;
    const won = await env.DB.prepare(`UPDATE orders SET pay_status = 'late', paid_at = ?, payer = ?, whish_paid_ext = ?, pos_note = ?, updated_at = ?
      WHERE id = ? AND pay_status NOT IN ('paid','late') AND status = ? RETURNING id`)
      .bind(now, who, String(ext), `A Whish payment of ${money(cur.total)}${plus(who)} came in after ${what}`.slice(0, 300), now, cur.id, cur.status).first();
    if (!won) continue;
    const fresh = await fetchRow(env, cur.id);
    await tellShop(env, fresh, ctx, { title: `⚠️ Order #${cur.id} · a late Whish payment`, body: `${money(cur.total)}${plus(who)} came in after ${what}` });
    return fresh;
  }
  return (await fetchRow(env, row.id)) || row;
}

/** Whish says another link of an order already paid went through too: paid twice — the shop is told to send one back. */
export async function checkSecond(env, row, ext, ctx = null) {
  const cfg = whishConfig(env);
  if (!cfg || !ext || row.whish_extra || String(ext) === String(row.whish_paid_ext) || !exts(row).includes(String(ext))) return row;
  let s; try { s = await askStatus(cfg, ext); } catch { return row; }
  if (s.status !== "success") return row;
  const won = await env.DB.prepare("UPDATE orders SET whish_extra = ?, pos_note = ?, updated_at = ? WHERE id = ? AND whish_extra = '' RETURNING id")
    .bind(String(ext), `Paid twice with Whish (payments ${row.whish_paid_ext} and ${ext}) — send ${money(s.amount !== null ? s.amount : row.total)} back${plus(s.payer)}`.slice(0, 300), Date.now(), row.id).first();
  if (won) await tellShop(env, await fetchRow(env, row.id), ctx, { title: `⚠️ Order #${row.id} · paid twice with Whish`, body: `Send ${money(row.total)} back${plus(s.payer)} in the Whish app` });
  return (await fetchRow(env, row.id)) || row;
}

/** Something about a payment the shop must look at (written on the order, the shop's phones told). */
async function flag(env, row, note, ctx) {
  const won = await env.DB.prepare("UPDATE orders SET pos_note = ?, updated_at = ? WHERE id = ? AND pos_note <> ? RETURNING id").bind(note.slice(0, 300), Date.now(), row.id, note.slice(0, 300)).first().catch(() => null);
  if (won) await tellShop(env, row, ctx, { title: `⚠️ Order #${row.id} · check the Whish payment`, body: note.slice(0, 160) });
}

/** The shop's phones hear about a website order (a cash one when placed, a Whish one once paid), or a payment to check. */
export async function tellShop(env, row, ctx = null, { title = "", body = "" } = {}) {
  const job = (async () => {
    const { notifyShop } = await import("./webpush.js");
    let items = []; try { items = JSON.parse(row.items || "[]"); } catch { items = []; }
    const pieces = items.reduce((a, it) => a + (Number(it.qty) || 0), 0);
    const w = await env.DB.prepare("SELECT COUNT(*) AS n FROM orders WHERE status IN ('pending','processing')").first().catch(() => null);
    const discount = Number(row.discount) || 0;
    const paid = row.pay === "whish" && row.pay_status === "paid";
    await notifyShop(env, {
      title: title || `🛍 New order #${row.id}${paid ? " · paid with Whish" : ""}`,
      body: body || `${row.customer_name} · ${pieces} ${pieces === 1 ? "piece" : "pieces"} · $${row.total}${discount ? ` (first order −$${discount})` : ""}${row.area ? ` · ${row.area}` : ""}`,
      tag: `order-${row.id}${title ? "-pay" : ""}`, url: "/pos/#orders", badge: w ? w.n : 1,
    });
  })().catch(() => {});
  if (ctx && ctx.waitUntil) ctx.waitUntil(job); else await job;
}

/**
 * Orders not paid in their time: Whish is asked one last time, then their pieces go back (status 'expired').
 * At most once a minute (each isolate) and three orders at a time, Whish given 5 s: a slow Whish never slows the shop.
 */
let lastExpire = 0;
export async function expireUnpaid(env, releaseReservation) {
  const now = Date.now();
  const every = env && env.WHISH_EXPIRE_MS !== undefined && env.WHISH_EXPIRE_MS !== "" ? Number(env.WHISH_EXPIRE_MS) : 60000; // (0 in the tests)
  if (now - lastExpire < every) return 0;
  lastExpire = now;
  let rows = [];
  try { rows = (await env.DB.prepare("SELECT * FROM orders WHERE status = 'paying' AND created_at < ? AND (pay_until = 0 OR pay_until < ?) ORDER BY created_at LIMIT 3").bind(now - HOLD_MIN * 60000, now).all()).results || []; } catch { return 0; }
  let n = 0;
  for (const r0 of rows) {
    let r = r0;
    try { r = await checkPayment(env, r0, { force: true, timeout: 5000 }); } catch { r = r0; }
    if (!r || r.pay_status === "paid" || r.status !== "paying") continue;
    // a try made at the last moment gave it more time: not now
    const won = await env.DB.prepare("UPDATE orders SET status = 'expired', whish_url = '', updated_at = ? WHERE id = ? AND status = 'paying' AND pay_status NOT IN ('paid','late') AND (pay_until = 0 OR pay_until < ?) RETURNING id").bind(Date.now(), r.id, Date.now()).first();
    if (!won) continue;
    let items = []; try { items = JSON.parse(r.items || "[]"); } catch { items = []; }
    try { await releaseReservation(env, items); } catch { /* best effort */ }
    n++;
  }
  return n;
}
/** The columns an order needs for Whish (added once, by themselves). */
export const WHISH_COLUMNS = [
  ["pay", "TEXT NOT NULL DEFAULT 'cod'"], ["pay_status", "TEXT NOT NULL DEFAULT ''"], ["pay_key", "TEXT NOT NULL DEFAULT ''"],
  ["whish_ext", "TEXT NOT NULL DEFAULT ''"], ["whish_url", "TEXT NOT NULL DEFAULT ''"], ["whish_paid_ext", "TEXT NOT NULL DEFAULT ''"],
  ["paid_at", "INTEGER NOT NULL DEFAULT 0"], ["payer", "TEXT NOT NULL DEFAULT ''"], ["whish_checked_at", "INTEGER NOT NULL DEFAULT 0"],
  ["pay_until", "INTEGER NOT NULL DEFAULT 0"], ["whish_n", "INTEGER NOT NULL DEFAULT 0"], ["whish_link_at", "INTEGER NOT NULL DEFAULT 0"],
  ["whish_extra", "TEXT NOT NULL DEFAULT ''"], ["whish_mode", "TEXT NOT NULL DEFAULT ''"],
];
export { MAX_TRIES };
