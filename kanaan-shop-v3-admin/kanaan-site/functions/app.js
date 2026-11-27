/* GET /app — one short link for the app: each phone lands in its own store.
   The QR code on the homepage, a post or a printed card can all say
   kanaanshop.com/app. An iPhone, while its app isn't on the App Store yet
   (IOS_APP_ID empty, same as src/components/AppPromo.jsx), lands on the
   app's place on the homepage, which tells it so. */
const ANDROID_ID = "com.kanaanshop.app";
const IOS_APP_ID = "";

export function onRequestGet({ request }) {
  const url = new URL(request.url);
  const ua = request.headers.get("User-Agent") || "";
  const play = `https://play.google.com/store/apps/details?id=${ANDROID_ID}&referrer=${encodeURIComponent("utm_source=kanaanshop.com&utm_medium=link")}`;
  let to = play;
  if (/iPhone|iPad|iPod/i.test(ua)) to = IOS_APP_ID ? `https://apps.apple.com/app/id${IOS_APP_ID}` : `${url.origin}/#app`;
  return new Response(null, { status: 302, headers: { Location: to, "Cache-Control": "no-store", Vary: "User-Agent", "X-Robots-Tag": "noindex" } });
}
