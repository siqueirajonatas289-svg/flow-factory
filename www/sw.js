/* FLOW FACTORY — service worker: cache completo para jogar offline no navegador. */
const CACHE = 'flowfactory-v1.0.0';
const ASSETS = [
  './', './index.html', './manifest.webmanifest', './css/style.css',
  './js/config.js', './js/factory.js', './js/routing.js', './js/conveyor.js', './js/simulation.js',
  './js/levels.js', './js/storage.js', './js/audio.js', './js/renderer.js', './js/ui.js', './js/native.js', './js/main.js',
  './js/vendor/capacitor.js', './js/vendor/capacitor-app.js', './js/vendor/capacitor-haptics.js',
  './fonts/barlow-condensed-latin-600-normal.woff2', './fonts/barlow-condensed-latin-800-normal.woff2',
  './fonts/barlow-latin-500-normal.woff2', './fonts/barlow-latin-600-normal.woff2',
  './icons/icon-192.png', './icons/icon-512.png'
];
self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(ASSETS)).then(() => self.skipWaiting()));
});
self.addEventListener('activate', e => {
  e.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)))).then(() => self.clients.claim()));
});
self.addEventListener('fetch', e => {
  if (e.request.method !== 'GET') return;
  e.respondWith(caches.match(e.request).then(hit => hit || fetch(e.request).then(res => {
    const copy = res.clone();
    caches.open(CACHE).then(c => c.put(e.request, copy)).catch(() => {});
    return res;
  })));
});
