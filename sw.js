// あそびば — サービスワーカー
// 初回訪問時に主要ファイルをキャッシュし、以降はオフラインでも開けるようにする。
// /api/ (部屋・チャットのデータ)は常に最新が必要なので、キャッシュを使わず必ずネットワークから取得する。

const CACHE_NAME = 'asobiba-cache-v2';
const PRECACHE_URLS = [
  './index.html',
  './manifest.json',
  './icon-192.png',
  './icon-512.png',
];

self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => cache.addAll(PRECACHE_URLS))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(names =>
      Promise.all(names.filter(n => n !== CACHE_NAME).map(n => caches.delete(n)))
    ).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', event => {
  const req = event.request;
  const url = new URL(req.url);

  // 部屋・チャットのAPIはぜったいにキャッシュしない(常に最新を取りに行く)
  if(url.pathname.startsWith('/api/')){
    event.respondWith(fetch(req));
    return;
  }

  if(req.method !== 'GET') return;

  // Network-first for navigation/HTML(常に最新を優先し、オフライン時だけキャッシュを使う)
  if(req.mode === 'navigate' || req.headers.get('accept')?.includes('text/html')){
    event.respondWith(
      fetch(req)
        .then(res => {
          const resClone = res.clone();
          caches.open(CACHE_NAME).then(cache => cache.put(req, resClone));
          return res;
        })
        .catch(() => caches.match(req).then(res => res || caches.match('./index.html')))
    );
    return;
  }

  // Cache-first for other static assets(アイコンなど)
  event.respondWith(
    caches.match(req).then(cached => cached || fetch(req).then(res => {
      const resClone = res.clone();
      caches.open(CACHE_NAME).then(cache => cache.put(req, resClone));
      return res;
    }).catch(() => cached))
  );
});
