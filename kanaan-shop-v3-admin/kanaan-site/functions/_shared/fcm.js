/* ============================================================
   FCM.JS — مساعد إرسال إشعارات Firebase Cloud Messaging.

   Google أوقف الـ API القديم (legacy) بالكامل من نص 2024 — أي إرسال
   إشعارات هلق لازم يمر عبر "HTTP v1 API"، يلي بيحتاج access token
   حقيقي (OAuth2)، مش مجرد "server key" بسيط زي قبل. الـ access token
   هاد منجيبه بتوقيع JWT بالمفتاح الخاص لحساب الخدمة (service account)
   وتبديله عند سيرفرات جوجل — كل هاد بواسطة Web Crypto API المدمجة
   بـ Cloudflare Workers، بدون أي مكتبة خارجية.
   ============================================================ */

function base64url(input) {
  const bytes = typeof input === "string" ? new TextEncoder().encode(input) : new Uint8Array(input);
  let str = "";
  for (const b of bytes) str += String.fromCharCode(b);
  return btoa(str).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

async function importPrivateKey(pem) {
  const clean = pem
    .replace(/-----BEGIN PRIVATE KEY-----/, "")
    .replace(/-----END PRIVATE KEY-----/, "")
    .replace(/\s+/g, "");
  const raw = Uint8Array.from(atob(clean), (c) => c.charCodeAt(0));
  return crypto.subtle.importKey(
    "pkcs8",
    raw.buffer,
    { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" },
    false,
    ["sign"]
  );
}

async function getAccessToken(serviceAccount) {
  const now = Math.floor(Date.now() / 1000);
  const header = { alg: "RS256", typ: "JWT" };
  const claim = {
    iss: serviceAccount.client_email,
    scope: "https://www.googleapis.com/auth/firebase.messaging",
    aud: "https://oauth2.googleapis.com/token",
    iat: now,
    exp: now + 3600,
  };
  const unsigned = `${base64url(JSON.stringify(header))}.${base64url(JSON.stringify(claim))}`;
  const key = await importPrivateKey(serviceAccount.private_key);
  const sigBuf = await crypto.subtle.sign(
    "RSASSA-PKCS1-v1_5",
    key,
    new TextEncoder().encode(unsigned)
  );
  const jwt = `${unsigned}.${base64url(sigBuf)}`;

  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: `grant_type=urn:ietf:params:oauth:grant-type:jwt-bearer&assertion=${jwt}`,
  });
  const data = await res.json();
  if (!data.access_token) throw new Error("فشل تسجيل الدخول لـ Firebase: " + JSON.stringify(data));
  return data.access_token;
}

/* بيبعت إشعار واحد لكل توكن جهاز، وبيرجع كم نجح وكم فشل، وأي توكنات
   صارت غير صالحة (تطبيق انحذف من الجهاز مثلاً) حتى نحذفهم من القاعدة. */
export async function sendPushToTokens(env, tokens, { title, body, url }) {
  if (!env.FCM_SERVICE_ACCOUNT_JSON) {
    throw new Error("FCM_SERVICE_ACCOUNT_JSON مش مضبوط بإعدادات Cloudflare.");
  }
  const serviceAccount = JSON.parse(env.FCM_SERVICE_ACCOUNT_JSON);
  const accessToken = await getAccessToken(serviceAccount);
  const projectId = serviceAccount.project_id;

  const result = { sent: 0, failed: 0, invalidTokens: [] };

  for (const token of tokens) {
    const res = await fetch(
      `https://fcm.googleapis.com/v1/projects/${projectId}/messages:send`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          message: {
            token,
            notification: { title, body },
            ...(url ? { data: { url } } : {}),
            android: { priority: "high" },
          },
        }),
      }
    );

    if (res.ok) {
      result.sent++;
    } else {
      result.failed++;
      const errData = await res.json().catch(() => ({}));
      const status = errData?.error?.status;
      if (status === "NOT_FOUND" || status === "UNREGISTERED" || status === "INVALID_ARGUMENT") {
        result.invalidTokens.push(token);
      }
    }
  }

  return result;
}
