import { json } from "../../_shared/util.js";
import { guard } from "../../_shared/pos.js";
import { photoOf, ordersOfPhone } from "../../_shared/members.js";
import { parsePhone } from "../../_shared/phone.js";

/* The shoppers who proved their number on the site ("My Kanaan"), for the shop's program — it finds each one's
   customer file by the number.
   GET /api/pos/accounts?since=<ms>  accounts made or changed since: { accounts: [{ phone, pretty, name, since,
                                     lastSeen, likes: [{ id, name, image }], bag: [{ productId, name, colorKey, size,
                                     qty, image }], cardAt }], now }
   GET /api/pos/accounts?phone=<digits>  one customer: { account | null, asks, orders: { count, confirmedTotal, last } }
   POST /api/pos/accounts { cards: [{ phone, card }] }   what the customer's file says (since, visits, the pieces
                                     they bought at the shop) — shown on their "My Kanaan" page. card null = no file. */
export async function onRequestGet(context) {
  const denied = await guard(context); if (denied) return denied;
  const { request, env } = context;
  const u = new URL(request.url);
  const one = String(u.searchParams.get("phone") || "").replace(/\D/g, "");
  const since = Math.max(0, Number(u.searchParams.get("since")) || 0);
  const rows = one
    ? (await env.DB.prepare("SELECT * FROM site_accounts WHERE phone = ?").bind(one).all()).results || []
    : (await env.DB.prepare("SELECT * FROM site_accounts WHERE updated_at > ? OR created_at > ? OR last_seen > ? ORDER BY created_at ASC LIMIT 500")
      .bind(since, since, since).all()).results || [];
  const parse = (s) => { try { const v = JSON.parse(s || "[]"); return Array.isArray(v) ? v : []; } catch { return []; } };
  const ids = new Set();
  for (const r of rows) { for (const id of parse(r.likes)) ids.add(String(id)); for (const b of parse(r.bag)) ids.add(String(b.productId)); }
  const info = new Map();
  const list = [...ids];
  for (let i = 0; i < list.length; i += 40) {
    const part = list.slice(i, i + 40);
    for (const p of (await env.DB.prepare(`SELECT id, name, images, pos_model FROM products WHERE id IN (${part.map(() => "?").join(",")})`).bind(...part).all()).results || []) info.set(p.id, p);
  }
  const accounts = rows.map((r) => {
    const ph = parsePhone(`+${r.phone}`);
    return {
      phone: r.phone, pretty: ph ? ph.pretty : `+${r.phone}`, name: r.name || "", since: r.created_at, lastSeen: r.last_seen, cardAt: r.card_at || 0,
      likes: parse(r.likes).filter((id) => info.has(id)).map((id) => { const p = info.get(id); return { id, name: p.name, posModel: p.pos_model || "", image: photoOf(p.images, "") }; }),
      bag: parse(r.bag).filter((b) => info.has(b.productId)).map((b) => { const p = info.get(b.productId); return { productId: b.productId, name: p.name, posModel: p.pos_model || "", colorKey: b.colorKey, size: b.size, qty: b.qty, image: photoOf(p.images, b.colorKey) }; }),
    };
  });
  if (one) {
    // one customer (their file in the program): the account (or none), the sizes they wait for, their orders on the site
    const asks = ((await env.DB.prepare(`SELECT a.id, a.product_id, a.color, a.size, a.created_at, a.notified_at, p.name, p.images, p.pos_model FROM restock_asks a
      LEFT JOIN products p ON p.id = a.product_id WHERE a.phone = ? AND a.cancelled_at = 0 ORDER BY a.created_at DESC LIMIT 20`).bind(one).all()).results || [])
      .map((a) => ({ id: a.id, productId: a.product_id, posModel: a.pos_model || "", name: a.name || a.product_id, colorKey: a.color, size: a.size, at: a.created_at, told: a.notified_at || 0, image: photoOf(a.images, a.color) }));
    const q = ordersOfPhone(one);
    const o = await env.DB.prepare(`SELECT COUNT(*) AS n, SUM(CASE WHEN status = 'confirmed' THEN total ELSE 0 END) AS spent, MAX(created_at) AS last FROM orders WHERE ${q.where}`).bind(...q.binds).first();
    return json({ account: accounts[0] || null, asks, orders: { count: Number(o && o.n) || 0, confirmedTotal: Number(o && o.spent) || 0, last: Number(o && o.last) || 0 } });
  }
  return json({ accounts, now: Date.now() });
}

export async function onRequestPost(context) {
  const denied = await guard(context); if (denied) return denied;
  const { request, env } = context;
  let body = {}; try { body = await request.json(); } catch { return json({ error: "bad json" }, 400); }
  const now = Date.now();
  const cards = (Array.isArray(body.cards) ? body.cards : []).slice(0, 100).filter((c) => c && c.phone);
  const st = cards.map((c) => env.DB.prepare("UPDATE site_accounts SET card = ?, card_at = ? WHERE phone = ?")
    .bind(c.card ? JSON.stringify(c.card).slice(0, 8000) : "", now, String(c.phone).replace(/\D/g, "")));
  if (st.length) await env.DB.batch(st);
  return json({ ok: true, cards: cards.length });
}
