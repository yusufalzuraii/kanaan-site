import { json } from "../../_shared/util.js";
import { guard } from "../../_shared/pos.js";
import { FACES, ROLES } from "../../_shared/faces.js";

/* GET /api/pos/faces — the team's portraits for the shop's devices (Kanaan POS sign-in). Private: a connected
   device only (the same check as every /api/pos call), and never cached by a browser or a proxy. */
export async function onRequestGet(context) {
  const denied = await guard(context); if (denied) return denied;
  return json({ faces: FACES, roles: ROLES }, 200, { "Cache-Control": "private, no-store" });
}
