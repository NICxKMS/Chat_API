/* eslint-disable no-restricted-globals */
const STATIC_CACHE = 'static-cache-v1.1';
const DYNAMIC_CACHE = 'dynamic-cache-v1.1';
const CACHE_DURATION = 7 * 24 * 60 * 60 * 1000; // 7 days

const STATIC_ASSETS = [
  '/',
  '/index.html',
  '/manifest.json',
  '/image.webp',

  // Include built assets dynamically with patterns (if applicable in dev tools)
];

// 📦 Install
self.addEventListener('install', (event) => {
  self.skipWaiting();
  event.waitUntil(
    caches.open(STATIC_CACHE).then((cache) => {
      return cache.addAll(STATIC_ASSETS);
    })
  );
});

// 🧹 Activate
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys.map((key) => {
          if (key !== STATIC_CACHE && key !== DYNAMIC_CACHE) {
            return caches.delete(key);
          }
        })
      )
    )
  );
  self.clients.claim();
});

// 🧠 Should we cache this request?
const shouldCache = (request) => {
  const url = new URL(request.url);

  if (
    url.origin !== location.origin || // Only cache same-origin
    url.pathname.startsWith('/api/') || // No API caching
    url.pathname.includes('auth') ||
    url.pathname.includes('token')
  ) {
    return false;
  }

  return request.method === 'GET' && (
    request.destination === 'style' ||
    request.destination === 'script' ||
    request.destination === 'image' ||
    request.destination === 'font' ||
    request.destination === 'document'
  );
};

// 🛰️ Fetch
self.addEventListener('fetch', (event) => {
  if (!shouldCache(event.request)) {
    return;
  }

  event.respondWith(
    caches.match(event.request).then((cachedResponse) => {
      if (cachedResponse) {
        const cachedDate = new Date(cachedResponse.headers.get('date'));
        if (cachedDate.getTime() + CACHE_DURATION > Date.now()) {
          return cachedResponse;
        }
      }

      return fetch(event.request)
        .then((networkResponse) => {
          if (!networkResponse || networkResponse.status !== 200) {
            return networkResponse;
          }

          const clonedResponse = networkResponse.clone();
          const responseWithDate = new Response(clonedResponse.body, {
            status: clonedResponse.status,
            statusText: clonedResponse.statusText,
            headers: new Headers({
              ...Object.fromEntries(clonedResponse.headers.entries()),
              date: new Date().toUTCString(),
            }),
          });

          const cacheToUse = event.request.destination === 'document' ? STATIC_CACHE : DYNAMIC_CACHE;

          caches.open(cacheToUse).then((cache) => {
            cache.put(event.request, responseWithDate.clone());
          });

          return networkResponse;
        })
        .catch(() => {
          // Offline fallback for navigation
          if (event.request.mode === 'navigate') {
            return caches.match('/index.html');
          }
          return caches.match(event.request);
        });
    })
  );
});
