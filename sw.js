const CACHE_NAME = 'packngo-v4';
const urlsToCache = [
  '.',
  'index.html',
  'styles.css',
  'js/core.js',
  'js/auth.js',
  'js/ui.js',
  'js/courses.js',
  'js/staff-messagerie.js',
  'js/main.js',
  'icon.png',
  'icon-512.png',
  'manifest.json'
];

self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => cache.addAll(urlsToCache))
  );
  self.skipWaiting();
});

// Supprime les anciens caches (ex: packngo-v1) quand une nouvelle
// version du service worker prend le relais.
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(
        keys.filter(key => key !== CACHE_NAME).map(key => caches.delete(key))
      )
    )
  );
  self.clients.claim();
});

self.addEventListener('fetch', event => {
  event.respondWith(
    caches.match(event.request).then(response => response || fetch(event.request))
  );
});
