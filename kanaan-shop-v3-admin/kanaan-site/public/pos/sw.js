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
