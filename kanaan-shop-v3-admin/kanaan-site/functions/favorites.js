import { serveAppShell } from "./_shared/spa.js";

/* GET /favorites — صفحة بيعرضها التطبيق نفسه بالمتصفح. */
export const onRequestGet = serveAppShell;
