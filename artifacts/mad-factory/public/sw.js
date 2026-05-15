// Mad Factory service worker — offline-first v4
// Caches: static assets + all API GET responses (stale-while-revalidate)
const CACHE_VERSION = "mad-factory-v4";
const APP_SHELL = ["/", "/manifest.json", "/favicon.svg"];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(CACHE_VERSION)
      .then((cache) => cache.addAll(APP_SHELL))
      .catch(() => {})
  );
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      const keys = await caches.keys();
      await Promise.all(
        keys.filter((k) => k !== CACHE_VERSION).map((k) => caches.delete(k))
      );
      await self.clients.claim();
    })()
  );
});

self.addEventListener("message", (event) => {
  if (event.data && event.data.type === "SKIP_WAITING") {
    self.skipWaiting();
  }
});

function isApiGet(request) {
  if (request.method !== "GET") return false;
  const url = new URL(request.url);
  return url.pathname.includes("/api/") || url.port === "8080";
}

function isStaticAsset(url) {
  return (
    url.pathname.startsWith("/assets/") ||
    url.pathname.endsWith(".js") ||
    url.pathname.endsWith(".css") ||
    url.pathname.endsWith(".woff2") ||
    url.pathname.endsWith(".woff") ||
    url.pathname.endsWith(".svg") ||
    url.pathname.endsWith(".png") ||
    url.pathname.endsWith(".jpg") ||
    url.pathname.endsWith(".ico")
  );
}

// Stale-While-Revalidate helper
async function swr(event, cacheName) {
  const cache = await caches.open(cacheName);
  const cached = await cache.match(event.request);

  const network = fetch(event.request)
    .then((res) => {
      if (res && res.ok && (res.type === "basic" || res.type === "cors")) {
        cache.put(event.request, res.clone()).catch(() => {});
      }
      return res;
    })
    .catch(() => cached);

  return cached || network;
}

self.addEventListener("fetch", (event) => {
  const req = event.request;
  const url = new URL(req.url);

  // Only handle same-origin + API calls (same host, different port handled below)
  const isSameHost =
    url.hostname === self.location.hostname ||
    url.port === "8080";

  if (!isSameHost) return;

  // Non-GET (POST/PUT/PATCH/DELETE) — never cache, pass through directly
  if (req.method !== "GET") return;

  // API GET — stale-while-revalidate so data is available offline
  if (isApiGet(req)) {
    // Never cache auth endpoints (login state must be live)
    if (
      url.pathname.includes("/api/auth/login") ||
      url.pathname.includes("/api/auth/logout")
    ) {
      return;
    }
    event.respondWith(swr(event, CACHE_VERSION));
    return;
  }

  // SPA navigation — return cached shell when offline
  if (req.mode === "navigate") {
    event.respondWith(
      fetch(req).catch(() =>
        caches.match("/").then((c) => c || Response.error())
      )
    );
    return;
  }

  // Static assets — stale-while-revalidate
  if (isStaticAsset(url)) {
    event.respondWith(swr(event, CACHE_VERSION));
    return;
  }

  // Everything else — network with cache fallback
  event.respondWith(
    caches.open(CACHE_VERSION).then(async (cache) => {
      try {
        const res = await fetch(req);
        if (res.ok && res.type === "basic") {
          cache.put(req, res.clone()).catch(() => {});
        }
        return res;
      } catch {
        return (await cache.match(req)) || Response.error();
      }
    })
  );
});
