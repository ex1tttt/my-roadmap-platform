// ─── Push Notification Service Worker ────────────────────────────────────────
// Версия кэша — меняй при обновлении ассетов
const CACHE_VERSION = 'v1'

// ── Установка ──────────────────────────────────────────────────────────────────
self.addEventListener('install', (event) => {
  self.skipWaiting()
})

// ── Активация ─────────────────────────────────────────────────────────────────
self.addEventListener('activate', (event) => {
  event.waitUntil(self.clients.claim())
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
        // Если вкладка с сайтом уже открыта — фокусируемся на ней
        for (const client of clientList) {
          if (client.url.includes(self.location.origin) && 'focus' in client) {
            client.navigate(targetUrl)
            return client.focus()
          }
        }
        // Иначе открываем новую вкладку
        if (self.clients.openWindow) {
          return self.clients.openWindow(targetUrl)
        }
      })
  )
})
