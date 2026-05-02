const CACHE_NAME = "threadborn-static-v32";
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
  const isHtmlRequest = event.request.headers
    .get("accept")
    ?.includes("text/html");

  // HTML is ALWAYS fetched from the network — never serve stale HTML from cache.
  // This ensures normal refreshes always get the latest deployed version.
  // Falls back to a cached copy only when completely offline.
  if (isNavigation || isHtmlRequest) {
    event.respondWith(
      fetch(event.request)
        .then((response) => response)
        .catch(() =>
          caches
            .match(event.request)
            .then((cached) => cached || caches.match("./index.html")),
        ),
    );
    return;
  }

  event.respondWith(
    caches.match(event.request).then((cached) => {
      if (cached) {
        return cached;
      }

      return fetch(event.request)
        .then((response) => {
          if (
            !response ||
            response.status !== 200 ||
            response.type !== "basic"
          ) {
            return response;
          }

          const clone = response.clone();
          caches
            .open(CACHE_NAME)
            .then((cache) => cache.put(event.request, clone));
          return response;
        })
        .catch(() => caches.match(event.request));
    }),
  );
});
