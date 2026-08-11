/**
 * Lightweight SW — cache images only.
 * Do NOT cache HTML/JS shell (breaks SPA client-side navigation / hot updates).
 */
const CACHE = 'kingshot-assets-v2';

self.addEventListener('install', () => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)))
    ).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);
  if (event.request.method !== 'GET') return;

  const isAsset =
    url.pathname.startsWith('/assets/') ||
    /\.(webp|png|jpg|jpeg|gif|svg|woff2?)$/i.test(url.pathname);

  if (!isAsset) return;

  event.respondWith(
    caches.open(CACHE).then(async (cache) => {
      const cached = await cache.match(event.request);
      if (cached) return cached;
      try {
        const res = await fetch(event.request);
        if (res.ok) cache.put(event.request, res.clone());
        return res;
      } catch {
        return cached || Response.error();
      }
    })
  );
});
