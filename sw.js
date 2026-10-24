// Bump CACHE on every deploy so installed clients pick up new files.
const CACHE = 'mws-v1';
const FILES = [
  './', './index.html', './manifest.webmanifest',
  './css/base.css', './css/themes.css',
  './js/app.js', './js/board-view.js', './js/game.js', './js/generator.js', './js/grid.js', './js/input.js',
  './js/rng.js', './js/share.js', './js/solver.js', './js/stats.js', './js/storage.js', './js/tutorial.js',
  './icons/icon.svg', './icons/icon-192.png', './icons/icon-512.png', './icons/apple-touch-icon.png',
];

self.addEventListener('install', (e) => e.waitUntil(caches.open(CACHE).then((c) => c.addAll(FILES))));
self.addEventListener('activate', (e) => e.waitUntil(
  caches.keys().then((ks) => Promise.all(ks.filter((k) => k !== CACHE).map((k) => caches.delete(k)))),
));
self.addEventListener('fetch', (e) => e.respondWith(caches.match(e.request).then((r) => r || fetch(e.request))));
