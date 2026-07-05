/* ISA service worker — offline caching + push notifications */

const VERSION = "isa-v2";
const STATIC_CACHE = `${VERSION}-static`;
const RUNTIME_CACHE = `${VERSION}-runtime`;

// App-shell essentials precached on install so the app boots offline.
const PRECACHE = [
  "/",
  "/manifest.json",
  "/icons/notification-icon-192.png",
  "/icons/icon-512.png",
  "/icons/badge-72.png",
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(STATIC_CACHE)
      .then((cache) => cache.addAll(PRECACHE))
      .then(() => self.skipWaiting())
      .catch(() => {})
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys.filter((k) => !k.startsWith(VERSION)).map((k) => caches.delete(k))
        )
      )
      .then(() => self.clients.claim())
  );
});

function isStaticAsset(url) {
  return (
    url.pathname.startsWith("/_next/static/") ||
    url.pathname.startsWith("/icons/") ||
    /\.(?:css|js|woff2?|png|jpe?g|svg|ico|webp)$/.test(url.pathname)
  );
}

self.addEventListener("fetch", (event) => {
  const req = event.request;
  if (req.method !== "GET") return;

  const url = new URL(req.url);

  // Only same-origin — let Supabase/Strava/other origins hit the network directly.
  if (url.origin !== self.location.origin) return;
  // Never cache dynamic API responses.
  if (url.pathname.startsWith("/api/")) return;

  // Full-page navigations: network-first (fresh when online),
  // fall back to the cached page, then to the app shell "/".
  if (req.mode === "navigate") {
    event.respondWith(
      fetch(req)
        .then((res) => {
          const copy = res.clone();
          caches
            .open(RUNTIME_CACHE)
            .then((c) => c.put(req, copy))
            .catch(() => {});
          return res;
        })
        .catch(() =>
          caches.match(req).then((cached) => cached || caches.match("/"))
        )
    );
    return;
  }

  // Hashed static assets: stale-while-revalidate.
  if (isStaticAsset(url)) {
    event.respondWith(
      caches.match(req).then((cached) => {
        const network = fetch(req)
          .then((res) => {
            const copy = res.clone();
            caches
              .open(RUNTIME_CACHE)
              .then((c) => c.put(req, copy))
              .catch(() => {});
            return res;
          })
          .catch(() => cached);
        return cached || network;
      })
    );
  }
});

/* ── Push notifications ── */

self.addEventListener("push", (event) => {
  let data = {};
  try {
    data = event.data ? event.data.json() : {};
  } catch {
    data = {};
  }
  const title = data.title || "ISA";
  event.waitUntil(
    self.registration.showNotification(title, {
      body: data.body || "",
      icon: "/icons/notification-icon-192.png",
      badge: "/icons/badge-72.png",
      data: { url: data.url || "/" },
    })
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const url = (event.notification.data && event.notification.data.url) || "/";
  event.waitUntil(
    clients
      .matchAll({ type: "window", includeUncontrolled: true })
      .then((list) => {
        for (const c of list) {
          if (c.url.includes(url) && "focus" in c) return c.focus();
        }
        return clients.openWindow(url);
      })
  );
});
