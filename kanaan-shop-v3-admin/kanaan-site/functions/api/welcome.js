import { json, rateLimit, tooManyRequests } from "../_shared/util.js";
import { loadSettings, activeWelcome } from "../_shared/settings.js";
import { parsePhone } from "../_shared/phone.js";
import { orderedBefore } from "../_shared/welcome.js";

/* POST /api/welcome { phone } — at the checkout, once the number is typed: is this a first order (the welcome
   offer is then on it)? Answers only yes / no, and only while the offer is on. Limited, so it can't be used to
   look numbers up. */
export async function onRequestPost(context) {
  const { request, env } = context;
  if (!env.DB) return json({ first: false });
  const limit = await rateLimit(request, env, "welcome", 30, 60 * 60 * 1000);
  if (!limit.allowed) return tooManyRequests(limit.retryAfter, "Too many checks — the offer is worked out when you order.");
  let body = {};
  try { body = await request.json(); } catch { return json({ error: "bad json" }, 400); }
  const w = activeWelcome(await loadSettings(env));
  if (!w) return json({ on: false, first: false });
  const ph = parsePhone(String((body && body.phone) || "").slice(0, 40));
  if (!ph) return json({ on: true, first: false, phone: false });
  return json({ on: true, first: !(await orderedBefore(env, ph)), pct: w.pct, min: w.min, sale: w.sale });
}
