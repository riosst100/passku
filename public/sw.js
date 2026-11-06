const CACHE_NAME = "passku-shell-v5";
const SHELL_URLS = ["/", "/manifest.json", "/icon.svg"];

self.addEventListener("install", (event) => {
  event.waitUntil(caches.open(CACHE_NAME).then((cache) => cache.addAll(SHELL_URLS)));
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k)))
    )
  );
  self.clients.claim();
});

self.addEventListener("fetch", (event) => {
  const req = event.request;
  if (req.method !== "GET") return;

  const url = new URL(req.url);

  // API responses change on every login/sync — always go to the network so
  // a stale cached response never masks fresh credentials data. If offline,
  // the app's own IndexedDB cache (not this service worker) is the fallback.
  if (url.pathname.startsWith("/api/")) {
    event.respondWith(fetch(req));
    return;
  }

  // Everything else (the HTML shell, hashed _next/ JS/CSS, icons, manifest)
  // is safe to cache: stale-while-revalidate serves the last-known-good copy
  // instantly (works offline) while updating the cache in the background for
  // next time. Each deploy's hashed filenames mean an old cached chunk simply
  // stops being requested once the new HTML ships, so nothing goes stale in
  // a way that breaks the page.
  event.respondWith(
    caches.match(req).then((cached) => {
      const network = fetch(req)
        .then((response) => {
          if (response.ok) {
            const clone = response.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(req, clone));
          }
          return response;
        })
        .catch(() => cached);
      return cached || network;
    })
  );
});
