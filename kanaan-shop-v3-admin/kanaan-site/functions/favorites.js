import { appPage } from "./_shared/spa.js";

/* GET /favorites — a shopper's own saved pieces: kept out of search results. */
export const onRequestGet = appPage({ title: "Your favourites — Kanaan Shop", description: "The pieces you saved at Kanaan Shop.", path: "/favorites", noindex: true });
