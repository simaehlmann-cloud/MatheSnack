/* MatheSnack – Service Worker (nur Webfassung; in der App-Hülle abgeschaltet)
   Strategie wie bei Drawmory:
   - Navigation (index.html): erst Netz, dann Cache -> Updates greifen sofort
   - Übrige Dateien: erst Cache, Aktualisierung im Hintergrund
   Der Worker übernimmt erst nach Bestätigung durch die App (SKIP_WAITING). */

/* Der Name trägt die App-Version. validate.js vergleicht ihn mit
   APP_VERSION in js/core.js. */
const CACHE = 'mathesnack-0.1.0';

const ASSETS = [
  './',
  './index.html',
  './manifest.json',
  './datenschutz.html',
  './impressum.html',
  './js/core.js?v=0.1.0',
  './js/content.js?v=0.1.0',
  './js/qr.js?v=0.1.0',
  './js/jsqr.js?v=0.1.0',
  './js/games.js?v=0.1.0',
  './js/teacher.js?v=0.1.0',
  './js/app.js?v=0.1.0',
  './icon.png',
  './icon-180.png',
  './icon-192.png',
  './icon-maskable-512.png'
];

self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE).then(cache => cache.addAll(ASSETS)).catch(err => {
      console.warn('Vorab-Caching unvollständig:', err);
    })
  );
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('message', event => {
  if (event.data && event.data.type === 'SKIP_WAITING') self.skipWaiting();
});

self.addEventListener('fetch', event => {
  const req = event.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;

  if (req.mode === 'navigate') {
    event.respondWith(
      fetch(req)
        .then(res => {
          const copy = res.clone();
          caches.open(CACHE).then(c => c.put(req, copy));
          return res;
        })
        .catch(() => caches.match(req, { ignoreSearch: true }).then(hit => hit || caches.match('./index.html')))
    );
    return;
  }

  event.respondWith(
    caches.match(req).then(hit => {
      const network = fetch(req)
        .then(res => {
          if (res && res.status === 200 && res.type === 'basic') {
            const copy = res.clone();
            caches.open(CACHE).then(c => c.put(req, copy));
          }
          return res;
        })
        .catch(() => hit);
      return hit || network;
    })
  );
});
