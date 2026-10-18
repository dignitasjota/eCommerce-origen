// Service worker básico: cachea el shell estático y permite navegar por la
// tienda offline con la última versión vista. Deliberadamente NO toca rutas
// con datos personales o transaccionales (admin, api, auth, cuenta, checkout,
// carrito, wishlist): en un equipo compartido quedarían en Cache Storage y se
// servirían offline tras cerrar sesión. v2 purga lo que v1 hubiera guardado.
const CACHE_NAME = 'eshop-cache-v2';
const PRIVATE_PATH_RE = /^\/(?:(?:es|en)\/)?(?:admin|api|auth|account|checkout|cart|wishlist)(?:\/|$)/;
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
    if (PRIVATE_PATH_RE.test(url.pathname)) {
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
                    // Sólo respuestas 200 propias: no cachear errores ni redirects
                    // (p.ej. el redirect a /auth/login de una página protegida).
                    if (response.ok && !response.redirected) {
                        const clone = response.clone();
                        caches.open(CACHE_NAME).then((cache) => cache.put(request, clone));
                    }
                    return response;
                })
                .catch(() => caches.match(request).then((cached) => cached || caches.match(OFFLINE_FALLBACK_URL)))
        );
    }
});
