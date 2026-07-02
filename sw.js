const CACHE_NAME = 'sonometro-pro-v1';
const URLS_TO_CACHE = [
  './',
  './index.html',
  './audio-processor.js',
  './calibration-ui.js',
  './manifest.json'
  // Nota: No cacheamos los archivos JSON de calibración porque el usuario los carga manualmente
];

// Instalación: Guarda los archivos en la caché
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => cache.addAll(URLS_TO_CACHE))
  );
});

// Intercepta las peticiones de red: Si hay internet, usa internet. Si no, usa la caché.
self.addEventListener('fetch', event => {
  event.respondWith(
    caches.match(event.request)
      .then(response => {
        // Si el archivo está en caché, lo devuelve
        if (response) {
          return response;
        }
        // Si no, lo busca en internet
        return fetch(event.request).then(
          response => {
            // Si la respuesta no es válida, la descarta
            if(!response || response.status !== 200 || response.type !== 'basic') {
              return response;
            }
            // Clona la respuesta, la guarda en caché para la próxima vez y la devuelve
            const responseToCache = response.clone();
            caches.open(CACHE_NAME)
              .then(cache => cache.put(event.request, responseToCache));
            return response;
          }
        );
      })
  );
});