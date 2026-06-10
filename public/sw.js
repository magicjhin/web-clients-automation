/**
 * sw.js — Leadgen LT Service Worker
 *
 * Стратегия:
 * - install/activate: skipWaiting + clients.claim (быстрое обновление).
 * - Кэш: только статические ресурсы (/icon-192.png, /manifest.webmanifest).
 *   Динамические страницы Next.js (force-dynamic) намеренно НЕ кэшируются.
 *   fetch-хэндлер: network-first; если сеть недоступна и есть кэш — отдаём
 *   из кэша (только для предкэшированных URL).
 * - Push: отображает уведомление с title/body/url из payload.
 * - notificationclick: фокус существующего окна или clients.openWindow.
 */

const CACHE_NAME = 'leadgen-shell-v1';

// Только статика — намеренно не включаем HTML-страницы (они force-dynamic)
const PRECACHE_URLS = [
  '/icon-192.png',
  '/manifest.webmanifest',
];

// ── Install ──────────────────────────────────────────────────────────────────

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(PRECACHE_URLS))
  );
  // Activate immediately, don't wait for old SW to be unloaded
  self.skipWaiting();
});

// ── Activate ─────────────────────────────────────────────────────────────────

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys
          .filter((key) => key !== CACHE_NAME)
          .map((key) => caches.delete(key))
      )
    )
  );
  // Take control of all clients immediately
  self.clients.claim();
});

// ── Fetch (network-first, fallback to cache for precached URLs only) ──────────

self.addEventListener('fetch', (event) => {
  const { request } = event;

  // Only handle GET; skip non-http(s) (chrome-extension, etc.)
  if (request.method !== 'GET') return;
  const url = new URL(request.url);
  if (!url.protocol.startsWith('http')) return;

  // Skip Next.js API routes, _next/static (managed by Next itself), and
  // anything with query params (dynamic data)
  const path = url.pathname;
  if (
    path.startsWith('/api/') ||
    path.startsWith('/_next/') ||
    url.search !== ''
  ) {
    return; // let browser handle normally
  }

  // For precached static assets: cache-first
  if (PRECACHE_URLS.includes(path)) {
    event.respondWith(
      caches.match(request).then((cached) => cached ?? fetch(request))
    );
    return;
  }

  // For everything else (HTML pages): network-first, no cache fallback
  // We intentionally don't cache force-dynamic Next.js pages
  // (no event.respondWith → browser handles normally)
});

// ── Push notification ─────────────────────────────────────────────────────────

self.addEventListener('push', (event) => {
  /** @type {{ title?: string; body?: string; url?: string }} */
  let data = {};
  try {
    data = event.data?.json() ?? {};
  } catch {
    data = { title: event.data?.text() ?? '' };
  }

  const title = data.title || 'Leadgen LT';
  const options = {
    body: data.body || '',
    icon: '/icon-192.png',
    badge: '/icon-192.png',
    data: { url: data.url || '/' },
    // Vibrate on Android
    vibrate: [200, 100, 200],
  };

  event.waitUntil(self.registration.showNotification(title, options));
});

// ── Notification click ────────────────────────────────────────────────────────

self.addEventListener('notificationclick', (event) => {
  event.notification.close();

  const targetUrl = event.notification.data?.url || '/';

  event.waitUntil(
    self.clients
      .matchAll({ type: 'window', includeUncontrolled: true })
      .then((clientList) => {
        // Try to focus existing window with same origin
        for (const client of clientList) {
          const clientUrl = new URL(client.url);
          const target = new URL(targetUrl, self.location.origin);
          if (clientUrl.origin === target.origin && 'focus' in client) {
            // Navigate existing window to target URL if needed
            if (client.url !== target.href) {
              client.navigate(target.href);
            }
            return client.focus();
          }
        }
        // No existing window — open new one
        if (self.clients.openWindow) {
          return self.clients.openWindow(targetUrl);
        }
      })
  );
});
