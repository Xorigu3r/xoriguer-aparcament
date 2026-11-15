/* Service worker: l'app funciona sense connexió (el mapa necessita xarxa). */
const VERSIO = 'xa-v2-icones';
const FITXERS = [
  './', 'index.html', 'app.css', 'marca/marca.css', 'marca/Montserrat-ExtraBold.ttf', 'app.js', 'manifest.webmanifest',
  'icons/simbol.png', 'icons/falco.png', 'icons/icon-192.png', 'icons/icon-512.png', 'icons/favicon.png', 'icons/apple-touch-icon.png',
  'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css',
  'https://unpkg.com/leaflet@1.9.4/dist/leaflet.js'
];

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(VERSIO).then((c) => c.addAll(FITXERS)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (e) => {
  e.waitUntil(caches.keys()
    // només les memòries cau d'Aparcament: el domini xorigu3r.github.io és compartit amb altres apps
    .then((claus) => Promise.all(claus.filter((k) => k.startsWith('xa-') && k !== VERSIO && k !== VERSIO + '-mapa').map((k) => caches.delete(k))))
    .then(() => self.clients.claim()));
});

self.addEventListener('fetch', (e) => {
  const url = new URL(e.request.url);
  if (e.request.method !== 'GET') return;
  // Rajoles del mapa: xarxa primer, i si no n'hi ha, el que hi hagi a la memòria cau.
  if (url.hostname === 'tile.openstreetmap.org') {
    e.respondWith(fetch(e.request).then((r) => {
      const copia = r.clone();
      caches.open(VERSIO + '-mapa').then((c) => c.put(e.request, copia));
      return r;
    }).catch(() => caches.match(e.request)));
    return;
  }
  // La resta: memòria cau primer, i actualització en segon pla.
  e.respondWith(caches.match(e.request).then((guardat) => {
    const xarxa = fetch(e.request).then((r) => {
      if (r.ok && (url.origin === location.origin || url.hostname === 'unpkg.com')) {
        const copia = r.clone();
        caches.open(VERSIO).then((c) => c.put(e.request, copia));
      }
      return r;
    }).catch(() => guardat);
    return guardat || xarxa;
  }));
});

self.addEventListener('notificationclick', (e) => {
  e.notification.close();
  e.waitUntil(self.clients.matchAll({ type: 'window' }).then((cl) => cl.length ? cl[0].focus() : self.clients.openWindow('./')));
});
