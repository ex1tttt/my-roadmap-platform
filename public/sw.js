// ─── Push Notification Service Worker ────────────────────────────────────────
// Версия кэша — меняй при обновлении ассетов
const CACHE_VERSION = 'v1'

// ── Установка ──────────────────────────────────────────────────────────────────
self.addEventListener('install', (event) => {
  self.skipWaiting()
})

// ── Активация ─────────────────────────────────────────────────────────────────
self.addEventListener('activate', (event) => {
  event.waitUntil(
    // Удаляем старые кэши если они есть
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cacheName) => {
          if (cacheName !== CACHE_VERSION) {
            return caches.delete(cacheName)
          }
        })
      )
    }).then(() => self.clients.claim())
  )
})

// ── Обработка Push-события ────────────────────────────────────────────────────
self.addEventListener('push', (event) => {
  let data = {
    title: 'Roadmap',
    body: 'Новое уведомление',
    icon: '/icon-192.png',
    badge: '/badge-72.png',
    url: '/',
  }

  if (event.data) {
    try {
      const parsed = event.data.json()
      data = { ...data, ...parsed }
    } catch {
      data.body = event.data.text()
    }
  }

  const options = {
    body: data.body,
    icon: data.icon,
    badge: data.badge,
    data: { url: data.url },
    vibrate: [100, 50, 100],
    requireInteraction: false,
  }

  event.waitUntil(
    self.registration.showNotification(data.title, options)
  )
})

// ── Клик по уведомлению ───────────────────────────────────────────────────────
self.addEventListener('notificationclick', (event) => {
  event.notification.close()

  const targetUrl = event.notification.data?.url ?? '/'

  event.waitUntil(
    self.clients
      .matchAll({ type: 'window', includeUncontrolled: true })
      .then((clientList) => {
        // Ищем окно с тем же origin
        for (const client of clientList) {
          try {
            if (client.url.includes(self.location.origin)) {
              // Пытаемся переходить на URL
              if ('navigate' in client) {
                return client.navigate(targetUrl).then(() => client.focus())
              } else {
                // Fallback: если navigate не доступен, просто фокусируемся
                return client.focus()
              }
            }
          } catch (err) {
            console.error('[SW] Error navigating client:', err)
          }
        }
        // Если нет открытого окна - открываем новое
        if (self.clients.openWindow) {
          return self.clients.openWindow(targetUrl)
        }
      })
      .catch((err) => {
        console.error('[SW] Error in notificationclick handler:', err)
        // Даже если ошибка, пытаемся открыть окно
        if (self.clients.openWindow) {
          return self.clients.openWindow(targetUrl)
        }
      })
  )
})
