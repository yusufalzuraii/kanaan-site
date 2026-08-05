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
export function serveAppShell(context) {
  const { request, env } = context;
  const url = new URL(request.url);
  url.pathname = "/index.html";
  url.search = "";
  return env.ASSETS.fetch(new Request(url.toString(), { headers: request.headers }));
}
