/* Service Worker für Offline-Nutzung.
   - App-Hülle: network-first mit Cache-Fallback (Navigationen)
   - statische Assets: cache-first
   - Dokumente aus dem Speicher: cache-first ohne Signatur-Parameter
*/
const VERSION = "v1";
const SHELL_CACHE = `shell-${VERSION}`;
const ASSET_CACHE = `assets-${VERSION}`;
const DOC_CACHE = `docs-${VERSION}`;
const DOC_LIMIT = 30;

const SHELL_URLS = [
  "/",
  "/manifest.webmanifest",
  "/favicon.png",
  "/icon-192x192.png",
  "/icon-512x512.png",
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(SHELL_CACHE)
      .then((c) => Promise.allSettled(SHELL_URLS.map((u) => c.add(u))))
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys
            .filter((k) => ![SHELL_CACHE, ASSET_CACHE, DOC_CACHE].includes(k))
            .map((k) => caches.delete(k)),
        ),
      )
      .then(() => self.clients.claim()),
  );
});

self.addEventListener("message", (event) => {
  if (event.data === "SKIP_WAITING") self.skipWaiting();
});

async function trimCache(name, limit) {
  const cache = await caches.open(name);
  const keys = await cache.keys();
  if (keys.length <= limit) return;
  await Promise.all(keys.slice(0, keys.length - limit).map((k) => cache.delete(k)));
}

/** Signierte Speicher-URLs auf den reinen Pfad reduzieren, damit der Cache trifft. */
function docKey(url) {
  return new Request(`${url.origin}${url.pathname}`, { method: "GET" });
}

const isStorageUrl = (url) =>
  url.pathname.includes("/storage/v1/object/") || url.pathname.includes("/storage/v1/render/");

self.addEventListener("fetch", (event) => {
  const req = event.request;
  if (req.method !== "GET") return;

  const url = new URL(req.url);

  // Dokumente aus dem Speicher offline verfügbar halten
  if (isStorageUrl(url)) {
    event.respondWith(
      (async () => {
        const key = docKey(url);
        try {
          const res = await fetch(req);
          if (res.ok) {
            const cache = await caches.open(DOC_CACHE);
            await cache.put(key, res.clone());
            void trimCache(DOC_CACHE, DOC_LIMIT);
          }
          return res;
        } catch (err) {
          const hit = await caches.match(key);
          if (hit) return hit;
          throw err;
        }
      })(),
    );
    return;
  }

  if (url.origin !== self.location.origin) return;

  // Navigationen: erst Netz, sonst gecachte App-Hülle
  if (req.mode === "navigate") {
    event.respondWith(
      (async () => {
        try {
          const res = await fetch(req);
          const cache = await caches.open(SHELL_CACHE);
          cache.put("/", res.clone());
          return res;
        } catch {
          return (await caches.match("/")) ?? Response.error();
        }
      })(),
    );
    return;
  }

  // Statische Dateien: cache-first
  if (/\.(js|css|woff2?|png|jpg|jpeg|svg|webp|ico|json|wasm)$/i.test(url.pathname)) {
    event.respondWith(
      (async () => {
        const hit = await caches.match(req);
        if (hit) return hit;
        const res = await fetch(req);
        if (res.ok) {
          const cache = await caches.open(ASSET_CACHE);
          await cache.put(req, res.clone());
        }
        return res;
      })(),
    );
  }
});
