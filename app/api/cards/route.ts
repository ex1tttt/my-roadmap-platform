import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { topologicalInsertOrder } from '@/lib/gantt-tree'

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
      card_type,
      steps, 
      tasks,
      resources,
      recaptchaToken 
    } = await req.json()

    console.log('[CARDS] Parsed request body:', {
      title: title?.substring(0, 20),
      category,
      card_type,
    })

    // reCAPTCHA не требуется на карточках - защита через логин + RLS политика

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
        card_type: card_type === 'gantt' ? 'gantt' : 'list',
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

    // Вставляем задачи gantt если они есть
    if (Array.isArray(tasks) && tasks.length > 0) {
      const rows = tasks.map((task: any) => ({
        id: task.id,
        parent_id: task.parent_id ?? null,
        order: task.order ?? 0,
        card_id: cardId,
        title: task.title?.trim().slice(0, 200) || '',
        description: task.description?.trim().slice(0, 5000) || '',
        start_date: task.start_date || null,
        end_date: task.end_date || null,
        priority: ['low', 'medium', 'high'].includes(task.priority) ? task.priority : 'medium',
        assignee: task.assignee?.trim().slice(0, 200) || null,
      }))
      const ordered = topologicalInsertOrder(rows)
      const tasksPayload = ordered.map((task) => ({
        id: task.id,
        card_id: cardId,
        parent_id: task.parent_id ?? null,
        order: task.order ?? 0,
        title: task.title,
        description: task.description,
        start_date: task.start_date,
        end_date: task.end_date,
        priority: task.priority,
        assignee: task.assignee,
      }))

      const { error: tasksError } = await supabaseAdmin
        .from('gantt_tasks')
        .insert(tasksPayload)

      if (tasksError) {
        console.error('[CARDS] Gantt tasks insert error:', tasksError)
        return NextResponse.json({ error: 'Failed to create gantt tasks' }, { status: 500 })
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
      card_type: card_type === 'gantt' ? 'gantt' : 'list',
    })
  } catch (error: any) {
    console.error('[CARDS] API error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
