// Passku is online-only: this service worker caches nothing. It exists so the app stays installable
// (PWA), and on activation it deletes the caches older versions created for offline use.
self.addEventListener("install", () => {
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});
