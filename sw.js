/**
 * @file sw.js
 * Service Worker for Buku 555 Berhantu.
 * Strategy: cache-first app shell, network fallback.
 * Bump CACHE_VERSION whenever deployed files change.
 */

// ---------------------------------------------------------------------------
// Version — bump this string to invalidate old caches on next deploy
// ---------------------------------------------------------------------------
const CACHE_VERSION = 'buku555-v4';

// ---------------------------------------------------------------------------
// App shell — all resources required for offline use
// ---------------------------------------------------------------------------
const APP_SHELL = [
  './',
  './index.html',
  './styles.css',
  './app.js',
  './parser.js',
  './ledger.js',
  './i18n.js',
  './manifest.json',
  './assets/ghost.svg',
  './assets/icon-192.svg',
  './assets/icon-512.svg',
  './assets/icon-192.png',
  './assets/icon-512.png',
];

// ---------------------------------------------------------------------------
// Install — pre-cache app shell
// ---------------------------------------------------------------------------
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_VERSION)
      .then((cache) => cache.addAll(APP_SHELL))
      .then(() => self.skipWaiting())   // activate immediately
  );
});

// ---------------------------------------------------------------------------
// Activate — delete stale caches
// ---------------------------------------------------------------------------
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys
          .filter((key) => key !== CACHE_VERSION)
          .map((key) => caches.delete(key))
      )
    ).then(() => self.clients.claim())  // take control of open pages immediately
  );
});

// ---------------------------------------------------------------------------
// Fetch — cache-first, then network
// ---------------------------------------------------------------------------
self.addEventListener('fetch', (event) => {
  // Only handle GET requests; let POSTs etc. pass through
  if (event.request.method !== 'GET') return;

  // Only handle same-origin + relative requests
  const url = new URL(event.request.url);
  if (url.origin !== location.origin) return;

  event.respondWith(
    caches.match(event.request).then((cached) => {
      if (cached) {
        return cached;
      }
      // Not in cache — try network, then optionally cache the response
      return fetch(event.request).then((networkResponse) => {
        // Only cache valid responses
        if (networkResponse && networkResponse.status === 200 && networkResponse.type === 'basic') {
          const responseClone = networkResponse.clone();
          caches.open(CACHE_VERSION).then((cache) => {
            cache.put(event.request, responseClone);
          });
        }
        return networkResponse;
      }).catch(() => {
        // Network failed — return cached root as fallback for navigation requests
        if (event.request.mode === 'navigate') {
          return caches.match('./index.html');
        }
        // For other resources, just let it fail gracefully
        return new Response('', { status: 503, statusText: 'Service Unavailable' });
      });
    })
  );
});
