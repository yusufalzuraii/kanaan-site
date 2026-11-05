import { json } from "../_shared/util.js";
import { loadSettings, publicSettings } from "../_shared/settings.js";

/* GET /api/state — is the website shut right now (Kanaan POS → Website → Site → The website)? Light: the shutter asks
   it at the start and every few seconds while it is down, so it rolls up for everyone as soon as the shop opens it. */
export async function onRequestGet({ env }) {
  let shut = null;
  try { shut = publicSettings(await loadSettings(env)).shut; } catch { shut = null; }
  return json({ shut }, 200, { "Cache-Control": "no-store" });
}
