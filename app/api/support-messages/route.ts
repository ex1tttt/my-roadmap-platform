import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { verifyRecaptchaToken, isValidScore } from '@/lib/recaptcha'

// Service-role клиент
const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

/**
 * POST /api/support-messages
 * Создание нового сообщения в чате поддержки с проверкой рекаптчи
 */
export async function POST(req: NextRequest) {
  try {
    const { session_id, content, recaptchaToken } = await req.json()

    // Проверка reCAPTCHA токена
    if (!recaptchaToken) {
      return NextResponse.json(
        { error: 'reCAPTCHA token not provided' },
        { status: 400 }
      )
    }

    const captchaResult = await verifyRecaptchaToken(recaptchaToken)
    if (!captchaResult.success || !isValidScore(captchaResult.score)) {
      console.warn('[SUPPORT-MESSAGES] reCAPTCHA validation failed:', {
        success: captchaResult.success,
        score: captchaResult.score,
      })
      return NextResponse.json(
        { error: 'Failed security check' },
        { status: 403 }
      )
    }

    // Валидация входных данных
    if (!session_id || typeof session_id !== 'string') {
      return NextResponse.json({ error: 'Missing session_id' }, { status: 400 })
    }
    if (!content || typeof content !== 'string') {
      return NextResponse.json({ error: 'Missing content' }, { status: 400 })
    }

    const trimmedContent = content.trim().slice(0, 5000) // Ограничение по длине

    if (!trimmedContent) {
      return NextResponse.json({ error: 'Content cannot be empty' }, { status: 400 })
    }

    // Получаем авторизованного пользователя (опционально)
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

    // Вставляем сообщение
    const { data, error } = await supabaseAdmin
      .from('support_messages')
      .insert({
        session_id,
        user_id: user?.id ?? null,
        username: user?.user_metadata?.username ?? null,
        content: trimmedContent,
        is_from_support: false,
      })
      .select('*')
      .single()

    if (error) {
      console.error('[SUPPORT-MESSAGES] Insert error:', error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    console.log('[SUPPORT-MESSAGES] New message created:', { id: data.id, session: session_id })

    return NextResponse.json(data)
  } catch (error: any) {
    console.error('[SUPPORT-MESSAGES] API error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
