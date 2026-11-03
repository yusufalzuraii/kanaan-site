import { appPage } from "./_shared/spa.js";

/* GET /privacy — the privacy page (drawn by the app), with its own title and address. */
export const onRequestGet = appPage({ title: "Privacy — Kanaan Shop", description: "How Kanaan Shop uses the details you give with an order: only to deliver it and to reach you about it.", path: "/privacy" });
