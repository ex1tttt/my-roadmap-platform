import { NextRequest, NextResponse } from 'next/server'
import webpush from 'web-push'
import { createClient } from '@supabase/supabase-js'

export const runtime = 'nodejs'

export async function POST(req: NextRequest) {
  try {
    // Проверяем наличие обязательных env vars
    const vapidSubject = process.env.VAPID_SUBJECT
    const vapidPublicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY
    const vapidPrivateKey = process.env.VAPID_PRIVATE_KEY
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY

    if (!vapidSubject || !vapidPublicKey || !vapidPrivateKey) {
      console.error('[send-push] Missing VAPID env vars:', { vapidSubject: !!vapidSubject, vapidPublicKey: !!vapidPublicKey, vapidPrivateKey: !!vapidPrivateKey })
      return NextResponse.json({ error: 'VAPID env vars not configured' }, { status: 500 })
    }
    if (!supabaseUrl || !serviceRoleKey) {
      console.error('[send-push] Missing Supabase env vars')
      return NextResponse.json({ error: 'Supabase env vars not configured' }, { status: 500 })
    }

    // Инициализируем VAPID и Supabase внутри try
    webpush.setVapidDetails(vapidSubject, vapidPublicKey, vapidPrivateKey)

    const adminSupabase = createClient(supabaseUrl, serviceRoleKey)

    const body_json = await req.json()
    const { title, body, url } = body_json

    // Поддерживаем как одиночный userId, так и массив userIds
    const rawIds = body_json.userIds ?? (body_json.userId ? [body_json.userId] : null)
    if (!rawIds || rawIds.length === 0 || !title) {
      return NextResponse.json({ error: 'userId/userIds и title обязательны' }, { status: 400 })
    }
    const userIds: string[] = rawIds

    // Берём подписки всех указанных пользователей
    const { data: subs, error } = await adminSupabase
      .from('user_subscriptions')
      .select('user_id, endpoint, p256dh, auth')
      .in('user_id', userIds)

    if (error) throw error
    if (!subs || subs.length === 0) {
      return NextResponse.json({ sent: 0 })
    }

    const payload = JSON.stringify({ title, body: body ?? '', url: url ?? '/' })

    const results = await Promise.allSettled(
      subs.map((sub) =>
        webpush.sendNotification(
          {
            endpoint: sub.endpoint,
            keys: { p256dh: sub.p256dh, auth: sub.auth },
          },
          payload
        )
      )
    )

    // Удаляем истёкшие / недействительные подписки (статус 410 Gone)
    const expiredEndpoints = results
      .map((r, i) =>
        r.status === 'rejected' && (r.reason as any)?.statusCode === 410
          ? { userId: subs[i].user_id, endpoint: subs[i].endpoint }
          : null
      )
      .filter(Boolean) as { userId: string; endpoint: string }[]

    if (expiredEndpoints.length > 0) {
      await Promise.all(
        expiredEndpoints.map((e) =>
          adminSupabase
            .from('user_subscriptions')
            .delete()
            .eq('user_id', e.userId)
            .eq('endpoint', e.endpoint)
        )
      )
    }

    const sent = results.filter((r) => r.status === 'fulfilled').length
    return NextResponse.json({ sent })
  } catch (err: any) {
    console.error('[send-push] error:', err?.message, err?.statusCode, err?.body)
    return NextResponse.json({
      error: err?.message ?? 'Server error',
      statusCode: err?.statusCode,
    }, { status: 500 })
  }
}
