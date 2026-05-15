import { supabase } from '@/lib/supabase'
import i18n from '@/lib/i18n'

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
        reject(new Error(i18n.t('push.errors.swRedundant')))
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
    return { ok: false, error: i18n.t('push.errors.alreadySubscribing') }
  }
  _subscribing = true
  try {
    // 1. Проверяем поддержку браузером
    if (!('serviceWorker' in navigator) || !('PushManager' in window)) {
      return { ok: false, error: i18n.t('push.errors.unsupported') }
    }

    // 2. Запрашиваем разрешение, если ещё не дано
    if (Notification.permission === 'denied') {
      return { ok: false, error: i18n.t('push.errors.denied') }
    }

    if (Notification.permission === 'default') {
      const result = await Notification.requestPermission()
      if (result !== 'granted') {
        return { ok: false, error: i18n.t('push.errors.permissionDenied') }
      }
    }

    // 3. Регистрируем наш SW и ждём активации именно этой регистрации
    console.log('[push] registering sw.js...')
    const registration = await navigator.serviceWorker.register('/sw.js', { scope: '/' })
    console.log('[push] sw state:', registration.installing?.state ?? registration.waiting?.state ?? registration.active?.state)
    await waitForActivation(registration)
    console.log('[push] sw activated, getting pushManager subscription...')
    
    // Следим за обновлениями SW и обновляем его периодически
    registration.addEventListener('updatefound', () => {
      const newWorker = registration.installing
      if (newWorker) {
        newWorker.addEventListener('statechange', () => {
          if (newWorker.state === 'activated') {
            console.log('[push] SW updated, attempting to update registration')
            // Пробуем обновить регистрацию push-подписки
            registration.update().catch(() => {})
          }
        })
      }
    })
    
    // Пытаемся обновить SW если прошло время
    setInterval(() => {
      registration.update().catch(() => {})
    }, 60000) // каждые 60 секунд

    // 4. Получаем VAPID public key
    const vapidPublicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY
    if (!vapidPublicKey) {
      return { ok: false, error: i18n.t('push.errors.vapidMissing') }
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
    } catch (subErr: Error | unknown) {
      const err = subErr instanceof Error ? subErr : new Error(String(subErr))
      // Расшифровываем типичные причины
      if (err?.message === 'TimeoutError') {
        return { ok: false, error: i18n.t('push.errors.timeout') }
      }
      if (err?.name === 'AbortError') {
        return { ok: false, error: i18n.t('push.errors.abort') }
      }
      if (err?.name === 'NotAllowedError') {
        return { ok: false, error: i18n.t('push.errors.permissionRevoked') }
      }
      throw err
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
  } catch (err: Error | unknown) {
    const error = err instanceof Error ? err : new Error(String(err))
    console.error('[push] subscribeUser error:', error)
    return { ok: false, error: error?.message ?? i18n.t('push.errors.subscribeUnknown') }
  } finally {
    _subscribing = false
  }
}

// ─── Отписка ──────────────────────────────────────────────────────────────────
export async function unsubscribeUser(userId: string): Promise<{ ok: boolean; error?: string }> {
  try {
    if (!('serviceWorker' in navigator)) return { ok: false, error: i18n.t('push.errors.swUnsupported') }

    const registration = await navigator.serviceWorker.getRegistration('/sw.js')
    if (!registration) return { ok: false, error: i18n.t('push.errors.swNotRegistered') }

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
  } catch (err: Error | unknown) {
    const error = err instanceof Error ? err : new Error(String(err))
    console.error('[push] unsubscribeUser error:', error)
    return { ok: false, error: error?.message ?? i18n.t('push.errors.unsubscribeFailed') }
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
