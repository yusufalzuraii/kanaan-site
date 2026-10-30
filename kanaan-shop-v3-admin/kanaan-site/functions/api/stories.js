import { json } from "../_shared/util.js";

/* GET /api/stories
   ------------------------------------------------------------
   "The Edit" (the story rail on the homepage) was retired on
   30 October 2026 at the owner's request: the homepage is now the
   drawn shop, walked section by section, with the pieces on hang tags.

   The website no longer asks for stories. This answer stays for the
   apps already installed on phones, which still ask: an empty list
   makes them hide the rail. The old slides are kept in the database
   (the `stories` table), untouched, in case they're ever wanted back. */
export async function onRequestGet() {
  return json({ rings: [] }, 200, { "Cache-Control": "public, max-age=300" });
}
