// SERGIO 2026-09-17: Service Worker minimo para que el formulario de Registro de Visita y el
// historial del tecnico carguen sin conexion. Solo cachea las paginas y scripts del panel de
// tecnico; todo lo demas (login, panel de administracion, sincronizacion) pasa directo a la red.
const CACHE = 'tecnopest-tecnico-v1';
const RUTAS_A_CACHEAR = [
  '/tecnico',
  '/tecnico/nuevo',
  '/js/tecnico-db.js',
  '/js/tecnico-firma.js',
  '/js/tecnico-comun.js',
  '/js/tecnico-nuevo.js',
  '/js/tecnico-historial.js'
];

self.addEventListener('install', function (evento) {
  evento.waitUntil(
    caches.open(CACHE).then((cache) => cache.addAll(RUTAS_A_CACHEAR))
  );
  self.skipWaiting();
});

self.addEventListener('activate', function (evento) {
  evento.waitUntil(
    caches.keys().then((nombres) => Promise.all(
      nombres.filter((n) => n !== CACHE).map((n) => caches.delete(n))
    ))
  );
  self.clients.claim();
});

self.addEventListener('fetch', function (evento) {
  if (evento.request.method !== 'GET') return;
  if (!RUTAS_A_CACHEAR.includes(new URL(evento.request.url).pathname)) return;

  evento.respondWith(
    fetch(evento.request)
      .then((respuesta) => {
        const copia = respuesta.clone();
        caches.open(CACHE).then((cache) => cache.put(evento.request, copia));
        return respuesta;
      })
      .catch(() => caches.match(evento.request))
  );
});
