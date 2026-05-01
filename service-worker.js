const CACHE_NAME = "threadborn-static-v24";
const CORE_ASSETS = [
  "./",
  "./index.html",
  "./index-jp.html",
  "./login.html",
  "./login-jp.html",
  "./signup.html",
  "./signup-jp.html",
  "./profile.html",
  "./profile-jp.html",
  "./runtime-config.js",
  "./manifest.json",
  "./global.css?v=24",
  "./assets/threadborn-logo.png",
  "./assets/threadborn-logo-en.png",
  "./assets/threadborn-logo-en-header.png",
  "./assets/threadborn-logo-en-wide.png",
  "./assets/threadborn-logo-jp.png",
  "./assets/threadborn-logo-jp-header.png",
  "./assets/threadborn-logo-jp-wide.png",
  "./assets/threadborn-app-icon.png",
  "./assets/threadborn-icon-192.png",
  "./assets/threadborn-icon-512.png",
  "./assets/threadborn-favicon.png",
  "./assets/threadborn-favicon-jp.png",
  "./assets/threadborn-apple-touch.png",
  "./assets/threadborn-og-en.png",
  "./assets/threadborn-og-jp.png"
];

self.addEventListener("install", event => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => cache.addAll(CORE_ASSETS))
  );
});

self.addEventListener("message", event => {
  if (event.data && event.data.action === "skipWaiting") {
    self.skipWaiting();
  }
});

self.addEventListener("activate", event => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(key => key !== CACHE_NAME).map(key => caches.delete(key)))
    ).then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", event => {
  if (event.request.method !== "GET") {
    return;
  }

  const requestUrl = new URL(event.request.url);
  const isNavigation = event.request.mode === "navigate";
  const isHtmlRequest = event.request.headers.get("accept")?.includes("text/html");

  if (isNavigation || isHtmlRequest) {
    event.respondWith(
      fetch(event.request).then(response => {
        if (response && response.status === 200) {
          const clone = response.clone();
          caches.open(CACHE_NAME).then(cache => cache.put("./index.html", clone));
        }
        return response;
      }).catch(() => caches.match("./index.html"))
    );
    return;
  }

  event.respondWith(
    caches.match(event.request).then(cached => {
      if (cached) {
        return cached;
      }

      return fetch(event.request).then(response => {
        if (!response || response.status !== 200 || response.type !== "basic") {
          return response;
        }

        const clone = response.clone();
        caches.open(CACHE_NAME).then(cache => cache.put(event.request, clone));
        return response;
      }).catch(() => caches.match(event.request));
    })
  );
});
