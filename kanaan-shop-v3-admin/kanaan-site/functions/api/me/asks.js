import { json, rateLimit, tooManyRequests } from "../../_shared/util.js";
import { sessionPhone, addAsk, ensureMembers } from "../../_shared/members.js";

/* POST /api/me/asks { productId, color, size } — a signed-in shopper asks to be told when a size is back (no code:
   the number is already proven). DELETE /api/me/asks?id= — not any more. Others go through /api/verify (notify). */
export async function onRequestPost(context) {
  const { request, env } = context;
  const limit = await rateLimit(request, env, "asks", 30, 60 * 60 * 1000);
  if (!limit.allowed) return tooManyRequests(limit.retryAfter);
  const phone = await sessionPhone(env, request);
  if (!phone) return json({ error: "Sign in first", signIn: true }, 401);
  let body = {}; try { body = await request.json(); } catch { return json({ error: "bad json" }, 400); }
  const r = await addAsk(env, phone, body);
  if (!r.ask) return json({ error: "That piece isn't on the site" }, 404);
  return json({ ok: true, ...r });
}
export async function onRequestDelete(context) {
  const { request, env } = context;
  await ensureMembers(env);
  const phone = await sessionPhone(env, request);
  if (!phone) return json({ error: "Sign in first" }, 401);
  const id = new URL(request.url).searchParams.get("id") || "";
  await env.DB.prepare("UPDATE restock_asks SET cancelled_at = ? WHERE id = ? AND phone = ?").bind(Date.now(), id, phone).run();
  return json({ ok: true });
}
