import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

// Используем service role для вставки сообщений от поддержки
const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

const ADMIN_IDS = [
  'a48b5f93-2e98-48c8-98f1-860ca962f651', // tkachmaksim2007
  'b63af445-e18d-4e5b-a0e1-ba747f2b4948', // atrybut2006
]

export async function POST(req: NextRequest) {
  try {
    // Проверяем авторизацию через anon клиент
    const authHeader = req.headers.get('authorization')
    if (!authHeader) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const token = authHeader.replace('Bearer ', '')
    const { data: { user }, error: authError } = await supabaseAdmin.auth.getUser(token)
    if (authError || !user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    // Только администратор может отправлять ответы поддержки
    if (!ADMIN_IDS || !ADMIN_IDS.includes(user.id)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const { session_id, content, image_url } = await req.json()
    if (!session_id || (!content?.trim() && !image_url)) {
      return NextResponse.json({ error: 'Missing fields' }, { status: 400 })
    }

    const { error } = await supabaseAdmin.from('support_messages').insert({
      session_id,
      user_id: null,
      username: 'Поддержка',
      content: content?.trim() ?? '',
      image_url: image_url ?? null,
      is_from_support: true,
    })

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ ok: true })
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}
