// SKIDS Screen Service Worker — Offline-first with auto-update notification
//
// How updates work:
//   1. Every Vercel deploy runs `prebuild` which stamps SW_VERSION
//   2. Browser detects sw.js byte-changed → installs new SW in background
//   3. New SW activates immediately (skipWaiting + clients.claim)
//   4. SW posts 'SW_UPDATED' message to all open tabs
//   5. App shows "v2.1.0 available — tap to update" toast
//   6. Nurse taps → page refreshes with latest code
//
// SW_VERSION is replaced at build time by scripts/stamp-sw.js
const SW_VERSION = '__SW_BUILD_ID__';
const IS_STAMPED = !SW_VERSION.includes('BUILD_ID');
const CACHE_NAME = 'zpediscreen-' + (IS_STAMPED ? SW_VERSION : Date.now());

const STATIC_ASSETS = [
  '/',
  '/device-reading',
  '/manifest.json',
  '/icon-192.png',
  '/icon-512.png',
];

// Install — pre-cache shell, activate immediately
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(STATIC_ASSETS))
  );
  self.skipWaiting();
});

// Activate — purge old caches, notify all tabs
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys
          .filter((k) => k.startsWith('zpediscreen-') && k !== CACHE_NAME)
          .map((k) => caches.delete(k))
      )
    ).then(() => {
      return self.clients.matchAll({ type: 'window' });
    }).then((clients) => {
      clients.forEach((client) => {
        client.postMessage({
          type: 'SW_UPDATED',
          version: IS_STAMPED ? SW_VERSION : 'dev',
        });
      });
    })
  );
  self.clients.claim();
});

// Respond to version queries from the app
self.addEventListener('message', (event) => {
  if (event.data === 'GET_VERSION') {
    event.source.postMessage({
      type: 'SW_VERSION',
      version: IS_STAMPED ? SW_VERSION : 'dev',
      cacheName: CACHE_NAME,
    });
  }
  if (event.data === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});

// Fetch strategy
self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // Skip non-GET and cross-origin
  if (request.method !== 'GET' || url.origin !== self.location.origin) return;

  // API calls — always network, never cache
  if (url.pathname.startsWith('/api/')) return;

  // Navigation requests — network-first with offline fallback
  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request)
        .then((response) => {
          const clone = response.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(request, clone));
          return response;
        })
        .catch(() => caches.match('/') || new Response('Offline', { status: 503 }))
    );
    return;
  }

  // Static assets (JS, CSS, images, fonts) — cache-first
  if (
    url.pathname.startsWith('/assets/static/') ||
    url.pathname.startsWith('/icon-') ||
    url.pathname.endsWith('.js') ||
    url.pathname.endsWith('.css') ||
    url.pathname.endsWith('.woff2') ||
    url.pathname.endsWith('.png') ||
    url.pathname.endsWith('.svg')
  ) {
    event.respondWith(
      caches.match(request).then(
        (cached) =>
          cached ||
          fetch(request).then((response) => {
            const clone = response.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(request, clone));
            return response;
          })
      )
    );
    return;
  }

  // Everything else — network-first
  event.respondWith(
    fetch(request)
      .then((response) => {
        const clone = response.clone();
        caches.open(CACHE_NAME).then((cache) => cache.put(request, clone));
        return response;
      })
      .catch(() => caches.match(request))
  );
});
