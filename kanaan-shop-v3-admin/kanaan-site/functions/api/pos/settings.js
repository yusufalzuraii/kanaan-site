import { json } from "../../_shared/util.js";
import { guard } from "../../_shared/pos.js";
import { loadSettings, saveSettings } from "../../_shared/settings.js";

/* GET /api/pos/settings — the control room on Kanaan POS (Website → Site) in one call: the site's settings (bar at
   the top, delivery, exchanges, opening hours), the shopper app (its update number, how many phones have it, the
   last notification) and the problems shoppers hit.
   PUT /api/pos/settings — { announce?, deliveryFee?, freeOver?, exchangeDays?, hours?, appVersion? } → the same. */
async function room(env) {
  const settings = await loadSettings(env);
  const first = async (sql, ...b) => { try { return await env.DB.prepare(sql).bind(...b).first(); } catch { return null; } };
  const ver = await first("SELECT value FROM app_config WHERE key = 'latest_android_version'");
  const last = await first("SELECT value FROM app_config WHERE key = 'last_push'");
  const devices = await first("SELECT COUNT(*) n FROM push_tokens");
  const problems = await first("SELECT COUNT(*) n, MAX(created_at) last FROM error_logs");
  let lastPush = null; try { lastPush = last ? JSON.parse(last.value) : null; } catch { lastPush = null; }
  return {
    settings,
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
  for (const k of ["announce", "deliveryFee", "freeOver", "exchangeDays", "hours"]) if (k in body) patch[k] = body[k];
  if (Object.keys(patch).length) await saveSettings(env, patch);
  if ("appVersion" in body) {
    const v = parseInt(body.appVersion, 10);
    if (!v || v < 1 || v > 100000) return json({ error: "The app version is a whole number from 1" }, 400);
    await env.DB.prepare("INSERT INTO app_config (key, value) VALUES ('latest_android_version', ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value").bind(String(v)).run();
  }
  return json(await room(env));
}
