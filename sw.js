const CACHE = 'lighting-survey-v6';

// Assets tĩnh pre-cache khi install (icon + ảnh mẫu)
const STATIC_ASSETS = [
  '/images/1.png','/images/2.png','/images/3.png','/images/4.png','/images/5.png',
  '/images/6.png','/images/7.png','/images/8.png','/images/9.png','/images/10.png',
  '/images/blank.png','/images/icon-192.png','/images/icon-512.png',
];

// CDN libraries cache riêng — cache-first, không pre-install (tải lần đầu rồi cache)
const CDN_HOSTS = [
  'cdn.jsdelivr.net',
  'cdnjs.cloudflare.com',
  'unpkg.com',
  'code.jquery.com',
  'netdna.bootstrapcdn.com',
  'fonts.googleapis.com',
  'fonts.gstatic.com',
];
const CDN_CACHE = 'cdn-libs-v1';

self.addEventListener('install', e => {
  e.waitUntil(
    caches.open(CACHE).then(c => Promise.allSettled(STATIC_ASSETS.map(u => c.add(u))))
  );
  self.skipWaiting();
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys().then(keys => Promise.all(
      keys.filter(k => k !== CACHE && k !== 'map-tiles-v1' && k !== CDN_CACHE)
          .map(k => caches.delete(k))
    ))
  );
  self.clients.claim();
});

self.addEventListener('fetch', e => {
  const url = e.request.url;

  // Luôn fetch mới: Google Sheet CSV + GAS (dữ liệu thay đổi liên tục)
  if (url.includes('docs.google.com') || url.includes('script.google.com')) {
    e.respondWith(fetch(e.request));
    return;
  }

  // Network-first cho HTML — luôn lấy code mới, fallback cache khi offline
  if (e.request.mode === 'navigate' ||
      url.endsWith('.html') ||
      url.endsWith('/lighting-survey/') ||
      url.endsWith('/lighting-survey')) {
    e.respondWith(
      fetch(e.request)
        .then(res => {
          const clone = res.clone();
          caches.open(CACHE).then(c => c.put(e.request, clone));
          return res;
        })
        .catch(() => caches.match(e.request))
    );
    return;
  }

  // Map tiles: cache-first, tối đa 300 tile
  if (url.includes('tile.openstreetmap.org') ||
      url.includes('google.com/vt') ||
      url.includes('basemaps.cartocdn.com')) {
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

  // CDN libraries (JS/CSS/fonts): cache-first, sau lần tải đầu luôn dùng cache
  try {
    const host = new URL(url).hostname;
    if (CDN_HOSTS.some(h => host === h || host.endsWith('.' + h))) {
      e.respondWith(
        caches.open(CDN_CACHE).then(async c => {
          const cached = await c.match(e.request);
          if (cached) return cached;
          const res = await fetch(e.request);
          if (res.ok) c.put(e.request, res.clone());
          return res;
        })
      );
      return;
    }
  } catch (_) {}

  // Ảnh icon và assets tĩnh: cache-first
  e.respondWith(
    caches.match(e.request).then(r => r || fetch(e.request))
  );
});
