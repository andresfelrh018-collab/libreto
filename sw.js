/* Service worker de Libreto.
 *
 * Es una plantilla: al compilar (npm run build), vite.config.js reemplaza
 * __VERSION__ y __PRECACHE__ y lo publica como dist/sw.js.
 *
 * - Interfaz (HTML, JS, CSS, iconos): en caché → la app abre sin conexión.
 * - catalog.json y subtítulos: primero la red; si falla, la copia guardada.
 * - Fuentes de Google: caché (no cambian).
 * - Videos e imágenes de Commons / Internet Archive: NO se tocan ni se guardan.
 */
const VERSION = '__VERSION__';
const PRECACHE = __PRECACHE__;
const SHELL = `libreto-shell-${VERSION}`;
const DATA = 'libreto-data';
const FONTS = 'libreto-fonts';

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches
      .open(SHELL)
      .then((c) => c.addAll(PRECACHE))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => k.startsWith('libreto-shell-') && k !== SHELL).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

async function networkFirst(request, cacheName) {
  const cache = await caches.open(cacheName);
  try {
    const res = await fetch(request);
    if (res.ok) cache.put(request, res.clone());
    return res;
  } catch (err) {
    const hit = await cache.match(request, { ignoreSearch: true });
    if (hit) return hit;
    throw err;
  }
}

async function cacheFirst(request, cacheName) {
  const cache = await caches.open(cacheName);
  const hit = await cache.match(request);
  if (hit) return hit;
  const res = await fetch(request);
  if (res.ok || res.type === 'opaque') cache.put(request, res.clone());
  return res;
}

self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET') return;
  const url = new URL(request.url);

  // Videos y peticiones por rangos: siempre directo a la red.
  if (request.headers.has('range') || request.destination === 'video' || request.destination === 'audio') return;

  if (url.origin === self.location.origin) {
    // Navegación: la red primero (para ver cambios); sin conexión, la app guardada.
    if (request.mode === 'navigate') {
      event.respondWith(
        fetch(request).catch(async () => (await caches.match('./index.html', { ignoreSearch: true })) || Response.error())
      );
      return;
    }
    // Datos que cambian: catálogo y subtítulos.
    if (url.pathname.endsWith('/catalog.json') || url.pathname.includes('/subs/')) {
      event.respondWith(networkFirst(request, DATA));
      return;
    }
    // Resto de la interfaz (archivos con hash, iconos, manifest).
    event.respondWith(caches.match(request, { ignoreSearch: true }).then((hit) => hit || fetch(request)));
    return;
  }

  // Fuentes de Google.
  if (url.hostname === 'fonts.googleapis.com' || url.hostname === 'fonts.gstatic.com') {
    event.respondWith(cacheFirst(request, FONTS));
  }
  // Todo lo demás (Commons, Internet Archive) pasa sin tocarlo.
});
