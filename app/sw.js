/* Service worker: fonts na maktaba zinahifadhiwa; index.html na app.js daima mtandao kwanza (ili update ifike mara moja). */
const C = 'wo-v1';
const STATIC = ['fonts/manrope.woff2', 'fonts/sora-600.woff2', 'fonts/sora-700.woff2', 'lib/jspdf.umd.min.js', 'lib/jspdf.plugin.autotable.min.js', 'icon-192.png', 'icon-512.png'];
self.addEventListener('install', e => { e.waitUntil(caches.open(C).then(c => c.addAll(STATIC)).then(() => self.skipWaiting())); });
self.addEventListener('activate', e => { e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => k !== C).map(k => caches.delete(k)))).then(() => self.clients.claim())); });
self.addEventListener('fetch', e => {
  const u = new URL(e.request.url);
  if (e.request.method !== 'GET' || u.origin !== location.origin) return;   // seva (Apps Script) haipiti hapa
  if (STATIC.some(s => u.pathname.endsWith('/' + s))) { e.respondWith(caches.match(e.request).then(r => r || fetch(e.request))); return; }
  e.respondWith(fetch(e.request).then(r => { const cp = r.clone(); caches.open(C).then(c => c.put(e.request, cp)); return r; }).catch(() => caches.match(e.request)));
});
