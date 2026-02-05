const CACHE_NAME = 'png-v4-cache';
const ASSETS = [
  './',
  './index.html',
  './manifest.json',
  './logo.png',
  './icon.png',
  'https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;600;700;800&display=swap'
];

// Installation du Service Worker et mise en cache des fichiers
self.addEventListener('install', (e) => {
  e.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(ASSETS);
    })
  );
});

// Stratégie : Réseau en priorité, sinon Cache
self.addEventListener('fetch', (e) => {
  e.respondWith(
    fetch(e.request).catch(() => {
      return caches.match(e.request);
    })
  );
});
