const CACHE = "buget-familie-shell-v22";

const SHELL = ["./", "./manifest.webmanifest", "./icons/favicon-32.png", "./icons/icon-192.png", "./icons/icon-512.png"];

self.addEventListener("install", (event) => {
  event.waitUntil(caches.open(CACHE).then((cache) => cache.addAll(SHELL)).then(() => self.skipWaiting()));
});

self.addEventListener("activate", (event) => {
  event.waitUntil(caches.keys().then((keys) => Promise.all(keys.filter((key) => key !== CACHE).map((key) => caches.delete(key)))).then(() => self.clients.claim()));
});

self.addEventListener("fetch", (event) => {
  const request = event.request;
  const url = new URL(request.url);
  if (request.method !== "GET" || url.origin !== self.location.origin || url.pathname.includes("/api/") || url.pathname.includes("github")) return;

  const hashed = /\/assets\/.+\.[A-Za-z0-9_-]{8,}\.(js|css)$/.test(url.pathname) || /\.(woff2?|png|svg|webp|jpg)$/.test(url.pathname);
  if (hashed) {
    event.respondWith(caches.match(request).then((cached) => {
      const networked = fetch(request).then((response) => {
        if (response.ok) {
          const copy = response.clone();
          void caches.open(CACHE).then((cache) => cache.put(request, copy));
        }
        return response;
      }).catch(() => cached);
      return cached || networked;
    }));
    return;
  }

  event.respondWith(fetch(request).then((response) => {
    if (response.ok) {
      const copy = response.clone();
      void caches.open(CACHE).then((cache) => cache.put(request, copy));
    }
    return response;
  }).catch(() => caches.match(request).then((cached) => cached || caches.match("./"))));
});
