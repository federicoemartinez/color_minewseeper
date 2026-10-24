// Network first: a deploy reaches players on their next load, no version bump needed. The cache is the offline copy.
const CACHE = 'mws-v3';
const FILES = [
  './', './index.html', './manifest.webmanifest',
  './css/base.css', './css/themes.css',
  './js/app.js', './js/board-view.js', './js/game.js', './js/generator.js', './js/grid.js', './js/input.js',
  './js/rng.js', './js/share.js', './js/solver.js', './js/sound.js', './js/stats.js', './js/storage.js', './js/tutorial.js',
  './icons/icon.svg', './icons/icon-192.png', './icons/icon-512.png', './icons/apple-touch-icon.png',
];

// cache: 'reload' bypasses the HTTP cache (GitHub Pages sends max-age=600), so a quick redeploy can't pin old files.
// A new sw.js takes over at once instead of waiting for every open copy of the app to close.
self.addEventListener('install', (e) => e.waitUntil(caches.open(CACHE)
  .then((c) => c.addAll(FILES.map((u) => new Request(u, { cache: 'reload' }))))
  .then(() => self.skipWaiting())));
self.addEventListener('activate', (e) => e.waitUntil(
  caches.keys().then((ks) => Promise.all(ks.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
    .then(() => self.clients.claim()),
));
// cache: 'no-cache' revalidates with the server (a 304 when unchanged) instead of trusting the HTTP cache.
// ponytail: no timeout, so a very slow network waits before the cache; add a ~3 s race if players notice.
self.addEventListener('fetch', (e) => {
  if (e.request.method !== 'GET' || !e.request.url.startsWith(self.registration.scope)) return;
  e.respondWith(fetch(e.request, { cache: 'no-cache' }).then((r) => {
    if (r.ok) {
      const copy = r.clone();
      e.waitUntil(caches.open(CACHE).then((c) => c.put(e.request, copy)));
    }
    return r;
  }).catch(() => caches.match(e.request, { ignoreSearch: true })));
});
