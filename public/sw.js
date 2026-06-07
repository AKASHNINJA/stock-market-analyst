const CACHE_NAME = 'stock-analyst-cache-v1';
const ASSETS_TO_CACHE = [
  '/',
  '/index.html',
  '/style.css',
  '/app.js',
  'https://cdn.jsdelivr.net/npm/apexcharts',
  'https://unpkg.com/lucide@latest'
];

// Install Event - cache core static resources
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => {
        console.log('[Service Worker] Caching App Shell and CDNs');
        return cache.addAll(ASSETS_TO_CACHE);
      })
      .then(() => self.skipWaiting())
  );
});

// Activate Event - clean up old caches
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys => {
      return Promise.all(
        keys.map(key => {
          if (key !== CACHE_NAME) {
            console.log('[Service Worker] Removing old cache:', key);
            return caches.delete(key);
          }
        })
      );
    }).then(() => self.clients.claim())
  );
});

// Fetch Event - network first with cache fallback
self.addEventListener('fetch', event => {
  // Only handle GET requests and bypass browser extensions or external APIs
  if (event.request.method !== 'GET' || event.request.url.startsWith('chrome-extension://')) {
    return;
  }

  event.respondWith(
    caches.match(event.request)
      .then(cachedResponse => {
        if (cachedResponse) {
          // Serve static assets instantly from cache, but also fetch from network in background (Stale-While-Revalidate)
          fetch(event.request)
            .then(networkResponse => {
              if (networkResponse && networkResponse.status === 200) {
                caches.open(CACHE_NAME).then(cache => cache.put(event.request, networkResponse));
              }
            })
            .catch(() => {/* Ignore network update failures offline */});
          return cachedResponse;
        }
        
        // Non-cached requests go to network directly
        return fetch(event.request).catch(err => {
          console.log('[Service Worker] Fetch failed, network offline:', err);
          // Return generic error or blank offline response for API routes if needed
        });
      })
  );
});
