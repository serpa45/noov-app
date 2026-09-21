const APP_CACHE_PREFIX = 'noov-pwa-';

function isWorkboxCacheForThisRegistration(name) {
  const hasWorkboxBucket = /(^|-)precache-v\d+-|(^|-)runtime-|(^|-)googleAnalytics-/.test(name);
  return hasWorkboxBucket && name.endsWith(self.registration.scope);
}

function isLegacyNoovAppCache(name) {
  return name.startsWith(APP_CACHE_PREFIX) || isWorkboxCacheForThisRegistration(name);
}

self.addEventListener('install', () => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil((async () => {
    try {
      const cacheNames = await caches.keys();
      const appCacheNames = cacheNames.filter(isLegacyNoovAppCache);
      await Promise.allSettled(appCacheNames.map((name) => caches.delete(name)));

      await self.clients.claim();
      const windowClients = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
      await Promise.allSettled(windowClients.map((client) => {
        try {
          const url = new URL(client.url);
          url.searchParams.set('sw-cleanup', Date.now().toString());
          return client.navigate(url.toString());
        } catch {
          return client.navigate(client.url);
        }
      }));
    } finally {
      await self.registration.unregister();
    }
  })());
});

self.addEventListener('message', (event) => {
  if (event.data === 'SKIP_WAITING') self.skipWaiting();
});

self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') return;
  event.respondWith(fetch(event.request, { cache: 'no-store' }));
});
