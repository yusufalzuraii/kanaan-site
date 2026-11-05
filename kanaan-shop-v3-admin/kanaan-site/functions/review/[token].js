import { appPage } from "../_shared/spa.js";

/* GET /review/<token> — a buyer's own review page (the link the shop sends on WhatsApp after an order): drawn by the
   app, kept out of search results, and the link is never passed on to other sites. */
const shell = appPage({ title: "Your review — Kanaan Shop", description: "Tell us how your Kanaan piece fits and feels.", path: "/review", noindex: true });

export async function onRequestGet(context) {
  const res = await shell(context);
  const headers = new Headers(res.headers);
  headers.set("Referrer-Policy", "no-referrer");
  headers.set("Cache-Control", "no-store");
  return new Response(res.body, { status: res.status, headers });
}
