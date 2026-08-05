import { serveAppShell } from "../_shared/spa.js";

/* GET /admin و /admin/*
   لوحة الإدارة. بترجّع قشرة التطبيق بس — كل التحقق من الهوية بيضل
   عبر /api/admin/session و /api/admin/login زي ما هو بالضبط. */
export const onRequestGet = serveAppShell;
