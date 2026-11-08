import { json } from "../../_shared/util.js";
import { guard } from "../../_shared/pos.js";
import { beirutDay, beirutMoment } from "../../_shared/site.js";
import { insightsBetween, insightsLive, insightsVisit, hideBags } from "../../_shared/insight.js";

/* What shoppers do on the site, for Kanaan POS → Website → Visitors (the computer and the phone):
   GET /api/pos/insights?from=YYYY-MM-DD&to=YYYY-MM-DD — the days: visits, time, the way to an order, pieces, sources.
   GET /api/pos/insights?live=1 — right now: who is on the site, the bags, the newest steps.
   GET /api/pos/insights?sid=… — one visit, step by step (and the same visitor's other visits, likes, bag).
   POST /api/pos/insights { hide: [vid…] } | { hide: "all" } | { show: true } — open bags off the shop's list (or back);
   the shoppers keep their bags, a bag changed later shows again. */
export async function onRequestGet(context) {
  const denied = await guard(context); if (denied) return denied;
  const u = new URL(context.request.url);
  const { env } = context;
  if (u.searchParams.get("live")) return json(await insightsLive(env));
  if (u.searchParams.get("sid")) {
    const v = await insightsVisit(env, u.searchParams.get("sid"));
    return v ? json(v) : json({ error: "That visit is not kept any more." }, 404);
  }
  const ok = (d) => /^\d{4}-\d{2}-\d{2}$/.test(d || "");
  const to = ok(u.searchParams.get("to")) ? u.searchParams.get("to") : beirutDay();
  const from = ok(u.searchParams.get("from")) ? u.searchParams.get("from") : to;
  if (from > to) return json({ error: "from is after to" }, 400);
  return json(await insightsBetween(env, from, to, beirutMoment(from, "00:00:00"), beirutMoment(to, "23:59:59") + 999));
}

export async function onRequestPost(context) {
  const denied = await guard(context); if (denied) return denied;
  let body = null; try { body = await context.request.json(); } catch { return json({ error: "bad json" }, 400); }
  if (!body || typeof body !== "object") return json({ error: "Nothing to do" }, 400);
  if (body.show) return json(await hideBags(context.env, { show: true }));
  if (body.hide === "all") return json(await hideBags(context.env, { all: true }));
  if (Array.isArray(body.hide)) return json(await hideBags(context.env, { vids: body.hide }));
  return json({ error: "Nothing to do" }, 400);
}
