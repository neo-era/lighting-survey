const CACHE = 'lighting-survey-v1';
const STATIC = [
  '/',
  '/index.html',
  '/images/1.png','/images/2.png','/images/3.png','/images/4.png','/images/5.png',
  '/images/6.png','/images/7.png','/images/8.png','/images/9.png','/images/10.png',
  '/images/blank.png','/images/icon-192.png','/images/icon-512.png',
  '/data/khaosat.xlsx',
];

self.addEventListener('install', e => {
  e.waitUntil(
    caches.open(CACHE).then(c => Promise.allSettled(STATIC.map(u => c.add(u))))
  );
  self.skipWaiting();
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys().then(keys => Promise.all(
      keys.filter(k => k !== CACHE).map(k => caches.delete(k))
    ))
  );
  self.clients.claim();
});

self.addEventListener('fetch', e => {
  const url = e.request.url;
  // Luôn fetch mới từ Google Sheet CSV + GAS
  if (url.includes('docs.google.com') || url.includes('script.google.com')) {
    e.respondWith(fetch(e.request));
    return;
  }
  // Map tiles: cache-first với giới hạn 300 tile
  if (url.includes('tile.openstreetmap.org') || url.includes('google.com/vt')) {
    e.respondWith(
      caches.open('map-tiles-v1').then(async c => {
        const cached = await c.match(e.request);
        if (cached) return cached;
        const res = await fetch(e.request);
        if (res.ok) {
          const keys = await c.keys();
          if (keys.length > 300) await c.delete(keys[0]);
          c.put(e.request, res.clone());
        }
        return res;
      })
    );
    return;
  }
  // Static assets: cache-first
  e.respondWith(
    caches.match(e.request).then(r => r || fetch(e.request))
  );
});
