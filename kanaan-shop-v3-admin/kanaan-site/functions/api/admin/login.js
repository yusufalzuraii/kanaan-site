import { json, makeToken, cookieHeader, rateLimit, tooManyRequests, safeEqualPublic } from "../../_shared/util.js";

/* POST /api/admin/login  { password }

   Rate limited to 8 attempts per 15 minutes per IP. Without that, the
   admin password could be guessed at unlimited speed — the shop owner
   would never know it was happening, and one correct guess gives full
   control of products, orders and customer details.

   8 is deliberately generous: enough to mistype a few times on a phone
   keyboard, nowhere near enough to brute force anything. */
export async function onRequestPost(context) {
  const { request, env } = context;
  if (!env.ADMIN_PASSWORD) return json({ error: "Admin password not configured." }, 500);

  const limit = await rateLimit(request, env, "login", 8, 15 * 60 * 1000);
  if (!limit.allowed) {
    const mins = Math.ceil(limit.retryAfter / 60);
    return tooManyRequests(
      limit.retryAfter,
      `Too many sign-in attempts. Please wait ${mins} minute${mins === 1 ? "" : "s"} and try again.`
    );
  }

  let body = {};
  try { body = await request.json(); } catch { /* ignore */ }
  const password = String(body.password || "");

  // Constant-time comparison: a plain !== can leak how many leading
  // characters were right through tiny timing differences. The token
  // check already did this properly — now the password does too.
  if (password.length === 0 || !safeEqualPublic(password, env.ADMIN_PASSWORD)) {
    return json({ error: "Wrong password." }, 401);
  }

  const token = await makeToken(env.ADMIN_PASSWORD);
  return json({ ok: true }, 200, { "Set-Cookie": cookieHeader(token) });
}
