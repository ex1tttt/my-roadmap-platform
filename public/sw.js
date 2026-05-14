// ─── Push Notification Service Worker ────────────────────────────────────────
// Версия кэша — меняй при обновлении ассетов
const CACHE_VERSION = 'v1'

const MAX_PUSH_URL_LEN = 2048

/** Только путь на этом сайте (без javascript:, //, внешних https). */
function safeNavigateUrl(raw) {
  if (typeof raw !== 'string') return '/'
  const s = raw.trim().slice(0, MAX_PUSH_URL_LEN)
  if (!s || !s.startsWith('/') || s.startsWith('//') || s.includes('://')) return '/'
  if (/[\u0000-\u001F\u007F]/.test(s)) return '/'
  try {
    const u = new URL(s, 'https://placeholder.invalid')
    if (u.origin !== 'https://placeholder.invalid') return '/'
    return u.pathname + u.search + u.hash
  } catch {
    return '/'
  }
}

/**
 * icon / badge / image: относительный путь или https с этого origin / Supabase storage.
 * (Дублирует часть правил API — на случай старых/подменённых payload.)
 */
function safeAssetUrl(raw) {
  if (typeof raw !== 'string') return null
  const s = raw.trim().slice(0, MAX_PUSH_URL_LEN)
  if (!s || /[\u0000-\u001F\u007F]/.test(s)) return null
  if (s.startsWith('/') && !s.startsWith('//') && !s.includes('://')) {
    try {
      const u = new URL(s, 'https://placeholder.invalid')
      if (u.origin !== 'https://placeholder.invalid') return null
      return u.pathname + u.search + u.hash
    } catch {
      return null
    }
  }
  try {
    const u = new URL(s)
    if (u.protocol !== 'https:') return null
    if (u.origin === self.location.origin) return u.href
    if (/\.supabase\.co$/i.test(u.hostname)) return u.href
    return null
  } catch {
    return null
  }
}

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

  data.url = safeNavigateUrl(data.url)
  const iconSafe = safeAssetUrl(data.icon)
  const badgeSafe = safeAssetUrl(data.badge)
  const imageSafe = safeAssetUrl(data.image)
  data.icon = iconSafe || '/icon-192.png'
  data.badge = badgeSafe || '/badge-72.png'
  if (!imageSafe) delete data.image

  const options = {
    body: data.body,
    icon: data.icon,
    badge: data.badge,
    data: { url: data.url },
    vibrate: [100, 50, 100],
    requireInteraction: false,
  }
  if (imageSafe) options.image = imageSafe

  event.waitUntil(
    self.registration.showNotification(data.title, options)
  )
})

// ── Клик по уведомлению ───────────────────────────────────────────────────────
self.addEventListener('notificationclick', (event) => {
  event.notification.close()

  const pathOnly = safeNavigateUrl(event.notification.data?.url)
  const targetUrl = new URL(pathOnly, self.location.origin).href

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
