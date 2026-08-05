import { serveAppShell } from "./_shared/spa.js";

/* GET /sale — صفحة بيعرضها التطبيق نفسه بالمتصفح. */
export const onRequestGet = serveAppShell;
