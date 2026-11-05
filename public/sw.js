"use strict";

const CACHE_VERSION = "shard-v9";
const STATIC_SHELL = [
  "./",
  "./index.html",
  "./logo.png",
  "./manifest.json",
  "./favicon.ico",
  "./icons/icon-192.png",
  "./icons/icon-512.png",
  "./icons/icon-maskable-512.png"
];

async function precacheConfig(cache) {
  try {
    const indexUrl = new URL("./config/index.json", self.location.href);
    const response = await fetch(indexUrl, { cache: "reload" });
    if (!response.ok) return;
    await cache.put(indexUrl, response.clone());
    const index = await response.json();
    const paths = [];

    for (const value of Object.values(index.core || {})) paths.push(value);
    for (const [directory, files] of Object.entries(index.entities || {})) {
      for (const file of files || []) paths.push(`${directory}/${file}`);
    }
    for (const value of Object.values(index.rules || {})) paths.push(`rules/${value}`);

    await Promise.all(
      paths.map((path) => {
        const url = new URL(`./config/${path}`, self.location.href);
        return cache.add(url).catch(() => undefined);
      })
    );
  } catch {
    // Config remains runtime-loaded; offline caching will retry on the next visit.
  }
}

async function networkFirst(request) {
  const cache = await caches.open(CACHE_VERSION);
  try {
    const response = await fetch(request, { cache: "no-store" });
    if (response.ok) {
      await cache.put(request, response.clone());
    }
    return response;
  } catch {
    return (
      (await cache.match(request)) ||
      new Response("", { status: 503, statusText: "Offline" })
    );
  }
}

async function precacheAppShell() {
  const cache = await caches.open(CACHE_VERSION);

  await Promise.all(
    STATIC_SHELL.map((url) => cache.add(url).catch(() => undefined))
  );
  await precacheConfig(cache);

  try {
    const indexResponse = await fetch("./index.html", { cache: "reload" });
    if (!indexResponse.ok) return;
    await cache.put("./index.html", indexResponse.clone());

    const html = await indexResponse.text();
    const indexPath = new URL("./index.html", self.location.href);
    // Hashed Vite scripts (replaces the old wasm-loader scan).
    const scriptUrls = [...html.matchAll(/<script[^>]+src=["']([^"']+)["']/g)]
      .map((match) => new URL(match[1], indexPath).href);
    // Hashed Vite stylesheets: src/styles.css is bundled, not a static file.
    const styleUrls = [
      ...html.matchAll(/<link[^>]+rel=["']stylesheet["'][^>]*href=["']([^"']+)["']/g),
      ...html.matchAll(/<link[^>]+href=["']([^"']+)["'][^>]*rel=["']stylesheet["']/g),
    ].map((match) => new URL(match[1], indexPath).href);

    for (const assetUrl of new Set([...scriptUrls, ...styleUrls])) {
      try {
        const assetResponse = await fetch(assetUrl, { cache: "reload" });
        if (assetResponse.ok) {
          await cache.put(assetUrl, assetResponse);
        }
      } catch {
        // Keep the static shell even if a hashed asset could not be cached yet.
      }
    }
  } catch {
    // Keep the static shell even if the hashed app bundle could not be cached yet.
  }
}

self.addEventListener("install", (event) => {
  event.waitUntil(
    (async () => {
      await precacheAppShell();
      await self.skipWaiting();
    })()
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      const keys = await caches.keys();
      await Promise.all(
        keys
          .filter((key) => key !== CACHE_VERSION)
          .map((key) => caches.delete(key))
      );
      await self.clients.claim();
    })()
  );
});

self.addEventListener("message", (event) => {
  if (event.data && event.data.type === "CACHE_SHELL") {
    event.waitUntil(precacheAppShell());
  }
});

self.addEventListener("fetch", (event) => {
  const request = event.request;
  if (request.method !== "GET") return;

  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;

  const configPrefix = new URL("./config/", self.location.href).pathname;
  if (url.pathname.startsWith(configPrefix)) {
    event.respondWith(networkFirst(request));
    return;
  }

  if (request.mode === "navigate") {
    event.respondWith(
      (async () => {
        try {
          const response = await fetch(request);
          const cache = await caches.open(CACHE_VERSION);
          await cache.put("./index.html", response.clone());
          return response;
        } catch {
          return (
            (await caches.match(request)) ||
            (await caches.match("./index.html")) ||
            (await caches.match("./")) ||
            new Response("Shard is offline and the app shell is not cached yet.", {
              status: 503,
              headers: { "Content-Type": "text/plain; charset=utf-8" }
            })
          );
        }
      })()
    );
    return;
  }

  event.respondWith(
    (async () => {
      const cached = await caches.match(request);
      if (cached) {
        event.waitUntil(
          fetch(request)
            .then(async (response) => {
              if (response.ok) {
                const cache = await caches.open(CACHE_VERSION);
                await cache.put(request, response.clone());
              }
            })
            .catch(() => undefined)
        );
        return cached;
      }

      try {
        const response = await fetch(request);
        if (response.ok) {
          const cache = await caches.open(CACHE_VERSION);
          await cache.put(request, response.clone());
        }
        return response;
      } catch {
        return new Response("", { status: 503 });
      }
    })()
  );
});
