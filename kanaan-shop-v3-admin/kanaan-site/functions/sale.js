import { appPage } from "./_shared/spa.js";
import { catalogCounts } from "./_shared/seo.js";

/* GET /sale — the pieces on sale (drawn by the app), with its own title and
   address; kept out of search results while nothing is marked down. */
export async function onRequestGet(context) {
  const counts = context.env.DB ? await catalogCounts(context.env) : { onSale: 0 };
  const n = counts.onSale;
  return appPage({
    title: "Sale — Kanaan Shop",
    description: n > 0 ? `${n} menswear ${n === 1 ? "piece" : "pieces"} on sale at Kanaan Shop in Saida, while sizes last. Delivery all over Lebanon, cash on delivery.` : "The Kanaan Shop sale. Delivery all over Lebanon, cash on delivery.",
    path: "/sale",
    noindex: n === 0,
  })(context);
}
