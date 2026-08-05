import { serveAppShell } from "./_shared/spa.js";

/* GET /checkout — صفحة بيعرضها التطبيق نفسه بالمتصفح. */
export const onRequestGet = serveAppShell;
