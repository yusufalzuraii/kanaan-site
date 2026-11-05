import { json } from "../../_shared/util.js";
import { guard } from "../../_shared/pos.js";
import { loadSettings, saveSettings, activeWelcome } from "../../_shared/settings.js";
import { welcomeStats } from "../../_shared/welcome.js";
import { whishConfig, checkKeys } from "../../_shared/whish.js";

/* GET /api/pos/settings — the control room on Kanaan POS (Website → Site) in one call: the site's settings (bar at
   the top, delivery, exchanges, opening hours), the shopper app (its update number, how many phones have it, the
   last notification), the problems shoppers hit, and how the welcome offer (first order) has done.
   PUT /api/pos/settings — { announce?, welcome?, shut?, whish?, deliveryFee?, freeOver?, exchangeDays?, hours?, appVersion? } → the same.
   whish: { keys (in Cloudflare), sandbox, on (live at checkout), paid / waiting counts (30 days) }; { checkWhish: true }
   asks Whish whether it knows the keys (whishCheck: { ok, error }). */
async function room(env) {
  const settings = await loadSettings(env);
  const first = async (sql, ...b) => { try { return await env.DB.prepare(sql).bind(...b).first(); } catch { return null; } };
  const ver = await first("SELECT value FROM app_config WHERE key = 'latest_android_version'");
  const last = await first("SELECT value FROM app_config WHERE key = 'last_push'");
  const devices = await first("SELECT COUNT(*) n FROM push_tokens");
  const problems = await first("SELECT COUNT(*) n, MAX(created_at) last FROM error_logs");
  let lastPush = null; try { lastPush = last ? JSON.parse(last.value) : null; } catch { lastPush = null; }
  const w = settings.welcome;
  const cfg = whishConfig(env);
  const since = Date.now() - 30 * 86400000;
  const wPaid = cfg ? await first("SELECT COUNT(*) n, COALESCE(SUM(total),0) t FROM orders WHERE pay = 'whish' AND pay_status = 'paid' AND created_at >= ?", since) : null;
  const wLost = cfg ? await first("SELECT COUNT(*) n FROM orders WHERE pay = 'whish' AND pay_status <> 'paid' AND status = 'expired' AND created_at >= ?", since) : null;
  return {
    settings,
    whish: { keys: !!cfg, sandbox: !!(cfg && cfg.sandbox), on: !!(cfg && settings.whish && settings.whish.on),
      paid: (wPaid && Number(wPaid.n)) || 0, paidTotal: (wPaid && Number(wPaid.t)) || 0, notPaid: (wLost && Number(wLost.n)) || 0 },
    welcome: { live: !!activeWelcome(settings), ...(await welcomeStats(env, w && w.since)) },
    app: { version: ver ? parseInt(ver.value, 10) || 1 : 1, devices: (devices && Number(devices.n)) || 0, lastPush },
    problems: { n: (problems && Number(problems.n)) || 0, last: (problems && Number(problems.last)) || 0 },
  };
}

export async function onRequestGet(context) {
  const denied = await guard(context); if (denied) return denied;
  return json(await room(context.env));
}

export async function onRequestPut(context) {
  const denied = await guard(context); if (denied) return denied;
  const { request, env } = context;
  let body = {};
  try { body = await request.json(); } catch { return json({ error: "bad json" }, 400); }
  if (!body || typeof body !== "object") return json({ error: "bad json" }, 400);
  const patch = {};
  for (const k of ["announce", "welcome", "shut", "whish", "deliveryFee", "freeOver", "exchangeDays", "hours"]) if (k in body) patch[k] = body[k];
  if (patch.whish && patch.whish.on && !whishConfig(env)) return json({ error: "The Whish keys are not in Cloudflare yet — put them there first (the guide says where)." }, 400);
  if (Object.keys(patch).length) await saveSettings(env, patch);
  if (body.checkWhish) return json({ ...(await room(env)), whishCheck: await checkKeys(env) });
  if ("appVersion" in body) {
    const v = parseInt(body.appVersion, 10);
    if (!v || v < 1 || v > 100000) return json({ error: "The app version is a whole number from 1" }, 400);
    await env.DB.prepare("INSERT INTO app_config (key, value) VALUES ('latest_android_version', ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value").bind(String(v)).run();
  }
  return json(await room(env));
}
