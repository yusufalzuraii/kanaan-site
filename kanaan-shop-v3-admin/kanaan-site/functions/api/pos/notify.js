import { json } from "../../_shared/util.js";
import { guard } from "../../_shared/pos.js";
import { sendPushToTokens } from "../../_shared/fcm.js";
import { cleanLink } from "../../_shared/settings.js";

/* POST /api/pos/notify — { title, body, url, after } a notification to everyone with the Kanaan app, one batch at
   a time: a call may only reach out ~50 times on Cloudflare's free plan, so each takes the next 40 phones after
   `after` (the last one done) and answers { sent, failed, removed, total, next } — next = where to go on, or 0
   when everyone had it. Phones whose app is gone are forgotten as it goes. */
const BATCH = 40;

export async function onRequestPost(context) {
  const denied = await guard(context); if (denied) return denied;
  const { request, env } = context;
  let body = {};
  try { body = await request.json(); } catch { return json({ error: "bad json" }, 400); }
  const title = String(body.title || "").trim().slice(0, 120);
  const message = String(body.body || "").trim().slice(0, 300);
  const url = cleanLink(body.url) || null;
  if (!title || !message) return json({ error: "Write a title and a message" }, 400);
  if (!env.FCM_SERVICE_ACCOUNT_JSON) return json({ error: "Notifications to the app aren't set up on the website (Firebase key missing)" }, 503);
  const after = Math.max(0, Math.round(Number(body.after) || 0));
  const total = ((await env.DB.prepare("SELECT COUNT(*) n FROM push_tokens").first()) || {}).n || 0;
  const { results } = await env.DB.prepare("SELECT rowid AS rid, token FROM push_tokens WHERE rowid > ? ORDER BY rowid LIMIT ?").bind(after, BATCH).all();
  const rows = results || [];
  if (!rows.length) return json({ ok: true, sent: 0, failed: 0, removed: 0, total, next: 0 });
  let r;
  try { r = await sendPushToTokens(env, rows.map((x) => x.token), { title, body: message, url }); } catch (e) { return json({ error: String((e && e.message) || e) }, 502); }
  if (r.invalidTokens.length) await env.DB.batch(r.invalidTokens.map((t) => env.DB.prepare("DELETE FROM push_tokens WHERE token = ?").bind(t)));
  const next = rows.length === BATCH ? rows[rows.length - 1].rid : 0;
  // what the control room shows as "the last one" (sums the batches of the same message)
  try {
    const prev = await env.DB.prepare("SELECT value FROM app_config WHERE key = 'last_push'").first();
    let last = null; try { last = prev ? JSON.parse(prev.value) : null; } catch { last = null; }
    const same = after > 0 && last && last.title === title;
    const rec = { title, body: message, url, at: same ? last.at : Date.now(), sent: (same ? last.sent : 0) + r.sent, by: context.device ? context.device.name : "" };
    await env.DB.prepare("INSERT INTO app_config (key, value) VALUES ('last_push', ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value").bind(JSON.stringify(rec)).run();
  } catch { /* the count is a nicety */ }
  return json({ ok: true, sent: r.sent, failed: r.failed, removed: r.invalidTokens.length, total, next });
}
