// Service Worker — CPP Roteiro de Policiamento (offline-first)
// BASE é derivado da própria URL do SW, então funciona tanto em "/" (dev)
// quanto em "/roteiro-policiamento/" (GitHub Pages). Antes os caminhos eram
// absolutos ("/", "/index.html"...) e davam 404 em produção, fazendo o
// cache.addAll falhar e o SW nunca ativar.
const CACHE_NAME = "cpp-patrulha-v2";
const BASE = new URL("./", self.location).pathname; // ex: "/roteiro-policiamento/"
const ASSETS_TO_CACHE = [
  BASE,
  `${BASE}index.html`,
  `${BASE}manifest.json`,
  `${BASE}icon.svg`,
];

// Install: precache resiliente — uma URL ausente não invalida o SW inteiro.
self.addEventListener("install", (e) => {
  e.waitUntil(
    caches.open(CACHE_NAME).then(async (cache) => {
      await Promise.allSettled(ASSETS_TO_CACHE.map((url) => cache.add(url)));
      await self.skipWaiting();
    })
  );
});

// Activate: limpa caches antigos (inclui o "cpp-patrulha-v1" quebrado).
self.addEventListener("activate", (e) => {
  e.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys.map((key) => {
          if (key !== CACHE_NAME && key !== "osm-tiles") {
            return caches.delete(key);
          }
        })
      );
    }).then(() => self.clients.claim())
  );
});

// Fetch: cache-first/stale-while-revalidate para tiles OSM e assets locais.
self.addEventListener("fetch", (e) => {
  const url = new URL(e.request.url);

  // Tiles do OpenStreetMap: cache-first com refresh em background.
  if (url.host.includes("tile.openstreetmap.org")) {
    e.respondWith(
      caches.open("osm-tiles").then((cache) => {
        return cache.match(e.request).then((cachedResponse) => {
          if (cachedResponse) {
            fetch(e.request).then((networkResponse) => {
              if (networkResponse.status === 200) {
                cache.put(e.request, networkResponse);
              }
            }).catch(() => {/* offline: mantém o cache */});
            return cachedResponse;
          }
          return fetch(e.request).then((networkResponse) => {
            if (networkResponse.status === 200) {
              cache.put(e.request, networkResponse.clone());
            }
            return networkResponse;
          });
        });
      })
    );
    return;
  }

  // App local (mesma origem): stale-while-revalidate para carregamento rápido offline.
  if (url.origin === self.location.origin) {
    e.respondWith(
      caches.match(e.request).then((cachedResponse) => {
        if (cachedResponse) {
          fetch(e.request).then((networkResponse) => {
            if (networkResponse.status === 200) {
              caches.open(CACHE_NAME).then((cache) => cache.put(e.request, networkResponse));
            }
          }).catch(() => {/* offline */});
          return cachedResponse;
        }

        return fetch(e.request).then((networkResponse) => {
          if (networkResponse && networkResponse.status === 200) {
            const responseClone = networkResponse.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(e.request, responseClone));
          }
          return networkResponse;
        });
      })
    );
    return;
  }
});

self.addEventListener("notificationclick", (e) => {
  e.notification.close();
  e.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((clients) => {
      for (const client of clients) {
        if ("focus" in client) return client.focus();
      }
      if (self.clients.openWindow) return self.clients.openWindow(BASE);
      return undefined;
    })
  );
});
