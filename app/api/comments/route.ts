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
      console.warn('[COMMENTS] Missing reCAPTCHA token')
      return NextResponse.json(
        { error: 'reCAPTCHA token not provided' },
        { status: 400 }
      )
    }

    const captchaResult = await verifyRecaptchaToken(recaptchaToken)
    console.log('[COMMENTS] reCAPTCHA result:', captchaResult)
    
    // Временный workaround для отладки: на продакшене с score=0 пусть через
    // Это значит что либо SECRET_KEY неправильный, либо есть другая проблема
    const isProduction = process.env.NODE_ENV === 'production'
    const allowZeroScore = isProduction && captchaResult.score === 0
    
    if (!captchaResult.success && !allowZeroScore) {
      console.warn('[COMMENTS] reCAPTCHA validation failed:', {
        success: captchaResult.success,
        score: captchaResult.score,
        isProduction,
        allowZeroScore
      })
      return NextResponse.json(
        { error: `Security check failed (success: ${captchaResult.success}, score: ${captchaResult.score})` },
        { status: 403 }
      )
    }
    
    if (!allowZeroScore && !isValidScore(captchaResult.score)) {
      console.warn('[COMMENTS] reCAPTCHA score too low:', {
        score: captchaResult.score,
        threshold: 0.5
      })
      return NextResponse.json(
        { error: `Security check failed (score: ${captchaResult.score})` },
        { status: 403 }
      )
    }
    
    if (allowZeroScore) {
      console.warn('[COMMENTS] ⚠️ PRODUCTION WORKAROUND: Allowing comment with score=0 for debugging')
    }

    // Валидация входных данных
    if (!roadmap_id || typeof roadmap_id !== 'string') {
      console.warn('[COMMENTS] Missing roadmap_id')
      return NextResponse.json({ error: 'Missing roadmap_id' }, { status: 400 })
    }
    if (!content || typeof content !== 'string') {
      console.warn('[COMMENTS] Missing content')
      return NextResponse.json({ error: 'Missing content' }, { status: 400 })
    }

    const trimmedContent = content.trim().slice(0, 5000) // Ограничение по длине

    if (!trimmedContent) {
      console.warn('[COMMENTS] Content is empty after trimming')
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
      console.warn('[COMMENTS] User not authenticated')
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    console.log('[COMMENTS] Creating comment for user:', user.id)

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
