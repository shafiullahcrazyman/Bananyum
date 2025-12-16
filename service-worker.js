// CRITICAL: Updated version to v1 to force cache renewal
const CACHE_NAME = 'bananyum-v1'; 
const ASSETS_TO_CACHE = [
  './',
  './index.html',
  './manifest.json',
  './icon.png'
];

self.addEventListener('install', (event) => {
  // Forces the new SW to take control immediately
  self.skipWaiting();
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      // Pre-cache static assets
      return cache.addAll(ASSETS_TO_CACHE);
    })
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    // Cleans up any old caches (v1, v2) that might be broken
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cache) => {
          if (cache !== CACHE_NAME) {
            console.log('Clearing old cache:', cache);
            return caches.delete(cache);
          }
        })
      );
    }).then(() => self.clients.claim()) // Takes control of the page immediately
  );
});

self.addEventListener('fetch', (event) => {
  // Strategy: Network First for HTML, Cache First for everything else
  // This ensures index.html is always fresh, preventing 404 errors on new JS bundles.
  if (event.request.mode === 'navigate') {
    event.respondWith(
      fetch(event.request) // Try to fetch the latest index.html from the network
        .catch(() => {
          return caches.match(event.request); // Fallback to cache if offline
        })
    );
  } else {
    // For assets (JS, CSS, images): Cache First, fallback to Network
    event.respondWith(
      caches.match(event.request).then((cached) => {
        return cached || fetch(event.request);
      })
    );
  }
});

