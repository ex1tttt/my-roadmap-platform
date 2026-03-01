import { supabase } from '@/lib/supabase'

// ─── Конвертер VAPID public key ───────────────────────────────────────────────
export function urlBase64ToUint8Array(base64String: string): Uint8Array<ArrayBuffer> {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4)
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/')
  const rawData = atob(base64)
  return new Uint8Array([...rawData].map((ch) => ch.charCodeAt(0))) as Uint8Array<ArrayBuffer>
}

// ─── Ждём активации именно нашей регистрации (не любого ready SW) ─────────────
function waitForActivation(reg: ServiceWorkerRegistration): Promise<void> {
  return new Promise((resolve, reject) => {
    // Если уже активен — выходим сразу
    if (reg.active && !reg.installing && !reg.waiting) return resolve()

    const sw = reg.installing ?? reg.waiting ?? reg.active
    if (!sw) return reject(new Error('No service worker found in registration'))

    if (sw.state === 'activated') return resolve()

    const onChange = () => {
      if (sw.state === 'activated') {
        sw.removeEventListener('statechange', onChange)
        resolve()
      } else if (sw.state === 'redundant') {
        sw.removeEventListener('statechange', onChange)
        reject(new Error('Service Worker стал redundant — попробуйте обновить страницу.'))
      }
    }
    sw.addEventListener('statechange', onChange)
  })
}

// ─── Статус разрешения браузера ───────────────────────────────────────────────
export type PushStatus = 'unsupported' | 'denied' | 'default' | 'subscribed'

export function getPushStatus(): PushStatus {
  if (typeof window === 'undefined') return 'unsupported'
  if (!('serviceWorker' in navigator) || !('PushManager' in window)) return 'unsupported'
  if (Notification.permission === 'denied') return 'denied'
  return 'default'
}

// ─── Основная функция подписки ────────────────────────────────────────────────
let _subscribing = false // глобальный флаг — защита от двойного вызова (React StrictMode)

