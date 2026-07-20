/* CORS middleware — بيشتغل على كل مسار جوا /api/* أوتوماتيكياً.

   ليش لازمنا هالملف: التطبيق (أندرويد/آيفون) عم يحمّل نسخة محلية
   من الموقع محزّمة جواه (عشان يشتغل بلا إنترنت للواجهة نفسها)، فلما
   يطلب بيانات حية من /api/... هو فعلياً عم يطلبها من نطاق مختلف
   (https://localhost الداخلي) عن نطاق السيرفر الحقيقي
   (kanaanshop.com) — والمتصفح/الـ WebView بيرفض الطلب افتراضياً
   لأسباب أمان (CORS) إلا إذا السيرفر صراحة رخّص هيك طلبات.

   هالملف بيرخّص القراءة العامة (منتجات، ستوريز، إرسال طلب، تسجيل
   إشعارات) من أي نطاق. صفحات الأدمن (/api/admin/*) ما بتتأثر عملياً
   لأنها أصلاً معتمدة على كوكي بنفس النطاق، ومش جزء من تطبيق الموبايل. */
export async function onRequest(context) {
  const { request, next } = context;

  // طلب "تمهيدي" (preflight) بيبعتو المتصفح/الـ WebView قبل أي POST
  // فيه Content-Type: application/json — لازم نرد عليه فوراً بلا ما
  // نكمّل لباقي الكود.
  if (request.method === "OPTIONS") {
    return new Response(null, {
      status: 204,
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
        "Access-Control-Allow-Headers": "Content-Type",
        "Access-Control-Max-Age": "86400",
      },
    });
  }

  const response = await next();
  const headers = new Headers(response.headers);
  headers.set("Access-Control-Allow-Origin", "*");
  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers,
  });
}
