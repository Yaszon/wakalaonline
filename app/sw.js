/* Service worker: fonts na maktaba zinahifadhiwa; index.html na app.js daima mtandao kwanza (ili update ifike mara moja). */
const C = 'wo-v2';
const STATIC = ['fonts/manrope.woff2', 'fonts/sora-600.woff2', 'fonts/sora-700.woff2', 'lib/jspdf.umd.min.js', 'lib/jspdf.plugin.autotable.min.js', 'lib/pdf.min.js', 'lib/pdf.worker.min.js', 'icon-192.png', 'icon-512.png'];
self.addEventListener('install', e => { e.waitUntil(caches.open(C).then(c => c.addAll(STATIC)).then(() => self.skipWaiting())); });
self.addEventListener('activate', e => { e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => k !== C).map(k => caches.delete(k)))).then(() => self.clients.claim())); });
/* Web Share Target: mteja anashiriki picha/PDF ya risiti kwenda app (PWA iliyosakinishwa) → faili linapelekwa kwenye ukurasa (message yzShare) */
self.addEventListener('fetch', e => {
  const u = new URL(e.request.url);
  if (e.request.method === 'POST' && u.pathname.endsWith('/share')) {
    e.respondWith((async () => {
      const fd = await e.request.formData(); const f = fd.get('risiti');
      const all = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
      let cl = all[0]; if (!cl) cl = await self.clients.openWindow('./'); else { try { await cl.focus(); } catch (x) {} }
      if (f) { const send = c => c && c.postMessage({ type: 'yzShare', file: f }); if (cl) setTimeout(() => send(cl), all[0] ? 100 : 2500); }
      return Response.redirect('./', 303);
    })());
    return;
  }
  if (e.request.method !== 'GET' || u.origin !== location.origin) return;   // seva (Apps Script) haipiti hapa
  if (STATIC.some(s => u.pathname.endsWith('/' + s))) { e.respondWith(caches.match(e.request).then(r => r || fetch(e.request))); return; }
  e.respondWith(fetch(e.request).then(r => { const cp = r.clone(); caches.open(C).then(c => c.put(e.request, cp)); return r; }).catch(() => caches.match(e.request)));
});
