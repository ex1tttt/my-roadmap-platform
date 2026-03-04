import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const ADMIN_IDS = [
  'a48b5f93-2e98-48c8-98f1-860ca962f651', // tkachmaksim2007
  'b63af445-e18d-4e5b-a0e1-ba747f2b4948', // atrybut2006
]

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export async function POST(req: NextRequest) {
  try {
    const { user_id, username, session_id } = await req.json()
    if (!session_id) {
      return NextResponse.json({ error: 'Missing session_id' }, { status: 400 })
    }

    // Проверяем, что сообщение реально существует (защита от спама)
    const { data: msg } = await supabaseAdmin
      .from('support_messages')
      .select('id')
      .eq('session_id', session_id)
      .eq('is_from_support', false)
      .limit(1)
      .maybeSingle()

    if (!msg) {
      return NextResponse.json({ error: 'No message found' }, { status: 400 })
    }

    // Проверяем, какие админы сейчас находятся в этом чате (не уведомляем их)
    const { data: presentRows } = await supabaseAdmin
      .from('admin_presence')
      .select('admin_id')
      .eq('session_id', session_id)

    const presentAdminIds = new Set((presentRows ?? []).map((r: any) => r.admin_id))

    // Вставляем уведомления в таблицу notifications для каждого admin
    const notifyIds = ADMIN_IDS.filter(
      (id) => id !== (user_id ?? null) && !presentAdminIds.has(id)
    )

    const notifications = notifyIds.map((adminId) => ({
      type: 'support_message',
      receiver_id: adminId,
      actor_id: user_id ?? null,
      card_id: null,
      is_read: false,
    }))

    if (notifications.length > 0) {
      await supabaseAdmin.from('notifications').insert(notifications)
    }

    // Отправляем push только тем, кто не в чате
    if (notifyIds.length > 0) {
      const origin = req.nextUrl.origin
      fetch(`${origin}/api/send-push`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userIds: notifyIds,
          actor_id: user_id ?? null,
          notificationType: 'support_message',
          title: '💬 Новое обращение',
          body: username ? `${username} написал в поддержку` : 'Гость написал в поддержку',
          url: '/admin/support',
        }),
      }).catch(() => {})
    }

    return NextResponse.json({ ok: true })
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}
