import { json } from "../_shared/util.js";
import { loadCategories } from "../_shared/site.js";

/* GET /api/categories — public: the shop's categories and fits (hidden ones left out). */
export async function onRequestGet(context) {
  const cats = await loadCategories(context.env);
  return json({ categories: cats.list.filter((c) => c.active) }, 200, { "Cache-Control": "public, max-age=60" });
}
