import { appPage } from "../_shared/spa.js";

/* GET /order/<number>?t=… — a shopper's own order page (from the WhatsApp messages): kept out of search results. */
export async function onRequestGet(context) {
  return appPage({ title: "Your order — Kanaan Shop", description: "Where your Kanaan Shop order is.", path: "/order", noindex: true })(context);
}
