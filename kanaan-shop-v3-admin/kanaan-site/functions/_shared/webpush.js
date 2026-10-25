/* ============================================================
   WEB PUSH — "a new website order" on the shop's iPhones
   ------------------------------------------------------------
   Kanaan POS on the phone (kanaanshop.com/pos, added to the home
   screen) can receive notifications even when it is closed (iOS 16.4+).
   Standard Web Push: VAPID (RFC 8292) to say who sends, and the message
   encrypted for that one phone (RFC 8291, aes128gcm) so only it can read
   the order number and the customer's name.

   The VAPID key pair is made by the server itself the first time and kept
   in D1 (pos_state 'vapid'): nothing to paste in Cloudflare.
   ============================================================ */
import { ensureSchema } from "./site.js";

const enc = new TextEncoder();
const b64u = (buf) => btoa(String.fromCharCode(...new Uint8Array(buf))).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
const unb64u = (s) => { const t = String(s).replace(/-/g, "+").replace(/_/g, "/"); const bin = atob(t + "===".slice((t.length + 3) % 4)); return Uint8Array.from(bin, (c) => c.charCodeAt(0)); };
const concat = (...parts) => { const out = new Uint8Array(parts.reduce((a, p) => a + p.length, 0)); let o = 0; for (const p of parts) { out.set(p, o); o += p.length; } return out; };

/** The server's VAPID keys (made once, kept in D1). */
export async function vapidKeys(env) {
  await ensureSchema(env);
  const row = await env.DB.prepare("SELECT value FROM pos_state WHERE key = 'vapid'").first();
  if (row) { try { const v = JSON.parse(row.value); if (v.publicKey && v.jwk) return v; } catch { /* make new ones */ } }
  const kp = await crypto.subtle.generateKey({ name: "ECDSA", namedCurve: "P-256" }, true, ["sign", "verify"]);
  const jwk = await crypto.subtle.exportKey("jwk", kp.privateKey);
  const publicKey = b64u(await crypto.subtle.exportKey("raw", kp.publicKey));
  const v = { publicKey, jwk };
  // two first requests at the same moment: the first one written wins, both use it
  await env.DB.prepare("INSERT INTO pos_state (key, value) VALUES ('vapid', ?) ON CONFLICT(key) DO NOTHING").bind(JSON.stringify(v)).run();
  const kept = await env.DB.prepare("SELECT value FROM pos_state WHERE key = 'vapid'").first();
  return JSON.parse(kept.value);
}

async function vapidHeader(env, endpoint) {
  const v = await vapidKeys(env);
  const key = await crypto.subtle.importKey("jwk", v.jwk, { name: "ECDSA", namedCurve: "P-256" }, false, ["sign"]);
  const head = b64u(enc.encode(JSON.stringify({ typ: "JWT", alg: "ES256" })));
  const body = b64u(enc.encode(JSON.stringify({ aud: new URL(endpoint).origin, exp: Math.floor(Date.now() / 1000) + 12 * 3600, sub: "mailto:support@kanaanshop.com" })));
  const sig = await crypto.subtle.sign({ name: "ECDSA", hash: "SHA-256" }, key, enc.encode(`${head}.${body}`));
  return `vapid t=${head}.${body}.${b64u(sig)}, k=${v.publicKey}`;
}

async function hkdf(salt, ikm, info, bytes) {
  const k = await crypto.subtle.importKey("raw", ikm, "HKDF", false, ["deriveBits"]);
  return new Uint8Array(await crypto.subtle.deriveBits({ name: "HKDF", hash: "SHA-256", salt, info }, k, bytes * 8));
}
/** RFC 8291: the message, readable only by this subscription. */
export async function encryptFor(sub, payload) {
  const uaPublic = unb64u(sub.keys.p256dh);
  const authSecret = unb64u(sub.keys.auth);
  const local = await crypto.subtle.generateKey({ name: "ECDH", namedCurve: "P-256" }, true, ["deriveBits"]);
  const asPublic = new Uint8Array(await crypto.subtle.exportKey("raw", local.publicKey));
  const uaKey = await crypto.subtle.importKey("raw", uaPublic, { name: "ECDH", namedCurve: "P-256" }, false, []);
  const shared = new Uint8Array(await crypto.subtle.deriveBits({ name: "ECDH", public: uaKey }, local.privateKey, 256));
  const ikm = await hkdf(authSecret, shared, concat(enc.encode("WebPush: info\0"), uaPublic, asPublic), 32);
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const cek = await hkdf(salt, ikm, enc.encode("Content-Encoding: aes128gcm\0"), 16);
  const nonce = await hkdf(salt, ikm, enc.encode("Content-Encoding: nonce\0"), 12);
  const key = await crypto.subtle.importKey("raw", cek, "AES-GCM", false, ["encrypt"]);
  const plain = concat(enc.encode(JSON.stringify(payload)), new Uint8Array([2]));
  const cipher = new Uint8Array(await crypto.subtle.encrypt({ name: "AES-GCM", iv: nonce }, key, plain));
  const rs = new Uint8Array(4); new DataView(rs.buffer).setUint32(0, 4096);
  return concat(salt, rs, new Uint8Array([asPublic.length]), asPublic, cipher);
}

/** One notification to one phone. Returns the push service's status (404/410 = the phone unsubscribed). */
export async function sendWebPush(env, sub, payload, { ttl = 86400, urgency = "high" } = {}) {
  const body = await encryptFor(sub, payload);
  const res = await fetch(sub.endpoint, {
    method: "POST",
    headers: { Authorization: await vapidHeader(env, sub.endpoint), "Content-Encoding": "aes128gcm", "Content-Type": "application/octet-stream", TTL: String(ttl), Urgency: urgency },
    body,
  });
  return res.status;
}

/** Every phone of the shop that asked for website orders. Never throws (an order is never refused because of it). */
export async function notifyShop(env, payload) {
  try {
    await ensureSchema(env);
    const { results } = await env.DB.prepare("SELECT endpoint, keys FROM pos_push").all();
    for (const r of results || []) {
      let keys = null; try { keys = JSON.parse(r.keys); } catch { keys = null; }
      if (!keys) continue;
      try {
        const status = await sendWebPush(env, { endpoint: r.endpoint, keys }, payload);
        if (status === 404 || status === 410) await env.DB.prepare("DELETE FROM pos_push WHERE endpoint = ?").bind(r.endpoint).run();
        else if (status >= 200 && status < 300) await env.DB.prepare("UPDATE pos_push SET last_ok = ?, fails = 0 WHERE endpoint = ?").bind(Date.now(), r.endpoint).run();
        else await env.DB.prepare("UPDATE pos_push SET fails = fails + 1 WHERE endpoint = ?").bind(r.endpoint).run();
      } catch { /* one phone: try the next */ }
    }
  } catch { /* never break an order */ }
}
