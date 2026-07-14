import { json, isAuthed, clearCookieHeader } from "../../_shared/util.js";

// GET /api/admin/session -> { authed: bool }
export async function onRequestGet(context) {
  const authed = await isAuthed(context.request, context.env);
  return json({ authed });
}

// POST /api/admin/session  (used as logout)
export async function onRequestPost() {
  return json({ ok: true }, 200, { "Set-Cookie": clearCookieHeader() });
}
