// Service worker básico: cachea el shell estático y permite navegar por la
// tienda offline con la última versión vista. Deliberadamente NO toca
// /admin, /api ni /auth — esos datos deben ser siempre frescos (stock,
// pedidos, sesión), cachearlos sería peligroso.
const CACHE_NAME = 'eshop-cache-v1';
const OFFLINE_FALLBACK_URL = '/';

self.addEventListener('install', (event) => {
    event.waitUntil(caches.open(CACHE_NAME).then((cache) => cache.add(OFFLINE_FALLBACK_URL)));
    self.skipWaiting();
});

self.addEventListener('activate', (event) => {
    event.waitUntil(
        caches
            .keys()
            .then((keys) => Promise.all(keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key))))
            .then(() => self.clients.claim())
    );
});

self.addEventListener('fetch', (event) => {
    const { request } = event;
    if (request.method !== 'GET') return;

    const url = new URL(request.url);
    if (url.origin !== self.location.origin) return;
    if (url.pathname.startsWith('/admin') || url.pathname.startsWith('/api') || url.pathname.startsWith('/auth')) {
        return;
    }

    // Assets estáticos de Next (llevan hash en el nombre → inmutables) e
    // imágenes subidas: cache-first, sin volver a pedirlos si ya están.
    if (url.pathname.startsWith('/_next/static') || url.pathname.startsWith('/uploads')) {
        event.respondWith(
            caches.match(request).then(
                (cached) =>
                    cached ||
                    fetch(request).then((response) => {
                        const clone = response.clone();
                        caches.open(CACHE_NAME).then((cache) => cache.put(request, clone));
                        return response;
                    })
            )
        );
        return;
    }

    // Navegación entre páginas: red primero (contenido siempre actualizado
    // con conexión), con la copia cacheada como fallback si no hay red.
    if (request.mode === 'navigate') {
        event.respondWith(
            fetch(request)
                .then((response) => {
                    const clone = response.clone();
                    caches.open(CACHE_NAME).then((cache) => cache.put(request, clone));
                    return response;
                })
                .catch(() => caches.match(request).then((cached) => cached || caches.match(OFFLINE_FALLBACK_URL)))
        );
    }
});
