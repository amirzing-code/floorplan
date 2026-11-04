'use strict';

/* Service worker: makes the app installable and usable offline.
   Network first (so a new deploy shows up straight away), cache as the offline fallback.
   When you add or rename files, update ASSETS; bump CACHE to drop old caches. */

const CACHE = 'floorplan-v1';
const ASSETS = [
  './', 'index.html', 'style.css', 'manifest.webmanifest',
  'icons/icon.svg', 'icons/icon-192.png', 'icons/icon-512.png', 'icons/icon-maskable-512.png', 'icons/apple-touch-icon.png',
  'fonts/google-sans-latin.woff2', 'fonts/google-sans-latin-ext.woff2',
  'js/units.js', 'js/state.js', 'js/catalog.js', 'js/library.js', 'js/store.js', 'js/view.js', 'js/geometry.js',
  'js/render.js', 'js/panels.js', 'js/actions.js', 'js/input.js', 'js/io.js', 'js/print.js', 'js/underlay.js',
  'js/bq.js', 'js/ui.js', 'js/main.js',
];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(ASSETS)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET' || new URL(req.url).origin !== location.origin) return;
  e.respondWith(
    fetch(req)
      .then(res => {
        if (res.ok) {
          const copy = res.clone();
          caches.open(CACHE).then(c => c.put(req, copy));
        }
        return res;
      })
      .catch(() => caches.match(req, { ignoreSearch: true })
        .then(hit => hit || (req.mode === 'navigate' ? caches.match('index.html') : undefined))),
  );
});
