import { serveAppShell } from "./_shared/spa.js";

/* GET /privacy — صفحة بيعرضها التطبيق نفسه بالمتصفح. */
export const onRequestGet = serveAppShell;
