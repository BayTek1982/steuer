// Netz zuerst, damit Aktualisierungen sofort ankommen; ohne Netz aus dem Zwischenspeicher.
const CACHE = 'steuer-kompass-v1';
const DATEIEN = ['./', 'index.html', 'style.css', 'app.js', 'tax.js', 'meine-daten.js', 'manifest.json', 'icon.svg', 'icon-192.png'];

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(DATEIEN)).then(() => self.skipWaiting()));
});
self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys().then((ks) => Promise.all(ks.filter((k) => k !== CACHE).map((k) => caches.delete(k)))).then(() => self.clients.claim())
  );
});
self.addEventListener('fetch', (e) => {
  if (e.request.method !== 'GET' || new URL(e.request.url).origin !== location.origin) return;
  e.respondWith(
    fetch(e.request)
      .then((r) => {
        const kopie = r.clone();
        caches.open(CACHE).then((c) => c.put(e.request, kopie));
        return r;
      })
      .catch(() => caches.match(e.request, { ignoreSearch: true }))
  );
});
