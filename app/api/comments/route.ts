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

export async function POST(req: NextRequest) {
  try {
    const { roadmap_id, content, recaptchaToken, parent_id } = await req.json()

    // Проверка reCAPTCHA токена
    if (!recaptchaToken) {
      return NextResponse.json(
        { error: 'reCAPTCHA token not provided' },
        { status: 400 }
      )
    }

    const captchaResult = await verifyRecaptchaToken(recaptchaToken)
    if (!captchaResult.success || !isValidScore(captchaResult.score)) {
      console.warn('[COMMENTS] reCAPTCHA validation failed:', {
        success: captchaResult.success,
        score: captchaResult.score,
      })
      return NextResponse.json(
        { error: 'Failed security check' },
        { status: 403 }
      )
    }

    // Валидация входных данных
    if (!roadmap_id || typeof roadmap_id !== 'string') {
      return NextResponse.json({ error: 'Missing roadmap_id' }, { status: 400 })
    }
    if (!content || typeof content !== 'string') {
      return NextResponse.json({ error: 'Missing content' }, { status: 400 })
    }

    const trimmedContent = content.trim().slice(0, 5000) // Ограничение по длине

    if (!trimmedContent) {
      return NextResponse.json({ error: 'Content cannot be empty' }, { status: 400 })
    }

    // Получаем авторизованного пользователя
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

    // Вставляем комментарий
    const { data, error } = await supabaseAdmin
      .from('comments')
      .insert({
        roadmap_id,
        user_id: user.id,
        content: trimmedContent,
        parent_id: parent_id || null,
      })
      .select('id, content, created_at, user_id, parent_id, profiles:user_id(username, avatar)')
      .single()

    if (error) {
      console.error('[COMMENTS] Insert error:', error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    console.log('[COMMENTS] New comment created:', { id: data.id, user: user.id })

    return NextResponse.json({
      id: data.id,
      content: data.content,
      created_at: data.created_at,
      user_id: data.user_id,
      parent_id: data.parent_id,
      profiles: data.profiles,
    })
  } catch (error: any) {
    console.error('[COMMENTS] API error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
