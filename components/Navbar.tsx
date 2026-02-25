'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import type { Session } from '@supabase/supabase-js'
import { Map, Plus, LogIn, UserPlus, LogOut, User } from 'lucide-react'
import NotificationBell from '@/components/NotificationBell'
import ThemeToggle from '@/components/ThemeToggle'
import { useTranslation } from 'react-i18next'
import { saveLanguage, type SupportedLanguage } from '@/lib/i18n'

export default function Navbar() {
  const [session, setSession] = useState<Session | null>(null)
  const [username, setUsername] = useState('')
  const [usernameLoading, setUsernameLoading] = useState(false)
  const router = useRouter()
  const { t, i18n } = useTranslation()

  // Загружаем username и language из таблицы profiles
  async function loadUsername(userId: string) {
    setUsernameLoading(true)
    const { data } = await supabase
      .from('profiles')
      .select('username, language')
      .eq('id', userId)
      .single()
    setUsername(data?.username ?? '')
    // Применяем язык из БД, если он задан
    const lang = (data?.language ?? '') as SupportedLanguage
    if (lang && lang !== i18n.language) {
      await i18n.changeLanguage(lang)
      saveLanguage(lang)
    }
    setUsernameLoading(false)
  }

  useEffect(() => {
    // Получаем текущую сессию при монтировании
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session)
      if (session?.user) loadUsername(session.user.id)
    })

    // Подписываемся на изменения состояния авторизации
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session)
      if (session?.user) {
        loadUsername(session.user.id)
      } else {
        setUsername('')
      }
    })

    return () => subscription.unsubscribe()
  }, [])

  // Realtime: обновляем username если пользователь изменил его в настройках
  useEffect(() => {
    if (!session?.user) return

    const userId = session.user.id
    const channel = supabase
      .channel(`profile-navbar-${userId}`)
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'profiles', filter: `id=eq.${userId}` },
        (payload) => {
          const newUsername = (payload.new as any)?.username
          if (newUsername) setUsername(newUsername)
        }
      )
      .subscribe()

    return () => { supabase.removeChannel(channel) }
  }, [session?.user?.id])

  const handleSignOut = async () => {
    await supabase.auth.signOut()
    router.push('/')
    router.refresh()
  }

  return (
    <header className="sticky top-0 z-50 w-full bg-white/70 dark:bg-[#020617]/70 backdrop-blur-md border-b border-slate-200 dark:border-slate-800 transition-colors">
      <nav className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
        {/* Логотип */}
        <Link
          href="/"
          className="flex items-center gap-2 text-slate-900 dark:text-white font-bold text-xl hover:text-blue-500 dark:hover:text-blue-400 transition-colors"
        >
          <Map className="w-6 h-6 text-blue-400" />
          Roadmaps
        </Link>

        {/* Правая часть */}
        <div className="flex items-center gap-3">
          <ThemeToggle />
          {session ? (
            <>
              {/* Колокольчик уведомлений */}
              <NotificationBell userId={session.user.id} />

              {/* Кнопка Создать */}
              <Link
                href="/create"
                className="flex items-center gap-1.5 bg-blue-600 hover:bg-blue-500 text-white text-sm font-medium px-3 py-1.5 rounded-lg transition-colors"
              >
                <Plus className="w-4 h-4" />
                {t('nav.create')}
              </Link>

              {/* Имя пользователя */}
              <Link
                href="/profile"
                className="flex items-center gap-1.5 text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white text-sm px-3 py-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-white/10 transition-colors"
              >
                <User className="w-4 h-4" />
                {usernameLoading ? (
                  <span className="h-3.5 w-20 animate-pulse rounded bg-white/10" />
                ) : (
                  username || session.user.email?.split('@')[0] || t('nav.profile')
                )}
              </Link>

              {/* Кнопка Выйти */}
              <button
                onClick={handleSignOut}
                className="flex items-center gap-1.5 text-slate-600 dark:text-slate-300 hover:text-red-500 dark:hover:text-red-400 text-sm px-3 py-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-white/10 transition-colors"
              >
                <LogOut className="w-4 h-4" />
                {t('nav.logout')}
              </button>
            </>
          ) : (
            <>
              {/* Войти */}
              <Link
                href="/login"
                className="flex items-center gap-1.5 text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white text-sm px-3 py-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-white/10 transition-colors"
              >
                <LogIn className="w-4 h-4" />
                {t('nav.login')}
              </Link>

              {/* Регистрация */}
              <Link
                href="/register"
                className="flex items-center gap-1.5 bg-blue-600 hover:bg-blue-500 text-white text-sm font-medium px-3 py-1.5 rounded-lg transition-colors"
              >
                <UserPlus className="w-4 h-4" />
                {t('nav.register')}
              </Link>
            </>
          )}
        </div>
      </nav>
    </header>
  )
}
