'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import type { Session } from '@supabase/supabase-js'

/**
 * Хук для получения и отслеживания сессии пользователя
 * Автоматически обновляет сессию при изменении статуса аутентификации
 */
export function useAuth() {
  const [session, setSession] = useState<Session | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    // Получаем текущую сессию
    const initSession = async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession()
        console.log('[useAuth] Initial session:', session?.user?.id ? 'logged in' : 'not logged in')
        setSession(session)
      } catch (error) {
        console.error('[useAuth] Error getting session:', error)
      } finally {
        setLoading(false)
      }
    }

    initSession()

    // Подписываемся на изменения сессии
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      console.log('[useAuth] Auth state changed:', { event, userId: session?.user?.id })
      setSession(session)
      setLoading(false)
    })

    return () => subscription.unsubscribe()
  }, [])

  return { session, loading }
}
