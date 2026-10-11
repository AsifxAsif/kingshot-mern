/**
 * Kingshot PWA service worker
 * - Caches app shell (HTML + JS/CSS) so reload works offline
 * - Caches game images/fonts
 * - API calls are network-only (app uses localStorage offline queue)
 */
const SHELL_CACHE = 'kingshot-shell-v1';
const ASSET_CACHE = 'kingshot-assets-v5';
const SHELL_URLS = ['/', '/index.html', '/manifest.webmanifest'];

const ASSET_RE = /\.(webp|png|jpg|jpeg|gif|svg|ico|woff2?|ttf|otf)(\?.*)?$/i;
const CODE_RE = /\.(js|css|mjs)(\?.*)?$/i;

function sameOrigin(url) {
  try {
    return new URL(url).origin === self.location.origin;
  } catch {
    return false;
  }
}

self.addEventListener('install', (event) => {
  self.skipWaiting();
  event.waitUntil(
    (async () => {
      const cache = await caches.open(SHELL_CACHE);
      for (const u of SHELL_URLS) {
        try {
          const res = await fetch(u, { cache: 'no-cache' });
          if (res && res.ok) await cache.put(u, res.clone());
        } catch {
          /* first install may be offline */
        }
      }
    })()
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    (async () => {
      const keep = new Set([SHELL_CACHE, ASSET_CACHE]);
      const keys = await caches.keys();
      await Promise.all(keys.filter((k) => !keep.has(k)).map((k) => caches.delete(k)));
      await self.clients.claim();
    })()
  );
});

async function cachePut(cacheName, request, response) {
  if (!response || !response.ok) return response;
  try {
    const cache = await caches.open(cacheName);
    await cache.put(request, response.clone());
  } catch {
    /* quota */
  }
  return response;
}

async function networkFirstShell(request) {
  const cache = await caches.open(SHELL_CACHE);
  try {
    const res = await fetch(request);
    if (res && res.ok) {
      await cache.put(request, res.clone());
      // Also store as /index.html for SPA fallback
      if (request.mode === 'navigate') {
        try {
          await cache.put('/index.html', res.clone());
          await cache.put('/', res.clone());
        } catch {
          /* */
        }
      }
      return res;
    }
  } catch {
    /* offline */
  }
  const cached =
    (await cache.match(request)) ||
    (await cache.match('/index.html')) ||
    (await cache.match('/'));
  if (cached) return cached;
  return new Response(
    '<!DOCTYPE html><html><head><meta charset="utf-8"><title>Offline</title></head><body style="font-family:system-ui;padding:2rem;background:#12141a;color:#eee"><h1>You are offline</h1><p>Open the app once while online so it can be cached for offline use.</p></body></html>',
    { status: 503, headers: { 'Content-Type': 'text/html; charset=utf-8' } }
  );
}

async function staleWhileRevalidate(request, cacheName) {
  const cache = await caches.open(cacheName);
  const cached = await cache.match(request);
  const networkPromise = fetch(request)
    .then((res) => {
      if (res && res.ok) cache.put(request, res.clone()).catch(() => {});
      return res;
    })
    .catch(() => null);
  if (cached) {
    networkPromise.catch(() => {});
    return cached;
  }
  const res = await networkPromise;
  if (res) return res;
  throw new Error('offline and uncached');
}

self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') return;

  let url;
  try {
    url = new URL(event.request.url);
  } catch {
    return;
  }

  // Never cache API — app handles offline data itself
  if (url.pathname.startsWith('/api/')) return;

  // Cross-origin: only try cache for known CDNs we might have stored (skip by default)
  if (url.origin !== self.location.origin) return;

  // HTML navigations → network first, fallback to cached shell
  if (
    event.request.mode === 'navigate' ||
    (event.request.headers.get('accept') || '').includes('text/html')
  ) {
    event.respondWith(networkFirstShell(event.request));
    return;
  }

  // Built JS/CSS modules
  if (CODE_RE.test(url.pathname) || url.pathname.startsWith('/assets/')) {
    event.respondWith(
      staleWhileRevalidate(event.request, SHELL_CACHE).catch(async () => {
        const cache = await caches.open(SHELL_CACHE);
        const hit = await cache.match(event.request);
        if (hit) return hit;
        return new Response('', { status: 503, statusText: 'Offline' });
      })
    );
    return;
  }

  // Images / fonts
  if (ASSET_RE.test(url.pathname) || url.pathname.startsWith('/assets/')) {
    event.respondWith(
      staleWhileRevalidate(event.request, ASSET_CACHE).catch(async () => {
        const cache = await caches.open(ASSET_CACHE);
        const hit = await cache.match(event.request);
        if (hit) return hit;
        return new Response('', { status: 503 });
      })
    );
  }
});

// Allow page to ask SW to precache a list of URLs (after first online visit)
self.addEventListener('message', (event) => {
  const data = event.data;
  if (!data || data.type !== 'PRECACHE') return;
  const urls = Array.isArray(data.urls) ? data.urls : [];
  event.waitUntil(
    (async () => {
      const shell = await caches.open(SHELL_CACHE);
      const assets = await caches.open(ASSET_CACHE);
      for (const u of urls) {
        try {
          const res = await fetch(u, { cache: 'no-cache' });
          if (!res || !res.ok) continue;
          const path = new URL(u, self.location.origin).pathname;
          if (ASSET_RE.test(path)) await assets.put(u, res.clone());
          else await shell.put(u, res.clone());
        } catch {
          /* */
        }
      }
    })()
  );
});
