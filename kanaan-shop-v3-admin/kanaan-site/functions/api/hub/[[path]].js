/* /api/hub/* — Kanaan Cloud: the shop's database shared by the shop computer and the phone (Kanaan POS).
   All the logic is in functions/_shared/hub.js (a copy of kanaan-pos/cloud/hub.mjs — keep them the same). */
import { handle } from "../../_shared/hub.js";

export async function onRequest(context) {
  const { request, env, params } = context;
  const path = Array.isArray(params.path) ? params.path.join("/") : String(params.path || "");
  return handle(request, env, path);
}
