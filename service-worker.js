const CACHE_NAME = "threadborn-static-v33";
const CORE_ASSETS = [
  "./",
  "./runtime-config.js",
  "./manifest.json",
  "./global.css?v=32"
  "./assets/threadborn-logo-en-new.png",
  "./assets/threadborn-logo-jp-new.png",
  "./assets/threadborn-logo.png",
  "./assets/threadborn-logo-en.png",
  "./assets/threadborn-logo-jp.png",
  "./assets/phase1-client.js?v=32"
  "./assets/threadborn-app-icon.png",
  "./assets/threadborn-icon-192.png",
  "./assets/threadborn-icon-512.png",
  "./assets/threadborn-favicon.png",
  "./assets/threadborn-favicon-jp.png",
  "./assets/threadborn-apple-touch.png",
  "./assets/threadborn-og-en.png",
  "./assets/threadborn-og-jp.png",
];

self.addEventListener("install", (event) => {
  self.skipWaiting();
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(CORE_ASSETS)),
  );
});

self.addEventListener("message", (event) => {
  if (event.data && event.data.action === "skipWaiting") {
    self.skipWaiting();
  }
});

// Periodically check for SW updates in the background so clients
// always get the latest version without requiring a hard refresh
self.addEventListener("periodicsync", (event) => {
  if (event.tag === "sw-update-check") {
    event.waitUntil(self.registration.update());
  }
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys
            .filter((key) => key !== CACHE_NAME)
            .map((key) => caches.delete(key)),
        ),
      )
      .then(() => self.clients.claim()),
  );
});

self.addEventListener("fetch", (event) => {
  if (event.request.method !== "GET") {
    return;
  }

  // Never cache API responses — they contain dynamic data that must always be fresh
  const requestUrl = new URL(event.request.url);
  if (requestUrl.pathname.startsWith("/api/")) {
    event.respondWith(
      fetch(event.request).catch(
        () =>
          new Response(
            JSON.stringify({ success: false, error: "You are offline" }),
            { status: 503, headers: { "Content-Type": "application/json" } },
          ),
      ),
    );
    return;
  }

  const isNavigation = event.request.mode === "navigate";
  const isHtmlRequest = event.request.headers.get("accept")?.includes("text/html");

  // Always try the network first for everything to prevent stale cache issues
  // Falls back to cache only when offline
  event.respondWith(
    fetch(event.request)
      .then((response) => {
        if (response && response.status === 200 && response.type === "basic") {
          const clone = response.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(event.request, clone));
        }
        return response;
      })
      .catch(() => {
        return caches.match(event.request).then((cached) => {
          if (cached) {
            return cached;
          }
          // If offline and the request is for HTML, return the cached index.html
          if (isNavigation || isHtmlRequest) {
            return caches.match("./index.html");
          }
          return undefined;
        });
      }),
  );
});

// ── Native Push Notifications ─────────────────────────────────────────────────
self.addEventListener("push", (event) => {
  if (!event.data) return;
  let data = {};
  try { data = event.data.json(); } catch (_) { data = { title: "Threadborn", body: event.data.text() }; }

  event.waitUntil(
    self.registration.showNotification(data.title || "Threadborn", {
      body: data.body || "",
      icon: "./assets/threadborn-icon-192.png",
      badge: "./assets/threadborn-favicon.png",
      tag: data.tag || "threadborn",
      renotify: true,
      data: { url: data.url || "./" },
      vibrate: [100, 50, 100],
    })
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const url = event.notification.data?.url || "./";
  event.waitUntil(
    clients
      .matchAll({ type: "window", includeUncontrolled: true })
      .then((list) => {
        for (const client of list) {
          if ("focus" in client) return client.focus();
        }
        return clients.openWindow(url);
      })
  );
});
