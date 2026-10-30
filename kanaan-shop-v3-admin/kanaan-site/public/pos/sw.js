/* Kanaan POS on the phone — works offline and keeps itself up to date.
   The page itself (/pos/) opens at once from what the phone keeps, and the newest one is fetched behind it (a new
   version shows from the next start); its files have their version in their names and never change, so they are
   kept and served instantly. */
// each version has its own box of files (the build writes the name and the list): a new version brings all its
// files at once — so the app opens even with no internet — and the boxes of old versions are thrown away (the one just
// before is kept, for a page still open on it), so the phone never fills up with old copies
const CACHE = 'kanaan-pos-d54ada2875';
const PRECACHE = ["/pos/assets/engine-DC_mX-um.js","/pos/assets/index-CLr-s7dV.css","/pos/assets/index-DbZ0zJCZ.js","/pos/assets/inter-latin-400-normal-C38fXH4l.woff2","/pos/assets/inter-latin-500-normal-Cerq10X2.woff2","/pos/assets/inter-latin-600-normal-LgqL8muc.woff2","/pos/assets/inter-latin-ext-400-normal-C1nco2VV.woff2","/pos/assets/inter-latin-ext-500-normal-CV4jyFjo.woff2","/pos/assets/inter-latin-ext-600-normal-D2bJ5OIk.woff2","/pos/assets/ponyfill-f-G7mqWr.js","/pos/assets/portrait-Chu9lngX.js","/pos/assets/space-grotesk-latin-500-normal-KYfcXlvK.woff2","/pos/assets/space-grotesk-latin-600-normal-0SbvWzVy.woff2","/pos/assets/space-grotesk-latin-700-normal-B7Rq4K4l.woff2","/pos/assets/space-grotesk-latin-ext-500-normal-DUe3BAxM.woff2","/pos/assets/space-grotesk-latin-ext-600-normal-DxxdqCpr.woff2","/pos/assets/space-grotesk-latin-ext-700-normal-BQnZhY3m.woff2","/pos/assets/sqlite3-k2cTanUO.wasm","/pos/assets/sqlite3-opfs-async-proxy-DeAec6oc.js","/pos/assets/sqlite3-worker1-CgCwCFra.js","/pos/assets/yusuf-480-Cc69TR39.webp","/pos/assets/zxing_reader-CtDQkrKK.js","/pos/assets/zxing_reader-CyK_g8pk.wasm"];
self.addEventListener('install', (e) => {
  self.skipWaiting();
  e.waitUntil(caches.open(CACHE).then(async (c) => { await c.addAll(['/pos/', '/pos/manifest.webmanifest']).catch(() => {}); await Promise.all(PRECACHE.map((u) => c.match(u).then((hit) => hit || c.add(u)).catch(() => {}))); }));
});
self.addEventListener('activate', (e) => {
  e.waitUntil((async () => {
    const mine = (await caches.keys()).filter((k) => k.startsWith('kanaan-pos-') && k !== CACHE);
    for (const k of mine.slice(0, -1)) await caches.delete(k);
    for (const k of await caches.keys()) if (!k.startsWith('kanaan-pos-')) await caches.delete(k);
    await self.clients.claim();
  })());
});
self.addEventListener('fetch', (e) => {
  const u = new URL(e.request.url);
  if (e.request.method !== 'GET' || u.origin !== location.origin || !u.pathname.startsWith('/pos/')) return; // the site, photos and the cloud: never touched
  if (u.pathname.startsWith('/pos/assets/')) {
    e.respondWith(caches.open(CACHE).then(async (c) => { const hit = (await c.match(e.request)) || (await caches.match(e.request)); if (hit) return hit; const r = await fetch(e.request); if (r.ok) c.put(e.request, r.clone()); return r; }));
    return;
  }
  // the page opens at once from this phone (no waiting for the network at every start); the newest page is fetched
  // in the background — a new version shows from the next start (and the open app is told, to reload when idle)
  e.respondWith((async () => {
    const c = await caches.open(CACHE);
    const page = e.request.mode === 'navigate' || u.pathname === '/pos/' || u.pathname === '/pos/index.html';
    const hit = page ? ((await c.match('/pos/')) || (await caches.match('/pos/'))) : await c.match(e.request);
    const fresh = fetch(e.request, { cache: 'no-store' }).then(async (r) => {
      if (!r.ok) return r;
      const key = page ? '/pos/' : e.request;
      if (page && hit) {
        const [a, b] = await Promise.all([r.clone().text(), hit.clone().text()]);
        if (a !== b) { await c.put(key, r.clone()); for (const cl of await self.clients.matchAll({ type: 'window' })) cl.postMessage({ kanaan: 'updated' }); return r; }
      }
      await c.put(key, r.clone());
      return r;
    });
    if (hit) { e.waitUntil(fresh.catch(() => {})); return hit; }
    try { return await fresh; } catch { return (await c.match('/pos/')) || Response.error(); }
  })());
});

/* Website orders, even when the app is closed (iOS 16.4+ on the home screen). The message is encrypted for this phone
   by the shop's site; it carries the order number and the customer's name. */
self.addEventListener('push', (e) => {
  let d = {};
  try { d = e.data ? e.data.json() : {}; } catch { d = { body: e.data ? e.data.text() : '' }; }
  if (d.badge != null && self.navigator && self.navigator.setAppBadge) self.navigator.setAppBadge(d.badge).catch(() => {});
  e.waitUntil(self.registration.showNotification(d.title || 'Kanaan', {
    body: d.body || 'Something new in the shop', tag: d.tag || 'kanaan', renotify: true,
    icon: '/pos/icon-192.png', badge: '/pos/icon-192.png', data: { url: d.url || '/pos/' },
  }));
});
self.addEventListener('notificationclick', (e) => {
  e.notification.close();
  const url = (e.notification.data && e.notification.data.url) || '/pos/';
  e.waitUntil((async () => {
    const all = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
    for (const c of all) { if (new URL(c.url).pathname.startsWith('/pos/')) { await c.focus(); c.postMessage({ kanaan: 'open', url }); return; } }
    await self.clients.openWindow(url);
  })());
});
