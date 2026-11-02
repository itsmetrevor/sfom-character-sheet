"use strict";

const CACHE_VERSION = "shard-v4";
const STATIC_SHELL = [
  "./",
  "./index.html",
  "./main.css",
  "./manifest.json",
  "./favicon.ico",
  "./icons/icon-192.png",
  "./icons/icon-512.png",
  "./icons/icon-maskable-512.png"
];

async function precacheAppShell() {
  const cache = await caches.open(CACHE_VERSION);

  await Promise.all(
    STATIC_SHELL.map((url) => cache.add(url).catch(() => undefined))
  );

  try {
    const indexResponse = await fetch("./index.html", { cache: "reload" });
    if (!indexResponse.ok) return;
    await cache.put("./index.html", indexResponse.clone());

    const html = await indexResponse.text();
    const indexPath = new URL("./index.html", self.location.href);
    const scriptUrls = [...html.matchAll(/<script[^>]+src=["']([^"']+)["']/g)]
      .map((match) => new URL(match[1], indexPath).href);

    for (const scriptUrl of scriptUrls) {
      const scriptResponse = await fetch(scriptUrl, { cache: "reload" });
      if (!scriptResponse.ok) continue;
      await cache.put(scriptUrl, scriptResponse.clone());

      const script = await scriptResponse.text();
      const wasmUrls = [...script.matchAll(/["']([^"']+\.wasm)["']/g)]
        .map((match) => new URL(match[1], scriptUrl).href);

      for (const wasmUrl of new Set(wasmUrls)) {
        try {
          const wasmResponse = await fetch(wasmUrl, { cache: "reload" });
          if (wasmResponse.ok) {
            await cache.put(wasmUrl, wasmResponse);
          }
        } catch {
          // A relative wasm string in the loader may not be a real URL.
        }
      }
    }
  } catch {
    // Keep the static shell even if the hashed app binary could not be cached yet.
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
