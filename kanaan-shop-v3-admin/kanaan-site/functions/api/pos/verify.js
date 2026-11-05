import { json } from "../../_shared/util.js";
import { guard } from "../../_shared/pos.js";
import { confirmVerify, ensureMembers } from "../../_shared/members.js";

/* POST /api/pos/verify { code, phone } — the shop computer's WhatsApp read "KANAAN <code>" from that number:
   { ok, purpose, payload, phone, pretty, ask? } (ask = the size request it made). Also { number } alone: the number
   linked to the shop's WhatsApp, so the site sends the codes there. */
export async function onRequestPost(context) {
  const denied = await guard(context); if (denied) return denied;
  const { request, env } = context;
  let body = {};
  try { body = await request.json(); } catch { return json({ error: "bad json" }, 400); }
  await ensureMembers(env);
  if (body.number && !body.code) {
    const d = String(body.number).replace(/\D/g, "");
    if (d.length < 8) return json({ error: "bad number" }, 400);
    await env.DB.prepare("INSERT INTO pos_state (key, value) VALUES ('wa_number', ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value").bind(d).run();
    return json({ ok: true, number: d });
  }
  return json(await confirmVerify(env, body.code, body.phone));
}
