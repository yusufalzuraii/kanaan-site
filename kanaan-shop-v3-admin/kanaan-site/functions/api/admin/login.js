import { json, makeToken, cookieHeader } from "../../_shared/util.js";

// POST /api/admin/login  { password }
export async function onRequestPost(context) {
  const { request, env } = context;
  if (!env.ADMIN_PASSWORD) return json({ error: "Admin password not configured." }, 500);
  let body = {};
  try { body = await request.json(); } catch { /* ignore */ }
  const password = String(body.password || "");
  if (password.length === 0 || password !== env.ADMIN_PASSWORD) {
    return json({ error: "Wrong password." }, 401);
  }
  const token = await makeToken(env.ADMIN_PASSWORD);
  return json({ ok: true }, 200, { "Set-Cookie": cookieHeader(token) });
}
