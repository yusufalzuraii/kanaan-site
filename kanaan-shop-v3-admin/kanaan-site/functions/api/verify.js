import { json, rateLimit, tooManyRequests } from "../_shared/util.js";
import { startVerify, verifyStatus, shopNumber, PURPOSES, newSession, sessionCookie, sessionPhone } from "../_shared/members.js";

/* POST /api/verify { purpose: 'login' | 'notify', payload } → { code, token, number, text, url, expiresAt }:
   the page opens WhatsApp with "KANAAN <code>" written to the shop's number (url); the shop computer reads it.
   GET /api/verify?token= → { state: waiting | verified | expired | unknown, masked }; a proven code signs this device
   in to "My Kanaan" (the cookie, 180 days) — the page waiting on it goes on by itself. */
export async function onRequestPost(context) {
  const { request, env } = context;
  const limit = await rateLimit(request, env, "verify", 12, 60 * 60 * 1000);
  if (!limit.allowed) return tooManyRequests(limit.retryAfter, "Too many tries — wait a little and try again.");
  let body = {};
  try { body = await request.json(); } catch { return json({ error: "bad json" }, 400); }
  const purpose = PURPOSES.includes(body.purpose) ? body.purpose : null;
  if (!purpose) return json({ error: "What is it for?" }, 400);
  const payload = body.payload && typeof body.payload === "object" ? body.payload : {};
  const v = await startVerify(env, purpose, { productId: payload.productId, color: payload.color, size: payload.size, name: payload.name });
  const number = await shopNumber(env);
  const text = `KANAAN ${v.code}`;
  return json({ ...v, number, text, url: `https://wa.me/${number}?text=${encodeURIComponent(text)}` });
}

export async function onRequestGet(context) {
  const { request, env } = context;
  const token = new URL(request.url).searchParams.get("token") || "";
  const s = await verifyStatus(env, token);
  // the number is proven either way (a size request too): this device is signed in to "My Kanaan"
  if (s.state === "verified") {
    const already = await sessionPhone(env, request);
    // a session only from a fresh proof (the page that waited for it — not a link kept for later)
    if (already !== s.phone && Date.now() - Number(s.verifiedAt || 0) < 30 * 60000) {
      const t = await newSession(env, s.phone);
      return json({ state: s.state, purpose: s.purpose, masked: s.masked, signedIn: true }, 200, { "Set-Cookie": sessionCookie(t, request) });
    }
    return json({ state: s.state, purpose: s.purpose, masked: s.masked, signedIn: already === s.phone });
  }
  return json({ state: s.state, purpose: s.purpose || null, masked: s.masked || null, expiresAt: s.expiresAt || null });
}
