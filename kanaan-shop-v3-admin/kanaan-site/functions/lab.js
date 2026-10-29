import { serveAppShell } from "./_shared/spa.js";

/* GET /lab — the new homepage directions under trial (see src/home/HomeLab.jsx).
   Served like any other page the app draws itself, but kept out of search
   results: it's a preview for the shop owner, not a page for Google. */
export async function onRequestGet(context) {
  const res = await serveAppShell(context);
  const out = new Response(res.body, res);
  out.headers.set("X-Robots-Tag", "noindex, nofollow");
  out.headers.set("Cache-Control", "no-cache");
  return out;
}
