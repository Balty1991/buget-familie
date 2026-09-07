const CACHE = "buget-familie-shell-v40";

const SHELL = ["./manifest.webmanifest", "./bf-favicon.svg", "./icons/favicon-32.png", "./icons/icon-192.png"];

self.addEventListener("install", (event) => {
  event.waitUntil(caches.open(CACHE).then((cache) => cache.addAll(SHELL)).then(() => self.skipWaiting()));
});

self.addEventListener("activate", (event) => {
  event.waitUntil(caches.keys().then((keys) => Promise.all(keys.filter((key) => key !== CACHE).map((key) => caches.delete(key)))).then(() => self.clients.claim()));
});

self.addEventListener("message", (event) => {
  if (event.data === "SKIP_WAITING" || event.data?.type === "SKIP_WAITING") self.skipWaiting();
});

self.addEventListener("fetch", (event) => {
  const request = event.request;
  const url = new URL(request.url);
  if (request.method !== "GET" || url.origin !== self.location.origin || url.pathname.includes("/api/") || url.pathname.includes("github")) return;

  if (request.mode === "navigate" || request.destination === "document" || url.pathname.endsWith("/") || url.pathname.endsWith(".html")) {
    event.respondWith(fetch(request, { cache: "reload" }).catch(() => caches.match("./")));
    return;
  }

  const hashed = /\/assets\/.+\.[A-Za-z0-9_-]{8,}\.(js|css)$/.test(url.pathname) || /\.(woff2?|png|svg|webp|jpg)$/.test(url.pathname);
  if (hashed) {
    event.respondWith(fetch(request).then((response) => {
      if (response.ok) {
        const copy = response.clone();
        void caches.open(CACHE).then((cache) => cache.put(request, copy));
      }
      return response;
    }).catch(() => caches.match(request)));
    return;
  }

  event.respondWith(fetch(request).then((response) => {
    if (response.ok) {
      const copy = response.clone();
      void caches.open(CACHE).then((cache) => cache.put(request, copy));
    }
    return response;
  }).catch(() => caches.match(request)));
});
