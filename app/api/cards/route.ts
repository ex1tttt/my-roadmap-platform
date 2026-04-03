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
    const { 
      title, 
      category, 
      description, 
      is_private, 
      steps, 
      resources,
      recaptchaToken 
    } = await req.json()

    // Проверка reCAPTCHA токена
    if (!recaptchaToken) {
      return NextResponse.json(
        { error: 'reCAPTCHA token not provided' },
        { status: 400 }
      )
    }

    const captchaResult = await verifyRecaptchaToken(recaptchaToken)
    if (!captchaResult.success || !isValidScore(captchaResult.score)) {
      console.warn('[CARDS] reCAPTCHA validation failed:', {
        success: captchaResult.success,
        score: captchaResult.score,
      })
      return NextResponse.json(
        { error: 'Failed security check' },
        { status: 403 }
      )
    }

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
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Создаём карточку
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
      console.error('[CARDS] Card insert error:', cardError)
      return NextResponse.json({ error: cardError.message }, { status: 500 })
    }

    const cardId = cardData.id

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
