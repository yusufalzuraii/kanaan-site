/* ============================================================
   NATIVE.JS — كل شي خاص بنسخة التطبيق (Capacitor) بمكان واحد.

   الفكرة: الموقع وتطبيق أندرويد/آيفون بيشغّلوا نفس الكود بالضبط.
   هاد الملف هو "الفرع" الوحيد يلي بيفرّق سلوك التطبيق عن سلوك
   الموقع — أي ميزة حصرية للتطبيق (اهتزاز، زر الرجوع، شريط الحالة،
   حفظ بيانات التوصيل...) بتمر من هون، بمكان واحد، بدل ما تكون
   متفرقة بكل الملف. لو يوماً حبينا نلغي ميزة حصرية أو نضيفها
   للموقع كمان، هاد أول وآخر مكان لازم نلمسه.
   ============================================================ */
import { Capacitor } from "@capacitor/core";

// true بس جوا تطبيق أندرويد/آيفون المبني، false على أي متصفح
// (بما فيه لما تفتح نفس الموقع من متصفح الموبايل نفسه)
export const isNativeApp = Capacitor.isNativePlatform();

/* ----------------------------------------------------------
   اهتزاز خفيف (Haptics) — بلحظات محددة بس، مش بكل ضغطة، حتى يضل
   له معنى ("إشارة نجاح") بدل ما يصير إزعاج.
   ---------------------------------------------------------- */
let hapticsModule = null;
async function getHaptics() {
  if (!isNativeApp) return null;
  if (!hapticsModule) {
    hapticsModule = await import("@capacitor/haptics");
  }
  return hapticsModule;
}

// اهتزاز خفيف لطيف — لإضافة للسلة، اختيار مقاس/لون، toggle المفضلة
export async function hapticLight() {
  const mod = await getHaptics();
  if (!mod) return;
  try {
    await mod.Haptics.impact({ style: mod.ImpactStyle.Light });
  } catch { /* الجهاز ما بيدعم اهتزاز، تجاهل بهدوء */ }
}

// اهتزاز "نجاح" أوضح شوي — لتأكيد إرسال الطلب
export async function hapticSuccess() {
  const mod = await getHaptics();
  if (!mod) return;
  try {
    await mod.Haptics.notification({ type: mod.NotificationType.Success });
  } catch { /* تجاهل */ }
}

/* ----------------------------------------------------------
   زر الرجوع الفيزيائي بأندرويد — لازم يرجع بالراوتر الداخلي
   (متل ضغطة "رجوع" بالمتصفح) قبل ما يفكر يقفل التطبيق. بيتوصل
   بالـ App.jsx عبر registerBackButtonHandler(canGoBack, onBack).
   ---------------------------------------------------------- */
export async function registerBackButtonHandler({ canGoBack, onBackWithinApp, onExitApp }) {
  if (!isNativeApp) return () => {};
  const { App } = await import("@capacitor/app");

  const sub = await App.addListener("backButton", () => {
    if (canGoBack()) {
      onBackWithinApp();
    } else {
      onExitApp();
    }
  });

  return () => sub.remove();
}

/* ----------------------------------------------------------
   شريط الحالة (Status bar) — لونو يتبع الثيم الحالي بدل ما يضل
   افتراضي رمادي/أسود ثابت مهما تغيّر الثيم.
   ---------------------------------------------------------- */
export async function syncStatusBar(theme) {
  if (!isNativeApp) return;
  try {
    const { StatusBar, Style } = await import("@capacitor/status-bar");
    await StatusBar.setStyle({ style: theme === "dark" ? Style.Dark : Style.Light });
    await StatusBar.setBackgroundColor({ color: theme === "dark" ? "#0B0B0E" : "#F2F2F4" });
  } catch { /* بعض أجهزة الأندرويد ما بتدعم لون status bar، تجاهل */ }
}

/* ----------------------------------------------------------
   إخفاء شاشة الـ splash بعد ما التطبيق يصير جاهز فعلياً (مش بعد
   وقت ثابت) — هيك ما في "ومضة" شاشة بيضا بين الـ splash والمحتوى.
   ---------------------------------------------------------- */
export async function hideSplashScreen() {
  if (!isNativeApp) return;
  try {
    const { SplashScreen } = await import("@capacitor/splash-screen");
    await SplashScreen.hide();
  } catch { /* تجاهل */ }
}

/* ----------------------------------------------------------
   مشاركة نيتف حقيقية (بدل نافذة واتساب/نسخ الرابط المستخدمة
   بالموقع) — بتفتح قائمة المشاركة الأصلية لأندرويد.
   ---------------------------------------------------------- */
export async function nativeShare({ title, text, url }) {
  if (!isNativeApp) return false;
  try {
    const { Share } = await import("@capacitor/share");
    await Share.share({ title, text, url, dialogTitle: title });
    return true;
  } catch {
    return false; // المستخدم لغى المشاركة أو صار خطأ — نرجع false ليستخدموا fallback الموقع
  }
}

/* ----------------------------------------------------------
   حفظ بيانات التوصيل تلقائياً — ميزة حصرية للتطبيق (زي ما اتفقنا):
   بالموقع بيضل المستخدم يكتب اسمو وهاتفو وعنوانو من جديد كل مرة،
   بالتطبيق بتنحفظ محلياً وتنعبّى تلقائياً بالمرة الجاية.
   ---------------------------------------------------------- */
const CHECKOUT_INFO_KEY = "kanaan-checkout-info";

