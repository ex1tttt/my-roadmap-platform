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
    console.log('[CARDS] POST request received')
    
    const { 
      title, 
      category, 
      description, 
      is_private, 
      steps, 
      resources,
      recaptchaToken 
    } = await req.json()

    console.log('[CARDS] Parsed request body:', {
      title: title?.substring(0, 20),
      category,
      hasRecaptchaToken: !!recaptchaToken,
      tokenLength: recaptchaToken?.length,
    })

    // Проверка reCAPTCHA токена
    if (!recaptchaToken) {
      console.error('[CARDS] No reCAPTCHA token provided')
      return NextResponse.json(
        { error: 'reCAPTCHA token not provided' },
        { status: 400 }
      )
    }

    console.log('[CARDS] Verifying reCAPTCHA token...')
    const captchaResult = await verifyRecaptchaToken(recaptchaToken)
    console.log('[CARDS] reCAPTCHA result:', {
      success: captchaResult.success,
      score: captchaResult.score,
      action: captchaResult.action,
    })

    const isValidScoreResult = isValidScore(captchaResult.score)
    console.log('[CARDS] Score validation:', {
      score: captchaResult.score,
      isValid: isValidScoreResult,
    })

    if (!captchaResult.success || !isValidScoreResult) {
      console.warn('[CARDS] reCAPTCHA validation FAILED:', {
        success: captchaResult.success,
        score: captchaResult.score,
        isValidScore: isValidScoreResult,
      })
      return NextResponse.json(
        { error: 'Failed security check' },
        { status: 403 }
      )
    }

    console.log('[CARDS] reCAPTCHA validation PASSED')

    // Валидация входных данных
    if (!title || typeof title !== 'string') {
      return NextResponse.json({ error: 'Missing title' }, { status: 400 })
    }
    if (!category || typeof category !== 'string') {
      return NextResponse.json({ error: 'Missing category' }, { status: 400 })
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
      console.error('[CARDS] User not authenticated')
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    console.log('[CARDS] User authenticated:', { userId: user.id, email: user.email })

    // Создаём карточку
    console.log('[CARDS] Inserting card to database...', {
      title: title.slice(0, 20),
      category,
      user_id: user.id,
    })

    const { data: cardData, error: cardError } = await supabaseAdmin
      .from('cards')
      .insert({
        user_id: user.id,
        title: title.trim().slice(0, 500),
        category,
        description: description?.trim().slice(0, 5000) || null,
        is_private: !!is_private,
      })
      .select('id')
      .single()

    if (cardError) {
      console.error('[CARDS] ❌ Card insert FAILED:', {
        code: cardError.code,
        message: cardError.message,
        details: cardError.details,
        hint: cardError.hint,
      })
      return NextResponse.json({ error: cardError.message }, { status: 500 })
    }

    const cardId = cardData.id
    console.log('[CARDS] ✅ Card inserted successfully:', { cardId })

    // Вставляем шаги если они есть
    if (Array.isArray(steps) && steps.length > 0) {
      const stepsPayload = steps.map((step: any, idx: number) => ({
        card_id: cardId,
        order: idx,
        title: step.title?.trim().slice(0, 200) || '',
        content: step.content?.trim().slice(0, 10000) || '',
        link: step.link?.trim().slice(0, 2048) || null,
        duration_minutes: step.duration_minutes ? parseInt(step.duration_minutes) : null,
        media_urls: Array.isArray(step.media_urls) ? step.media_urls.slice(0, 10) : [],
      }))

      const { error: stepsError } = await supabaseAdmin
        .from('steps')
        .insert(stepsPayload)

      if (stepsError) {
        console.error('[CARDS] Steps insert error:', stepsError)
        // Продолжаем - ошибка в шагах не критична
      }
    }

    // Вставляем ресурсы если они есть
    if (Array.isArray(resources) && resources.length > 0) {
      const resourcesPayload = resources.map((res: any) => ({
        card_id: cardId,
        label: res.label?.trim().slice(0, 100) || '',
        url: res.url?.trim().slice(0, 2048) || '',
      }))

      const { error: resError } = await supabaseAdmin
        .from('resources')
        .insert(resourcesPayload)

      if (resError) {
        console.error('[CARDS] Resources insert error:', resError)
        // Продолжаем - ошибка в ресурсах не критична
      }
    }

    console.log('[CARDS] New card created:', { id: cardId, user: user.id })

    return NextResponse.json({
      id: cardId,
      user_id: user.id,
      title,
      category,
      description,
      is_private,
    })
  } catch (error: any) {
    console.error('[CARDS] API error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
