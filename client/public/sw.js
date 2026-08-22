/**
 * Kingshot asset cache
 * - Cache-first for images / fonts under /assets/ and common image extensions
 * - Does NOT cache HTML/JS (SPA + Vite HMR stay fresh)
 * - Survives normal reloads; hard reload may still bypass SW in some browsers
 */
const CACHE = 'kingshot-assets-v4';
const ASSET_RE = /\.(webp|png|jpg|jpeg|gif|svg|ico|woff2?|ttf|otf)(\?.*)?$/i;

function isCacheableAsset(url) {
  if (url.origin !== self.location.origin) return false;
  if (url.pathname.startsWith('/assets/')) return true;
  if (ASSET_RE.test(url.pathname)) return true;
  return false;
}

self.addEventListener('install', (event) => {
  self.skipWaiting();
  // Warm cache with nothing required — filled on first fetch
  event.waitUntil(caches.open(CACHE));
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)))
    ).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') return;

  let url;
  try {
    url = new URL(event.request.url);
  } catch {
    return;
  }

  if (!isCacheableAsset(url)) return;

  event.respondWith(
    (async () => {
      const cache = await caches.open(CACHE);
      const cached = await cache.match(event.request, { ignoreSearch: false });
      if (cached) {
        // Background refresh (stale-while-revalidate) so files can update over time
        event.waitUntil(
          (async () => {
            try {
              const res = await fetch(event.request);
              if (res && res.ok) await cache.put(event.request, res.clone());
            } catch {
              /* offline — keep stale */
            }
          })()
        );
        return cached;
      }
      try {
        const res = await fetch(event.request);
        if (res && res.ok) {
          await cache.put(event.request, res.clone());
        }
        return res;
      } catch (err) {
        const fallback = await cache.match(event.request);
        if (fallback) return fallback;
        throw err;
      }
    })()
  );
});
