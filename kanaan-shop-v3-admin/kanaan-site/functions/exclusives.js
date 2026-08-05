import { serveAppShell } from "./_shared/spa.js";

/* GET /exclusives — صفحة بيعرضها التطبيق نفسه بالمتصفح. */
export const onRequestGet = serveAppShell;
