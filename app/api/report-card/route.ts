import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'

const VALID_REASONS = ['spam', 'inappropriate', 'misinformation', 'copyright', 'other'] as const

// Service-role клиент для вставки и чтения обходя RLS на admin-операциях
const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export async function POST(req: NextRequest) {
  try {
    const { card_id, reason, description } = await req.json()

    // Валидация входных данных
    if (!card_id || typeof card_id !== 'string') {
      return NextResponse.json({ error: 'Missing card_id' }, { status: 400 })
    }
    if (!reason || !VALID_REASONS.includes(reason)) {
      return NextResponse.json({ error: 'Invalid reason' }, { status: 400 })
    }
    if (description && typeof description !== 'string') {
      return NextResponse.json({ error: 'Invalid description' }, { status: 400 })
    }
    // Ограничиваем длину описания для защиты от злоупотреблений
    const trimmedDescription = description ? String(description).trim().slice(0, 500) : null

    // Получаем текущего авторизованного пользователя из cookie-сессии
    const cookieStore = await cookies()
    const supabaseServer = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          getAll: () => cookieStore.getAll(),
          setAll: () => {},
        },
      }
    )

    const { data: { user } } = await supabaseServer.auth.getUser()
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Запрещаем жаловаться на собственную карточку
    const { data: card } = await supabaseAdmin
      .from('cards')
      .select('user_id')
      .eq('id', card_id)
      .maybeSingle()

    if (!card) {
      return NextResponse.json({ error: 'Card not found' }, { status: 404 })
    }
    if (card.user_id === user.id) {
      return NextResponse.json({ error: 'Cannot report your own card' }, { status: 403 })
    }

    // Вставляем жалобу (UNIQUE constraint защитит от дублей)
    const { error } = await supabaseAdmin.from('card_reports').insert({
      card_id,
      reporter_id: user.id,
      reason,
      description: trimmedDescription,
      status: 'pending',
    })

    if (error) {
      // Дублирующая жалоба
      if (error.code === '23505') {
        return NextResponse.json({ error: 'already_reported' }, { status: 409 })
      }
      throw error
    }

    // Уведомляем всех админов (кроме самого репортера, если он вдруг admin)
    const ADMIN_NOTIFY_IDS = [
      'a48b5f93-2e98-48c8-98f1-860ca962f651',
      'b63af445-e18d-4e5b-a0e1-ba747f2b4948',
    ]
    const notifyIds = ADMIN_NOTIFY_IDS.filter((id) => id !== user.id)

    if (notifyIds.length > 0) {
      // Получаем username репортера для текста уведомления
      const { data: profile } = await supabaseAdmin
        .from('profiles')
        .select('username')
        .eq('id', user.id)
        .maybeSingle()
      const username = profile?.username ?? null

      // Получаем название карточки
      const { data: cardInfo } = await supabaseAdmin
        .from('cards')
        .select('title')
        .eq('id', card_id)
        .maybeSingle()
      const cardTitle = cardInfo?.title ?? null

      // Вставляем in-app уведомления для каждого admin
      const notifications = notifyIds.map((adminId) => ({
        type: 'card_report',
        receiver_id: adminId,
        actor_id: user.id,
        card_id: card_id,
        is_read: false,
      }))
      await supabaseAdmin.from('notifications').insert(notifications)

      // Отправляем push-уведомления (fire-and-forget)
      const origin = req.nextUrl.origin
      fetch(`${origin}/api/send-push`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userIds: notifyIds,
          actor_id: user.id,
          notificationType: 'card_report',
          title: '🚩 Новая жалоба на карточку',
          body: username
            ? `${username} пожаловался на «${cardTitle ?? 'карточку'}»`
            : `Жалоба на «${cardTitle ?? 'карточку'}»`,
          url: '/admin/reports',
        }),
      }).catch(() => {})
    }

    return NextResponse.json({ ok: true })
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}

// GET для admin-панели — возвращает все жалобы (только для администраторов)
const ADMIN_IDS = [
  'a48b5f93-2e98-48c8-98f1-860ca962f651',
  'b63af445-e18d-4e5b-a0e1-ba747f2b4948',
]

export async function GET(req: NextRequest) {
  const cookieStore = await cookies()
  const supabaseServer = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll: () => cookieStore.getAll(),
        setAll: () => {},
      },
    }
  )

  const { data: { user } } = await supabaseServer.auth.getUser()
  if (!user || !ADMIN_IDS.includes(user.id)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const { searchParams } = new URL(req.url)
  const status = searchParams.get('status') ?? 'pending'

  const { data: reports, error } = await supabaseAdmin
    .from('card_reports')
    .select(`
      id,
      reason,
      description,
      status,
      created_at,
      card_id,
      reporter_id,
      cards:card_id(id, title, user_id)
    `)
    .eq('status', status)
    .order('created_at', { ascending: false })

  if (error) {
    console.error('card_reports GET error:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  // Отдельно подгружаем профили репортеров
  const reporterIds = [...new Set((reports ?? []).map((r: any) => r.reporter_id).filter(Boolean))]
  let profilesMap: Record<string, { id: string; username: string; avatar: string | null }> = {}
  if (reporterIds.length > 0) {
    const { data: profiles } = await supabaseAdmin
      .from('profiles')
      .select('id, username, avatar')
      .in('id', reporterIds)
    for (const p of profiles ?? []) {
      profilesMap[p.id] = p
    }
  }

  const data = (reports ?? []).map((r: any) => ({
    ...r,
    profiles: profilesMap[r.reporter_id] ?? null,
  }))

  return NextResponse.json({ data })
}

// PATCH — обновление статуса жалобы администратором
export async function PATCH(req: NextRequest) {
  const cookieStore = await cookies()
  const supabaseServer = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll: () => cookieStore.getAll(),
        setAll: () => {},
      },
    }
  )

  const { data: { user } } = await supabaseServer.auth.getUser()
  if (!user || !ADMIN_IDS.includes(user.id)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const { id, status } = await req.json()
  if (!id || !['pending', 'reviewed', 'resolved'].includes(status)) {
    return NextResponse.json({ error: 'Invalid input' }, { status: 400 })
  }

  const { error } = await supabaseAdmin
    .from('card_reports')
    .update({ status })
    .eq('id', id)

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ ok: true })
}
