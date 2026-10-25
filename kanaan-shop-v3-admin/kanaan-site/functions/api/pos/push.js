import { json } from "../../_shared/util.js";
import { guard } from "../../_shared/pos.js";
import { vapidKeys, sendWebPush } from "../../_shared/webpush.js";

/* /api/pos/push — the shop's phones asking for a notification on each website order.
   GET                       { publicKey } (VAPID) to subscribe with
   POST { subscription, user, test? }   keep this phone's subscription (test: send one now)
   DELETE { endpoint }       stop */
export async function onRequestGet(context) {
  const denied = await guard(context); if (denied) return denied;
  return json({ publicKey: (await vapidKeys(context.env)).publicKey });
}
export async function onRequestPost(context) {
  const denied = await guard(context); if (denied) return denied;
  const { env, request, device } = context;
  let body = {};
  try { body = await request.json(); } catch { return json({ error: "bad json" }, 400); }
  const s = body.subscription || {};
  // a real push service (https), or a local one only while the site itself runs locally (tests)
  const local = /^(127\.0\.0\.1|localhost)$/.test(new URL(request.url).hostname);
  const ep = String(s.endpoint || "");
  if (!/^https:\/\/[^/]+\//.test(ep) && !(local && /^http:\/\/127\.0\.0\.1:\d+\//.test(ep))) return json({ error: "No subscription" }, 400);
  if (!s.keys || !s.keys.p256dh || !s.keys.auth) return json({ error: "No subscription keys" }, 400);
  await env.DB.prepare(`INSERT INTO pos_push (endpoint, keys, device_no, user_name, created_at) VALUES (?,?,?,?,?)
      ON CONFLICT(endpoint) DO UPDATE SET keys = excluded.keys, device_no = excluded.device_no, user_name = excluded.user_name, fails = 0`)
    .bind(String(s.endpoint), JSON.stringify({ p256dh: s.keys.p256dh, auth: s.keys.auth }), device.no, String(body.user || "").slice(0, 60), Date.now()).run();
  let test = null;
  if (body.test) test = await sendWebPush(env, s, { title: "Kanaan", body: "Website orders will show up here.", tag: "kanaan-test", url: "/pos/" }).catch((e) => String(e.message || e));
  return json({ ok: true, test });
}
export async function onRequestDelete(context) {
  const denied = await guard(context); if (denied) return denied;
  let body = {};
  try { body = await context.request.json(); } catch { /* ignore */ }
  if (body.endpoint) await context.env.DB.prepare("DELETE FROM pos_push WHERE endpoint = ?").bind(String(body.endpoint)).run();
  return json({ ok: true });
}
