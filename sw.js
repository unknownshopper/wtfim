/* Service worker de WTFIM: cache-first para la app shell.
   Sube CACHE_VERSION cuando cambien los archivos estáticos. */
const CACHE = "wtfim-v4";
const ASSETS = [
  "./",
  "index.html",
  "styles.css",
  "app.js",
  "config.js",
  "icon.svg",
  "icon-192.png",
  "icon-512.png",
  "manifest.webmanifest",
];

self.addEventListener("install", e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(ASSETS)));
  self.skipWaiting();
});

self.addEventListener("activate", e => {
  e.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k))))
  );
  self.clients.claim();
});

self.addEventListener("fetch", e => {
  // La API de Supabase siempre va a la red (datos vivos)
  if (e.request.url.includes("supabase.co")) return;
  if (e.request.method !== "GET") return;
  // Network-first: versión nueva si hay red, caché si estás offline
  e.respondWith(
    fetch(e.request)
      .then(res => {
        const copy = res.clone();
        caches.open(CACHE).then(c => c.put(e.request, copy));
        return res;
      })
      .catch(() => caches.match(e.request).then(hit => hit || caches.match("index.html")))
  );
});
