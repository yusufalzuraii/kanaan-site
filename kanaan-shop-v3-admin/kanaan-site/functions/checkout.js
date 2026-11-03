import { appPage } from "./_shared/spa.js";

/* GET /checkout — a shopper's own order: kept out of search results. */
export const onRequestGet = appPage({ title: "Checkout — Kanaan Shop", description: "Your order at Kanaan Shop: delivery all over Lebanon, cash on delivery.", path: "/checkout", noindex: true });
