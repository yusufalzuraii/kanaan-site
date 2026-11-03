/* خدمة قشرة التطبيق (index.html) لأي مسار بيتكفّل فيه React.

   ليش هالملف موجود:

   المسارات يلي بتشتغل كلياً بالمتصفح (سلة، أدمن، خصوصية، مفضلة…) ما
   إلها ملفات على القرص — لازم شي يرجّع قشرة index.html وReact بيقرا
   العنوان وبيعرض الصفحة الصح.

   الطريقة المعتادة لهاد هي ملف _redirects. ثبت عملياً على هالمشروع
   إنو _redirects مش منطبق: كل مسار عندو Function اشتغل تمام، وكل
   مسار معتمد على _redirects لحاله فشل ورجّع الصفحة الرئيسية — بلا
   استثناء واحد. سبب هالسلوك إنو وجود مجلد functions/ بيخلي كل
   الطلبات تمر على طبقة الـ Functions أول، وبهالمسار _redirects
   بينتخطى.

   فبدل ما نراهن عليه، منعتمد على الطريقة يلي ثبت إنها شغالة هون:
   Function صريحة لكل مسار. */
import { headTags, setHead } from "./ssr.js";

/* The shell for a page React draws, with that page's own title, address
   and description (so search engines don't take it for a copy of the
   homepage), or kept out of search results altogether (a cart, favourites,
   the owner's previews). */
export function appPage({ title, description, path, noindex = false }) {
  return async function onRequestGet(context) {
    const res = await serveAppShell(context);
    const ct = res.headers.get("Content-Type") || "";
    if (!ct.includes("text/html")) return res;
    const origin = new URL(context.request.url).origin;
    let html = await res.text();
    html = setHead(html, headTags({ title, description, url: noindex ? "" : `${origin}${path}`, noindex }));
    const headers = new Headers(res.headers);
    headers.set("Cache-Control", "public, max-age=0, must-revalidate");
    headers.delete("ETag");
    headers.delete("Last-Modified");
    if (noindex) headers.set("X-Robots-Tag", "noindex, follow");
    return new Response(html, { status: 200, headers });
  };
}

export function serveAppShell(context) {
  const { request, env } = context;
  const url = new URL(request.url);
  url.pathname = "/index.html";
  url.search = "";
  return env.ASSETS.fetch(new Request(url.toString(), { headers: request.headers }));
}
