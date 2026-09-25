/**
 * CEPRODENT - Service Worker
 * Caché de recursos estáticos + actualización automática
 */

const CACHE_NAME = 'ceprodent-v2';

const APP_SHELL = [
    './',
    './index.html',
    './css/styles.css',
    './js/supabaseClient.js',
    './js/ui.js',
    './js/auth.js',
    './js/teacher.js',
    './js/admin.js',
    './js/quiz.js',
    './js/student.js',
    './js/app.js'
];


/**
 * INSTALACIÓN
 * Guarda los archivos principales de la aplicación.
 */
self.addEventListener('install', event => {
    event.waitUntil(
        caches.open(CACHE_NAME)
            .then(cache => cache.addAll(APP_SHELL))
            .then(() => self.skipWaiting())
    );
});


/**
 * ACTIVACIÓN
 * Elimina versiones antiguas de la caché.
 */
self.addEventListener('activate', event => {
    event.waitUntil(
        caches.keys().then(keys => {
            return Promise.all(
                keys
                    .filter(key => key !== CACHE_NAME)
                    .map(key => caches.delete(key))
            );
        }).then(() => self.clients.claim())
    );
});


/**
 * INTERCEPTAR SOLICITUDES
 */
self.addEventListener('fetch', event => {

    const request = event.request;
    const url = new URL(request.url);


    // =========================================================
    // NUNCA guardar consultas de Supabase en caché
    // =========================================================
    if (
        url.hostname.includes('supabase.co') ||
        url.hostname.includes('supabase.in')
    ) {
        return;
    }


    // Solo manejar solicitudes GET
    if (request.method !== 'GET') {
        return;
    }


    // =========================================================
    // HTML: intentar primero Internet
    // =========================================================
    if (request.mode === 'navigate') {
        event.respondWith(
            fetch(request)
                .then(response => {
                    const responseClone = response.clone();

                    caches.open(CACHE_NAME)
                        .then(cache => cache.put('./index.html', responseClone));

                    return response;
                })
                .catch(() => caches.match('./index.html'))
        );

        return;
    }


    // =========================================================
    // Archivos estáticos: primero caché, luego Internet
    // =========================================================
    event.respondWith(
        caches.match(request)
            .then(cachedResponse => {

                if (cachedResponse) {
                    return cachedResponse;
                }

                return fetch(request)
                    .then(networkResponse => {

                        // No guardar respuestas incorrectas
                        if (
                            !networkResponse ||
                            networkResponse.status !== 200 ||
                            networkResponse.type === 'error'
                        ) {
                            return networkResponse;
                        }

                        return networkResponse;
                    });
            })
    );
});