export async function subscribeUser(userId: string): Promise<{ ok: boolean; error?: string }> {
  if (_subscribing) {
    return { ok: false, error: 'Подписка уже выполняется, подождите.' }
  }
  _subscribing = true
  try {
    // 1. Проверяем поддержку браузером
    if (!('serviceWorker' in navigator) || !('PushManager' in window)) {
      return { ok: false, error: 'Push-уведомления не поддерживаются вашим браузером.' }
    }

    // 2. Запрашиваем разрешение, если ещё не дано
    if (Notification.permission === 'denied') {
      return { ok: false, error: 'Push-уведомления заблокированы в настройках браузера.' }
    }

    if (Notification.permission === 'default') {
      const result = await Notification.requestPermission()
      if (result !== 'granted') {
        return { ok: false, error: 'Вы отказали в разрешении на уведомления.' }
      }
    }

    // 3. Регистрируем наш SW и ждём активации именно этой регистрации
    console.log('[push] registering sw.js...')
    const registration = await navigator.serviceWorker.register('/sw.js', { scope: '/' })
    console.log('[push] sw state:', registration.installing?.state ?? registration.waiting?.state ?? registration.active?.state)
    await waitForActivation(registration)
    console.log('[push] sw activated, getting pushManager subscription...')

    // 4. Получаем VAPID public key
    const vapidPublicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY
    if (!vapidPublicKey) {
      return { ok: false, error: 'VAPID ключ не настроен. Добавьте NEXT_PUBLIC_VAPID_PUBLIC_KEY в .env.' }
    }
    console.log('[push] vapidPublicKey length:', vapidPublicKey.length)

    // 5. Сбрасываем любую существующую подписку (она могла быть создана
    //    с другим applicationServerKey — именно это вызывает push service error)
    try {
      const existingSub = await registration.pushManager.getSubscription()
      if (existingSub) {
        console.log('[push] unsubscribing old subscription:', existingSub.endpoint)
        await existingSub.unsubscribe()
        // Небольшая пауза — браузер должен очистить состояние на стороне FCM
        await new Promise((r) => setTimeout(r, 300))
      } else {
        console.log('[push] no existing subscription')
      }
    } catch {
      // Игнорируем — старой подписки может не быть
    }

    console.log('[push] calling pushManager.subscribe()...')

    // 6. Подписываемся через нашу конкретную регистрацию
    let subscription: PushSubscription
    try {
      // Таймаут 10 сек — если FCM не отвечает (сеть заблокирована), не зависаем вечно
      const subscribePromise = registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(vapidPublicKey),
      })
      const timeoutPromise = new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error('TimeoutError')), 10_000)
      )
      subscription = await Promise.race([subscribePromise, timeoutPromise])
    } catch (subErr: any) {
      // Расшифровываем типичные причины
      if (subErr?.message === 'TimeoutError') {
        return {
          ok: false,
          error:
            'Push-сервер не отвечает (таймаут 10 сек). ' +
            'Скорее всего fcm.googleapis.com заблокирован у вашего провайдера. ' +
            'Попробуйте с VPN или Firefox.',
        }
      }
      if (subErr?.name === 'AbortError') {
        return {
          ok: false,
          error:
            'Браузер не смог подключиться к Push-серверу Google (FCM). ' +
            'Возможные причины: VPN/Firewall блокирует fcm.googleapis.com, ' +
            'или откройте DevTools → Application → Service Workers → Unregister, ' +
            'затем попробуйте снова.',
        }
      }
      if (subErr?.name === 'NotAllowedError') {
        return { ok: false, error: 'Разрешение на уведомления было отозвано.' }
      }
      throw subErr
    }

    // 7. Сохраняем подписку в Supabase
    const subJson = subscription.toJSON()

    // Удаляем старую запись для этого endpoint (если есть), затем вставляем новую
    // — не используем upsert с onConflict, т.к. constraint может отсутствовать в БД
    await supabase
      .from('user_subscriptions')
      .delete()
      .eq('user_id', userId)
      .eq('endpoint', subJson.endpoint!)

    const { error } = await supabase
      .from('user_subscriptions')
      .insert({
        user_id: userId,
        endpoint: subJson.endpoint,
        p256dh: subJson.keys?.p256dh ?? '',
        auth: subJson.keys?.auth ?? '',
      })

    if (error) throw error

    return { ok: true }
  } catch (err: any) {
    console.error('[push] subscribeUser error:', err)
    return { ok: false, error: err?.message ?? 'Неизвестная ошибка при подписке.' }
  } finally {
    _subscribing = false
  }
}

// ─── Отписка ──────────────────────────────────────────────────────────────────
export async function unsubscribeUser(userId: string): Promise<{ ok: boolean; error?: string }> {
  try {
    if (!('serviceWorker' in navigator)) return { ok: false, error: 'Service Worker не поддерживается.' }

    const registration = await navigator.serviceWorker.getRegistration('/sw.js')
    if (!registration) return { ok: false, error: 'Service Worker не зарегистрирован.' }

    const subscription = await registration.pushManager.getSubscription()
    if (subscription) {
      const endpoint = subscription.endpoint
      await subscription.unsubscribe()

      await supabase
        .from('user_subscriptions')
        .delete()
        .eq('user_id', userId)
        .eq('endpoint', endpoint)
    }

    return { ok: true }
  } catch (err: any) {
    console.error('[push] unsubscribeUser error:', err)
    return { ok: false, error: err?.message ?? 'Ошибка при отписке.' }
  }
}

// ─── Проверка: есть ли уже активная подписка ─────────────────────────────────
export async function getActiveSubscription(): Promise<PushSubscription | null> {
  if (!('serviceWorker' in navigator)) return null
  try {
    const registration = await navigator.serviceWorker.getRegistration('/sw.js')
    if (!registration) return null
    return registration.pushManager.getSubscription()
  } catch {
    return null
  }
}
