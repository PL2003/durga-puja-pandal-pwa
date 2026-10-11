/* Pandal Hop service worker
 * Strategy:
 *  - App shell (same origin, incl. navigations): network-first, cache fallback (kept fresh, works offline).
 *  - Map tiles (openstreetmap / carto basemaps): stale-while-revalidate with an entry cap.
 *  - Google Sheets endpoints: network-only. Freshness + privacy are handled by the sync engine.
 */
const VERSION = "v1";
const SHELL = `ph-shell-${VERSION}`;
const TILES = `ph-tiles-${VERSION}`;
const TILE_CAP = 450;

const TILE_HOSTS = [
  "tile.openstreetmap.org",
  "a.basemaps.cartocdn.com",
  "b.basemaps.cartocdn.com",
  "c.basemaps.cartocdn.com",
  "d.basemaps.cartocdn.com",
  "basemaps.cartocdn.com",
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(SHELL)
      .then((cache) => cache.addAll(["/", "/manifest.webmanifest"]))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      const keys = await caches.keys();
      await Promise.all(
        keys.filter((k) => k !== SHELL && k !== TILES).map((k) => caches.delete(k))
      );
      await self.clients.claim();
    })()
  );
});

async function trimCache(name, max) {
  try {
    const cache = await caches.open(name);
    const keys = await cache.keys();
    if (keys.length > max) {
      await Promise.all(keys.slice(0, keys.length - max).map((k) => cache.delete(k)));
    }
  } catch (_) {
    /* best effort */
  }
}

self.addEventListener("fetch", (event) => {
  const req = event.request;
  if (req.method !== "GET") return;

  const url = new URL(req.url);

  // Never intercept spreadsheet sync traffic.
  if (
    url.hostname.includes("docs.google.com") ||
    url.hostname.includes("sheets.googleapis.com")
  ) {
    return;
  }

  // Map tiles: stale-while-revalidate.
  if (TILE_HOSTS.some((h) => url.hostname === h || url.hostname.endsWith("." + h))) {
    event.respondWith(
      (async () => {
        const cache = await caches.open(TILES);
        const cached = await cache.match(req);
        const network = fetch(req)
          .then((res) => {
            if (res && res.ok) {
              cache.put(req, res.clone());
              trimCache(TILES, TILE_CAP);
            }
            return res;
          })
          .catch(() => cached);
        return cached || network;
      })()
    );
    return;
  }

  // App shell & same-origin assets: network-first, cache fallback.
  if (url.origin === self.location.origin) {
    if (req.mode === "navigate") {
      event.respondWith(
        (async () => {
          try {
            const res = await fetch(req);
            const cache = await caches.open(SHELL);
            cache.put("/", res.clone());
            return res;
          } catch (_) {
            const cache = await caches.open(SHELL);
            return (await cache.match("/")) || (await cache.match("/index.html"));
          }
        })()
      );
      return;
    }
    event.respondWith(
      (async () => {
        const cache = await caches.open(SHELL);
        const cached = await cache.match(req);
        if (cached) return cached;
        try {
          const res = await fetch(req);
          if (res && res.ok && (url.protocol === "https:" || url.hostname === "localhost")) {
            cache.put(req, res.clone());
          }
          return res;
        } catch (_) {
          return cached || Response.error();
        }
      })()
    );
  }
});
