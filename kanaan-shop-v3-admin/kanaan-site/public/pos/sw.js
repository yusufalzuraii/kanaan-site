/* Kanaan POS on the phone — works offline and keeps itself up to date.
   The page itself (/pos/) is always asked from the network first, so a new version arrives the moment the phone is
   online; its files have their version in their names and never change, so they are kept and served instantly. */
const CACHE = 'kanaan-pos-v1';
self.addEventListener('install', (e) => { self.skipWaiting(); e.waitUntil(caches.open(CACHE).then((c) => c.addAll(['/pos/', '/pos/manifest.webmanifest']).catch(() => {}))); });
self.addEventListener('activate', (e) => { e.waitUntil((async () => { for (const k of await caches.keys()) if (k !== CACHE) await caches.delete(k); await self.clients.claim(); })()); });
self.addEventListener('fetch', (e) => {
  const u = new URL(e.request.url);
  if (e.request.method !== 'GET' || u.origin !== location.origin || !u.pathname.startsWith('/pos/')) return; // the site, photos and the cloud: never touched
  if (u.pathname.startsWith('/pos/assets/')) {
    e.respondWith(caches.open(CACHE).then(async (c) => { const hit = await c.match(e.request); if (hit) return hit; const r = await fetch(e.request); if (r.ok) c.put(e.request, r.clone()); return r; }));
    return;
  }
  e.respondWith((async () => {
    try { const r = await fetch(e.request, { cache: 'no-store' }); if (r.ok) (await caches.open(CACHE)).put(e.request, r.clone()); return r; } catch { const c = await caches.open(CACHE); return (await c.match(e.request)) || (await c.match('/pos/')) || Response.error(); }
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
