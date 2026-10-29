/* Forma service worker — offline shell cache.
   Paired with index.html; they must be served from the same folder. Bump CACHE
   whenever you want returning installs to drop the old shell. User data lives
   in localStorage, which the worker never touches, so a cache reset is safe. */
const CACHE = 'forma-v8';
const SHELL = ['./', 'index.html', 'manifest.webmanifest', 'icon-192.png', 'icon-512.png', 'icon-maskable-512.png'];

self.addEventListener('install', e => {
  self.skipWaiting();
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(SHELL).catch(() => {})));
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys()
      .then(ks => Promise.all(ks.filter(k => k !== CACHE).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', e => {
  const r = e.request;
  if (r.method !== 'GET') return;
  const url = new URL(r.url);
  const sameOrigin = url.origin === location.origin;
  const isFont = /fonts\.(googleapis|gstatic)\.com/.test(url.host);
  if (!sameOrigin && !isFont) return; // anything else goes straight to the network

  // Page loads: network-first so an updated app wins, cache as the offline fallback.
  if (r.mode === 'navigate') {
    e.respondWith(
      fetch(r)
        .then(res => { const cp = res.clone(); caches.open(CACHE).then(c => c.put(r, cp)); return res; })
        .catch(() => caches.match(r).then(m => m || caches.match('index.html') || caches.match('./')))
    );
    return;
  }

  // Fonts and other assets: cache-first, populate the cache on the first online hit.
  e.respondWith(
    caches.match(r).then(m => m || fetch(r).then(res => {
      if (res && res.status === 200) { const cp = res.clone(); caches.open(CACHE).then(c => c.put(r, cp)); }
      return res;
    }).catch(() => m))
  );
});
