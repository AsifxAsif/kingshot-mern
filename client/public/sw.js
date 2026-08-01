/* Kingshot asset + app shell cache */
const CACHE = 'kingshot-v1';
const PRECACHE = ['/', '/index.html'];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE).then((cache) => cache.addAll(PRECACHE)).then(() => self.skipWaiting())
  );
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
  // Cache images and static assets aggressively
  const isAsset =
    url.pathname.startsWith('/assets/') ||
    /\.(webp|png|jpg|jpeg|gif|svg|woff2?|css|js)$/i.test(url.pathname);

  if (event.request.method !== 'GET') return;

  if (isAsset) {
    event.respondWith(
      caches.open(CACHE).then(async (cache) => {
        const cached = await cache.match(event.request);
        if (cached) return cached;
        try {
          const res = await fetch(event.request);
          if (res.ok) cache.put(event.request, res.clone());
          return res;
        } catch (e) {
          return cached || Response.error();
        }
      })
    );
    return;
  }

  // Network-first for API
  if (url.pathname.startsWith('/api/')) return;

  // App shell: network first, fallback cache
  event.respondWith(
    fetch(event.request)
      .then((res) => {
        const copy = res.clone();
        caches.open(CACHE).then((c) => c.put(event.request, copy));
        return res;
      })
      .catch(() => caches.match(event.request).then((r) => r || caches.match('/index.html')))
  );
});
