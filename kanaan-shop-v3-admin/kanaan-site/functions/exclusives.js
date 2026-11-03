import { appPage } from "./_shared/spa.js";

/* GET /exclusives — the app's own pieces: kept out of search results (they're only in the app). */
export const onRequestGet = appPage({ title: "App exclusives — Kanaan Shop", description: "Pieces only in the Kanaan Shop app.", path: "/exclusives", noindex: true });
