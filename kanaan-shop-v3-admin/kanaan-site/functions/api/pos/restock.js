import { json } from "../../_shared/util.js";
import { guard } from "../../_shared/pos.js";
import { photoOf } from "../../_shared/members.js";
import { parsePhone } from "../../_shared/phone.js";

/* "Tell me when my size is back" for the shop's program.
   GET /api/pos/restock            every request still waiting: { asks: [{ id, productId, posModel, name, colorKey,
                                   colorLabel, size, phone, pretty, at, image, ready }] } — ready = that size is on the
                                   site again now (the shop's stock reached it), so the computer's WhatsApp can tell them.
   POST /api/pos/restock { told: [ids] }      they were told (each once).
   POST /api/pos/restock { cancel: [ids] }    the shop took them off the list. */
export async function onRequestGet(context) {
  const denied = await guard(context); if (denied) return denied;
  const { env } = context;
  const rows = (await env.DB.prepare(`SELECT a.*, p.name, p.images, p.pos_model, p.colors, p.active,
      (SELECT MAX(v.quantity - v.reserved) FROM variants v WHERE v.product_id = a.product_id AND v.color = a.color AND v.size = a.size) AS free,
      (SELECT COUNT(*) FROM variants v WHERE v.product_id = a.product_id) AS tracked
    FROM restock_asks a LEFT JOIN products p ON p.id = a.product_id
    WHERE a.notified_at = 0 AND a.cancelled_at = 0 ORDER BY a.created_at ASC LIMIT 500`).all()).results || [];
  const asks = rows.map((r) => {
    const ph = parsePhone(`+${r.phone}`);
    return { id: r.id, productId: r.product_id, posModel: r.pos_model || "", name: r.name || r.product_id, colorKey: r.color, size: r.size,
      phone: r.phone, pretty: ph ? ph.pretty : `+${r.phone}`, at: r.created_at, image: photoOf(r.images, r.color),
      ready: !!r.active && Number(r.tracked) > 0 && Number(r.free) > 0, gone: !r.name || !r.active };
  });
  return json({ asks, now: Date.now() });
}

export async function onRequestPost(context) {
  const denied = await guard(context); if (denied) return denied;
  const { request, env } = context;
  let body = {}; try { body = await request.json(); } catch { return json({ error: "bad json" }, 400); }
  const now = Date.now();
  const told = (Array.isArray(body.told) ? body.told : []).map(String).slice(0, 100);
  const cancel = (Array.isArray(body.cancel) ? body.cancel : []).map(String).slice(0, 100);
  const st = [
    ...told.map((id) => env.DB.prepare("UPDATE restock_asks SET notified_at = ? WHERE id = ? AND notified_at = 0").bind(now, id)),
    ...cancel.map((id) => env.DB.prepare("UPDATE restock_asks SET cancelled_at = ? WHERE id = ? AND cancelled_at = 0").bind(now, id)),
  ];
  if (st.length) await env.DB.batch(st);
  return json({ ok: true, told: told.length, cancelled: cancel.length });
}
