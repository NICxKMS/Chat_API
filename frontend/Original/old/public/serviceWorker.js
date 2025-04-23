/* eslint-disable no-restricted-globals */
const CACHE_NAME = 'chat-app-cache-v1';
const STATIC_ASSETS = [
  '/',
  '/index.html',
  '/static/js/main.*.js',
  '/static/js/*.chunk.js',
  '/static/css/main.*.css',
  '/static/css/*.chunk.css',
  '/manifest.json',
  '/image.webp'
];

// Dynamic cache for runtime resources
const DYNAMIC_CACHE = 'chat-app-dynamic-v1';

// Cache duration in milliseconds (7 days)
const CACHE_DURATION = 7 * 24 * 60 * 60 * 1000;

// Install event - cache static assets
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => {
        console.log('Opened cache');
        return cache.addAll(STATIC_ASSETS);
      })
  );
});

// Activate event - clean up old caches
self.addEventListener('activate', (event) => {
  event.waitUntil(
    Promise.all([
      caches.keys().then((cacheNames) => {
        return Promise.all(
          cacheNames.map((cacheName) => {
            if (cacheName !== CACHE_NAME && cacheName !== DYNAMIC_CACHE) {
              return caches.delete(cacheName);
            }
          })
        );
      }),
      // Clean up expired items from dynamic cache
      caches.open(DYNAMIC_CACHE).then((cache) => {
        return cache.keys().then((keys) => {
          return Promise.all(
            keys.map((request) => {
              return cache.match(request).then((response) => {
                if (response) {
                  const date = new Date(response.headers.get('date'));
                  if (date.getTime() + CACHE_DURATION < Date.now()) {
                    return cache.delete(request);
                  }
                }
              });
            })
          );
        });
      })
    ])
  );
});

// Helper function to determine if a request should be cached
const shouldCache = (request) => {
  const url = new URL(request.url);
  
  // Don't cache API calls or authentication endpoints
  if (url.pathname.startsWith('/api/') || 
      url.pathname.includes('auth') || 
      url.pathname.includes('login') ||
      url.pathname.includes('token')) {
    return false;
  }

  // Cache static assets and HTML pages
  return request.method === 'GET' && (
    request.destination === 'style' ||
    request.destination === 'script' ||
    request.destination === 'image' ||
    request.destination === 'font' ||
    request.destination === 'document'
  );
};

// Fetch event - serve from cache, fall back to network
self.addEventListener('fetch', (event) => {
  if (!shouldCache(event.request)) {
    return;
  }

  event.respondWith(
    caches.match(event.request)
      .then((response) => {
        // Cache hit - return response
        if (response) {
          // Check if response is expired
          const date = new Date(response.headers.get('date'));
          if (date.getTime() + CACHE_DURATION > Date.now()) {
            return response;
          }
        }

        // Clone the request
        const fetchRequest = event.request.clone();

        return fetch(fetchRequest).then(
          (response) => {
            // Check if we received a valid response
            if(!response || response.status !== 200) {
              return response;
            }

            // Clone the response
            const responseToCache = response.clone();

            // Cache the response
            if (shouldCache(event.request)) {
              const cache = event.request.destination === 'document' ? 
                CACHE_NAME : DYNAMIC_CACHE;
              
              caches.open(cache)
                .then((cache) => {
                  const headers = new Headers(responseToCache.headers);
                  headers.append('date', new Date().toUTCString());
                  
                  return cache.put(event.request, new Response(
                    responseToCache.body,
                    {
                      status: responseToCache.status,
                      statusText: responseToCache.statusText,
                      headers: headers
                    }
                  ));
                });
            }

            return response;
          }
        ).catch(() => {
          // Network failed, try to return a cached response
          return caches.match(event.request);
        });
      })
  );
}); 