const VERSION = "writer-v0-1-2026-07-05";
const STATIC_CACHE = `lassilab-writer-static-${VERSION}`;
const RUNTIME_CACHE = `lassilab-writer-runtime-${VERSION}`;
const APP_SHELL = [
  "/",
  "/index.html",
  "/manifest.webmanifest",
  "/icon.svg",
  "/icon-192.png",
  "/icon-512.png"
];

async function cacheShellAndBuildAssets() {
  const cache = await caches.open(STATIC_CACHE);
  await Promise.allSettled(APP_SHELL.map((url) => cache.add(url)));

  try {
    const response = await fetch("/index.html", { cache: "reload" });
    if (!response.ok) {
      return;
    }

    await cache.put("/index.html", response.clone());
    await cache.put("/", response.clone());

    const html = await response.text();
    const assets = [...html.matchAll(/(?:src|href)="([^"]+)"/g)]
      .map((match) => new URL(match[1], self.location.origin))
      .filter(
        (url) => url.origin === self.location.origin && url.pathname.startsWith("/assets/")
      )
      .map((url) => url.pathname);

    await Promise.allSettled([...new Set(assets)].map((url) => cache.add(url)));
  } catch {
    // The installed shell can still fall back to any previous cache.
  }
}

async function deleteOldCaches() {
  const keep = new Set([STATIC_CACHE, RUNTIME_CACHE]);
  const keys = await caches.keys();

  await Promise.all(
    keys
      .filter((key) => key.startsWith("lassilab-writer-") && !keep.has(key))
      .map((key) => caches.delete(key))
  );
}

async function networkFirst(request) {
  const cache = await caches.open(RUNTIME_CACHE);

  try {
    const response = await fetch(request);
    if (response.ok) {
      cache.put(request, response.clone());
    }
    return response;
  } catch {
    return (await caches.match(request)) || (await caches.match("/index.html"));
  }
}

async function cacheFirst(request) {
  const cached = await caches.match(request);
  if (cached) {
    return cached;
  }

  const response = await fetch(request);
  if (response.ok) {
    const cache = await caches.open(STATIC_CACHE);
    cache.put(request, response.clone());
  }
  return response;
}

self.addEventListener("install", (event) => {
  event.waitUntil(cacheShellAndBuildAssets());
});

self.addEventListener("activate", (event) => {
  event.waitUntil(deleteOldCaches().then(() => self.clients.claim()));
});

self.addEventListener("fetch", (event) => {
  if (event.request.method !== "GET") {
    return;
  }

  const url = new URL(event.request.url);
  if (url.origin !== self.location.origin) {
    return;
  }

  if (event.request.mode === "navigate") {
    event.respondWith(networkFirst(event.request));
    return;
  }

  if (url.pathname.startsWith("/assets/") || APP_SHELL.includes(url.pathname)) {
    event.respondWith(cacheFirst(event.request));
  }
});
