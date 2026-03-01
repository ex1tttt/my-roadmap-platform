import { NextRequest, NextResponse } from 'next/server'
import webpush from 'web-push'
import { createClient } from '@supabase/supabase-js'

// Инициализируем VAPID один раз
webpush.setVapidDetails(
  process.env.VAPID_SUBJECT!,
  process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY!,
  process.env.VAPID_PRIVATE_KEY!
)

// Supabase с service_role — обходит RLS, читает все подписки
const adminSupabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export async function POST(req: NextRequest) {
  try {
    const { userId, title, body, url } = await req.json()

    if (!userId || !title) {
      return NextResponse.json({ error: 'userId и title обязательны' }, { status: 400 })
    }

    // Берём все подписки пользователя (может быть несколько устройств)
    const { data: subs, error } = await adminSupabase
      .from('user_subscriptions')
      .select('endpoint, p256dh, auth')
      .eq('user_id', userId)

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
    const expiredEndpoints: string[] = []
    results.forEach((result, idx) => {
      if (
        result.status === 'rejected' &&
        (result.reason as any)?.statusCode === 410
      ) {
        expiredEndpoints.push(subs[idx].endpoint)
      }
    })

    if (expiredEndpoints.length > 0) {
      await adminSupabase
        .from('user_subscriptions')
        .delete()
        .eq('user_id', userId)
        .in('endpoint', expiredEndpoints)
    }

    const sent = results.filter((r) => r.status === 'fulfilled').length
    return NextResponse.json({ sent })
  } catch (err: any) {
    console.error('[send-push] error:', err)
    return NextResponse.json({ error: err.message ?? 'Server error' }, { status: 500 })
  }
}
