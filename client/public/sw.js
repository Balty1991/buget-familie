const CACHE = "buget-familie-shell-v91";

const SHELL = ["./manifest.webmanifest", "./bf-favicon.svg", "./icons/favicon-32.png", "./icons/icon-192.png", "./icons/mark-240.webp", "./icons/notify-badge.png"];

const HASHED = /\/assets\/.+-[A-Za-z0-9_-]{8,}\.(js|css)$/;

/** Lista build-ului (precache.json, scrisă de Vite). Fără ea (server de dezvoltare), doar shell-ul. */
async function buildFiles() {
  try {
    const response = await fetch("./precache.json", { cache: "no-store" });
    if (!response.ok) return [];
    const body = await response.json();
    return Array.isArray(body.files) ? body.files : [];
  } catch {
    return [];
  }
}

self.addEventListener("install", (event) => {
  event.waitUntil((async () => {
    const cache = await caches.open(CACHE);
    await cache.addAll(SHELL);
    // P2-11: ecranele leneșe intră în cache de la început. Fiecare fișier pe cont propriu:
    // unul care lipsește nu oprește instalarea.
    const files = await buildFiles();
    await Promise.all(files.map((file) => cache.add(file).catch(() => undefined)));
    await self.skipWaiting();
  })());
});

self.addEventListener("activate", (event) => {
  event.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(keys.filter((key) => key !== CACHE).map((key) => caches.delete(key)));
    // Fișierele cu hash ale build-urilor vechi ies din cache (creștea cu ~1 MB la fiecare publicare).
    const files = await buildFiles();
    if (files.length) {
      const keep = new Set(files.map((file) => new URL(file, self.registration.scope).pathname));
      const cache = await caches.open(CACHE);
      const requests = await cache.keys();
      await Promise.all(requests.filter((request) => HASHED.test(new URL(request.url).pathname) && !keep.has(new URL(request.url).pathname)).map((request) => cache.delete(request)));
    }
    await self.clients.claim();
  })());
});

self.addEventListener("message", (event) => {
  if (event.data === "SKIP_WAITING" || event.data?.type === "SKIP_WAITING") self.skipWaiting();
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((windows) => {
      const existing = windows.find((client) => "focus" in client);
      if (existing) return existing.focus();
      if (self.clients.openWindow) return self.clients.openWindow("./");
      return undefined;
    }),
  );
});

self.addEventListener("fetch", (event) => {
  const request = event.request;
  const url = new URL(request.url);
  if (request.method !== "GET" || url.origin !== self.location.origin || url.pathname.includes("/api/") || url.pathname.includes("github")) return;

  const hashed = HASHED.test(url.pathname) || /\.woff2?$/.test(url.pathname);
  if (hashed) {
    event.respondWith(caches.match(request).then((cached) => cached || fetch(request).then((response) => {
      if (response.ok) {
        const copy = response.clone();
        void caches.open(CACHE).then((cache) => cache.put(request, copy));
      }
      return response;
    })));
    return;
  }

  if (request.mode === "navigate" || request.destination === "document" || url.pathname.endsWith("/") || url.pathname.endsWith(".html")) {
    event.respondWith((async () => {
      const cache = await caches.open(CACHE);
      const cached = await cache.match(request);
      const network = fetch(request).then((response) => {
        if (!response.ok) throw new Error("offline-shell");
        void cache.put(request, response.clone());
        return response;
      });
      if (!cached) return network.catch(() => caches.match("./"));
      // Rețeaua întâi, cache-ul doar dacă întârzie peste 3 s sau lipsește. Cu 0,5 s, pe date mobile
      // pagina venea aproape mereu din cache: după o publicare, telefonul rămânea o versiune în urmă.
      return Promise.race([
        network.catch(() => cached),
        new Promise((resolve) => setTimeout(() => resolve(cached), 3000)),
      ]);
    })());
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
