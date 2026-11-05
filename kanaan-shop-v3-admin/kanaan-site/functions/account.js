import { appPage } from "./_shared/spa.js";

/* GET /account — "My Kanaan", a shopper's own orders, purchases and size requests: kept out of search results. */
export const onRequestGet = appPage({ title: "My Kanaan — Kanaan Shop", description: "Your orders and pieces at Kanaan Shop.", path: "/account", noindex: true });
