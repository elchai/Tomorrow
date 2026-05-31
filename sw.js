/* TOMORROW service worker — offline-first cache.
   Strategy: cache-first for own-origin static assets; network-first for
   third-party CDN scripts (Leaflet, Lucide) so SRI'd files stay current.
   Bump CACHE_KEY on each release to invalidate stale entries. */

const CACHE_KEY = 'tomorrow-v0.7';
const APP_SHELL = [
  './',
  'index.html',
  'style.css',
  'app.js',
  'router.js',
  'wiring.js',
  'i18n.js',
  'config.js',
  'countries.js',
  'sounds.js',
  'prediction.js',
  'map.js',
  'dispatch.js',
  'layers.js',
  'osint.js',
  'analytics.js',
  'intel.js',
  'lpr.js',
  'syslog.js',
  'archive.js',
  'officers.js',
  'shifts.js',
  'fleet.js',
  'training.js',
  'integrations.js',
  'insights.js',
  'settings.js',
  'assets/tomorrow-logo.png',
  'assets/favicon.png'
];

self.addEventListener('install', evt => {
  evt.waitUntil(
    caches.open(CACHE_KEY).then(cache => cache.addAll(APP_SHELL).catch(() => null))
  );
  self.skipWaiting();
});

self.addEventListener('activate', evt => {
  evt.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE_KEY).map(k => caches.delete(k)))
    ).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', evt => {
  const url = new URL(evt.request.url);
  // Skip non-GET + cross-origin POSTs to Firebase etc.
  if (evt.request.method !== 'GET') return;

  // Same-origin: cache-first, fall back to network and cache the result.
  if (url.origin === self.location.origin) {
    evt.respondWith(
      caches.match(evt.request).then(cached => cached || fetch(evt.request).then(res => {
        if (res && res.ok) {
          const copy = res.clone();
          caches.open(CACHE_KEY).then(c => c.put(evt.request, copy));
        }
        return res;
      }).catch(() => cached || new Response('', { status: 504 })))
    );
    return;
  }

  // CDN tiles / scripts: network-first with cache fallback for offline.
  evt.respondWith(
    fetch(evt.request).then(res => {
      if (res && res.ok) {
        const copy = res.clone();
        caches.open(CACHE_KEY).then(c => c.put(evt.request, copy));
      }
      return res;
    }).catch(() => caches.match(evt.request))
  );
});
