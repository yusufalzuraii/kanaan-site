import { json } from "../../_shared/util.js";
import { guard } from "../../_shared/pos.js";
import { notifyShop } from "../../_shared/webpush.js";

/* POST /api/pos/alert { title, body, url?, tag? } — a notification to the shop's own phones (Kanaan POS on the phone),
   from the shop's program: a model down to its last piece, … (the same phones that hear about website orders). */
export async function onRequestPost(context) {
  const denied = await guard(context); if (denied) return denied;
  const { env, request } = context;
  let b = {};
  try { b = await request.json(); } catch { return json({ error: "bad json" }, 400); }
  const title = String(b.title || "").replace(/\s+/g, " ").trim().slice(0, 80);
  const body = String(b.body || "").replace(/\s+/g, " ").trim().slice(0, 200);
  if (!title) return json({ error: "Write a title" }, 400);
  // a page of the phone app (its #page), nothing else
  const url = /^\/pos\/[A-Za-z0-9\-._~/?=&%#]*$/.test(String(b.url || "")) ? String(b.url) : "/pos/";
  const tag = String(b.tag || "").replace(/[^\w-]/g, "").slice(0, 60) || `kanaan-${Date.now()}`;
  const phones = await env.DB.prepare("SELECT COUNT(*) AS n FROM pos_push").first().catch(() => null);
  const job = notifyShop(env, { title, body, url, tag });
  if (context.waitUntil) context.waitUntil(job); else await job;
  return json({ ok: true, phones: (phones && Number(phones.n)) || 0 });
}