export function saveCheckoutInfo(form) {
  if (!isNativeApp) return;
  try {
    // ما بنخزن الملاحظات (notes) — غالباً خاصة بطلب معيّن، مش بيانات ثابتة عن الزبون
    const { notes, ...persistent } = form;
    localStorage.setItem(CHECKOUT_INFO_KEY, JSON.stringify(persistent));
  } catch { /* تجاهل */ }
}

export function loadCheckoutInfo() {
  if (!isNativeApp) return null;
  try {
    const saved = localStorage.getItem(CHECKOUT_INFO_KEY);
    return saved ? JSON.parse(saved) : null;
  } catch {
    return null;
  }
}

/* ----------------------------------------------------------
   "شفتها مؤخراً" — تخصيص حقيقي حصري للتطبيق. كل ما المستخدم يفتح
   صفحة منتج، بنسجّل الـ id، وبنعرض آخر 10 بالهوم. أحدث منتج
   بيصير الأول (بنشيلو إذا كان موجود قبل، وبنحطو بأول القائمة).
   ---------------------------------------------------------- */
const RECENTLY_VIEWED_KEY = "kanaan-recently-viewed";
const RECENTLY_VIEWED_MAX = 10;

export function addRecentlyViewed(productId) {
  if (!isNativeApp || !productId) return;
  try {
    const list = getRecentlyViewed().filter((id) => id !== productId);
    list.unshift(productId);
    localStorage.setItem(RECENTLY_VIEWED_KEY, JSON.stringify(list.slice(0, RECENTLY_VIEWED_MAX)));
  } catch { /* تجاهل */ }
}

export function getRecentlyViewed() {
  if (!isNativeApp) return [];
  try {
    const saved = localStorage.getItem(RECENTLY_VIEWED_KEY);
    const list = saved ? JSON.parse(saved) : [];
    return Array.isArray(list) ? list : [];
  } catch {
    return [];
  }
}

/* ----------------------------------------------------------
   سحب من حافة الشاشة للرجوع (edge-swipe back) — زي آيفون وأغلب
   تطبيقات أندرويد الاحترافية. بنتتبع بس اللمسات يلي بتبلش قريبة
   جداً من الحافة اليسرى (أول ~24px)، وإذا انسحبت لليمين مسافة
   كافية بسرعة معقولة، منعتبرها "رجوع" ومنستدعي onTrigger().
   ---------------------------------------------------------- */
export function registerEdgeSwipeBack(onTrigger) {
  if (!isNativeApp) return () => {};

  const EDGE_ZONE = 24; // px من الحافة اليسرى يلي فيها اللمسة لازم تبلش
  const THRESHOLD = 80; // px أقل مسافة سحب حتى تعتبر "رجوع"
  let startX = null;
  let startY = null;
  let tracking = false;

  const onStart = (e) => {
    const t = e.touches[0];
    if (t.clientX <= EDGE_ZONE) {
      startX = t.clientX;
      startY = t.clientY;
      tracking = true;
    } else {
      tracking = false;
    }
  };

  const onMove = (e) => {
    if (!tracking || startX == null) return;
    const t = e.touches[0];
    const dx = t.clientX - startX;
    const dy = Math.abs(t.clientY - startY);
    // سحب أفقي واضح بمسافة كافية، وحركة رأسية محدودة (مش سكرول عمودي)
    if (dx > THRESHOLD && dy < 60) {
      tracking = false;
      startX = null;
      onTrigger();
    }
  };

  const onEnd = () => {
    tracking = false;
    startX = null;
  };

  window.addEventListener("touchstart", onStart, { passive: true });
  window.addEventListener("touchmove", onMove, { passive: true });
  window.addEventListener("touchend", onEnd, { passive: true });

  return () => {
    window.removeEventListener("touchstart", onStart);
    window.removeEventListener("touchmove", onMove);
    window.removeEventListener("touchend", onEnd);
  };
}

/* ----------------------------------------------------------
   إشعارات Push — طلب الإذن، تسجيل توكن الجهاز عند سيرفرنا، والتعامل
   مع ضغطة المستخدم على إشعار (بيفتح رابط معيّن إذا كان مرفق فيه).
   بيستدعى مرة وحدة لما التطبيق يفتح — إذا المستخدم رفض الإذن أو
   الجهاز ما بيدعم، بنسكت ونكمل عادي، الإشعارات مش وظيفة أساسية.
   ---------------------------------------------------------- */
export async function registerPushNotifications(apiBaseUrl) {
  if (!isNativeApp) return;
  try {
    const { PushNotifications } = await import("@capacitor/push-notifications");

    let perm = await PushNotifications.checkPermissions();
    if (perm.receive === "prompt" || perm.receive === "prompt-with-rationale") {
      perm = await PushNotifications.requestPermissions();
    }
    if (perm.receive !== "granted") return; // المستخدم رفض — بنحترم قراره

    await PushNotifications.register();

    PushNotifications.addListener("registration", async (token) => {
      try {
        await fetch(`${apiBaseUrl}/api/push/register`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ token: token.value, platform: "android" }),
        });
      } catch { /* هيك بس — منجرب تسجيل تاني بالمرة الجاية يفتح فيها التطبيق */ }
    });

    // لما المستخدم يدوس عالإشعار (والتطبيق كان مسكّر أو بالخلفية)
    PushNotifications.addListener("pushNotificationActionPerformed", (action) => {
      const url = action?.notification?.data?.url;
      if (url) window.location.href = url;
    });
  } catch { /* أي مشكلة هون ما لازم توقف باقي التطبيق */ }
}
