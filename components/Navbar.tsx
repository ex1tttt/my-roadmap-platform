'use client'

import { useEffect, useRef, useState } from 'react'
import { useHasMounted } from '@/hooks/useHasMounted'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import type { Session } from '@supabase/supabase-js'
import { Map, Plus, LogIn, UserPlus, LogOut, User, Rss, Clock, Settings, Sun, Moon, ChevronDown, TrendingUp, Heart, Bookmark, Trophy, Headphones, Flag } from 'lucide-react'
import NotificationBell from '@/components/NotificationBell'
import { useTheme } from 'next-themes'
import { useTranslation } from 'react-i18next'
import { saveLanguage, type SupportedLanguage } from '@/lib/i18n'

const ADMIN_IDS = [
  'a48b5f93-2e98-48c8-98f1-860ca962f651',
  'b63af445-e18d-4e5b-a0e1-ba747f2b4948',
]

export default function Navbar() {
  const [session, setSession] = useState<Session | null>(null)
  const [username, setUsername] = useState('')
  const [usernameLoading, setUsernameLoading] = useState(false)
  const [dropdownOpen, setDropdownOpen] = useState(false)
  const dropdownRef = useRef<HTMLDivElement>(null)
  const mounted = useHasMounted()
  const router = useRouter()
  const { t, i18n } = useTranslation()
  const { resolvedTheme, setTheme } = useTheme()
  const isDark = resolvedTheme === 'dark'

  // Загружаем username и language из таблицы profiles
  async function loadUsername(userId: string) {
    setUsernameLoading(true)
    try {
      const { data } = await supabase
        .from('profiles')
        .select('username, language')
        .eq('id', userId)
        .single()
      
      console.log('[NAVBAR] Profile loaded:', { username: data?.username, language: data?.language })
      
      setUsername(data?.username ?? '')
      // Применяем язык из БД, если он задан
      const lang = (data?.language ?? '') as SupportedLanguage
      if (lang && lang !== i18n.language) {
        await i18n.changeLanguage(lang)
        saveLanguage(lang)
      }
    } catch (error) {
      console.error('[NAVBAR] Error loading profile:', error)
      setUsername('')
    } finally {
      setUsernameLoading(false)
    }
  }

  useEffect(() => {
    // Получаем текущую сессию при монтировании
    console.log('[NAVBAR] Loading session on mount...')
    supabase.auth.getSession().then(({ data: { session } }) => {
      console.log('[NAVBAR] Initial session:', session?.user?.id ? 'logged in' : 'not logged in')
      setSession(session)
      if (session?.user) {
        loadUsername(session.user.id)
        // Обновляем время последнего онлайна
        supabase.from('profiles').update({ last_seen: new Date().toISOString() }).eq('id', session.user.id).then()
      }
    })

    // Подписываемся на изменения состояния авторизации
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      console.log('[NAVBAR] Auth state changed:', { event, userId: session?.user?.id })
      setSession(session)
      if (session?.user) {
        console.log('[NAVBAR] User logged in:', session.user.id)
        loadUsername(session.user.id)
      } else {
        console.log('[NAVBAR] User logged out')
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
    setDropdownOpen(false)
    await supabase.auth.signOut()
    router.push('/')
    router.refresh()
  }

  // Закрываем dropdown при клике вне
  useEffect(() => {
    function handleOutside(e: PointerEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setDropdownOpen(false)
      }
    }
    document.addEventListener('pointerdown', handleOutside)
    return () => document.removeEventListener('pointerdown', handleOutside)
  }, [])

  return (
    <header className="sticky top-0 z-50 w-full bg-white/70 dark:bg-[#020617]/70 backdrop-blur-md border-b border-slate-200/60 dark:border-slate-800 transition-colors">
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
        <div className="flex items-center gap-1 sm:gap-3">
          {session ? (
            <>
              {/* Колокольчик уведомлений */}
              <NotificationBell userId={session.user.id} />

              {/* Лента */}
              <Link
                href="/feed"
                suppressHydrationWarning
                className="flex items-center gap-1.5 text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white text-sm px-2 py-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800/50 transition-colors"
              >
                <Rss className="w-4 h-4" />
                <span className="hidden sm:inline">{mounted ? t('nav.feed') : ''}</span>
              </Link>

              {/* Кнопка Создать */}
              <Link
                href="/create"
                suppressHydrationWarning
                className="flex items-center gap-1.5 bg-blue-600 hover:bg-blue-500 text-white text-sm font-medium px-2 sm:px-3 py-1.5 rounded-lg transition-colors"
              >
                <Plus className="w-4 h-4" />
                <span className="hidden sm:inline">{mounted ? t('nav.create') : ''}</span>
              </Link>

              {/* Dropdown с именем пользователя */}
              <div className="relative" ref={dropdownRef}>
                <button
                  onClick={() => setDropdownOpen((v) => !v)}
                  suppressHydrationWarning
                  className="flex items-center gap-1.5 text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white text-sm px-3 py-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800/50 transition-colors"
                >
                  <User className="w-4 h-4" />
                  <span className="hidden sm:inline max-w-30 truncate">
                    {usernameLoading ? (
                      <span className="h-3.5 w-20 animate-pulse rounded bg-white/10" />
                    ) : (
                      username || session.user.email?.split('@')[0] || (mounted ? t('nav.profile') : '')
                    )}
                  </span>
                  <ChevronDown className={`w-3.5 h-3.5 transition-transform ${dropdownOpen ? 'rotate-180' : ''}`} />
                </button>

                {dropdownOpen && (
                  <div className="absolute right-0 mt-2 w-52 rounded-xl border border-slate-200 dark:border-white/10 bg-white dark:bg-slate-900 shadow-xl py-1 z-50">
                    {/* Профиль */}
                    <Link
                      href="/profile"
                      onClick={() => setDropdownOpen(false)}
                      className="flex items-center gap-2.5 px-4 py-2.5 text-sm text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-white/5 transition-colors"
                    >
                      <User className="w-4 h-4" />
                      {t('nav.profile')}
                    </Link>

                    {/* История */}
                    <Link
                      href="/history"
                      onClick={() => setDropdownOpen(false)}
                      className="flex items-center gap-2.5 px-4 py-2.5 text-sm text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-white/5 transition-colors"
                    >
                      <Clock className="w-4 h-4" />
                      {t('nav.history')}
                    </Link>

                    {/* Понравилось */}
                    <Link
                      href="/liked"
                      onClick={() => setDropdownOpen(false)}
                      className="flex items-center gap-2.5 px-4 py-2.5 text-sm text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-white/5 transition-colors"
                    >
                      <Heart className="w-4 h-4" />
                      {t('nav.liked')}
                    </Link>

                    {/* Избранное */}
                    <Link
                      href="/favorites"
                      onClick={() => setDropdownOpen(false)}
                      className="flex items-center gap-2.5 px-4 py-2.5 text-sm text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-white/5 transition-colors"
                    >
                      <Bookmark className="w-4 h-4" />
                      {t('nav.favorites')}
                    </Link>

                    {/* Достижения */}
                    <Link
                      href="/achievements"
                      onClick={() => setDropdownOpen(false)}
                      className="flex items-center gap-2.5 px-4 py-2.5 text-sm text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-white/5 transition-colors"
                    >
                      <Trophy className="w-4 h-4" />
                      {t('nav.achievements')}
                    </Link>

                    {/* Смена темы */}
                    <button
                      onClick={() => setTheme(isDark ? 'light' : 'dark')}
                      className="flex w-full items-center gap-2.5 px-4 py-2.5 text-sm text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-white/5 transition-colors"
                    >
                      {mounted && isDark ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
                      {mounted ? (isDark ? t('nav.lightTheme') : t('nav.darkTheme')) : t('nav.systemTheme')}
                    </button>

                    {/* Статистика */}
                    <Link
                      href="/stats"
                      onClick={() => setDropdownOpen(false)}
                      className="flex items-center gap-2.5 px-4 py-2.5 text-sm text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-white/5 transition-colors"
                    >
                      <TrendingUp className="w-4 h-4" />
                      {t('nav.stats')}
                    </Link>

                    {/* Панель поддержки — только для администраторов */}
                    {ADMIN_IDS.includes(session.user.id) && (
                      <>
                        <div className="my-1 border-t border-slate-100 dark:border-white/5" />
                        <Link
                          href="/admin/support"
                          onClick={() => setDropdownOpen(false)}
                          className="flex items-center gap-2.5 px-4 py-2.5 text-sm text-violet-600 dark:text-violet-400 hover:bg-violet-50 dark:hover:bg-violet-500/10 transition-colors"
                        >
                          <Headphones className="w-4 h-4" />
                          {t('support.adminTitle')}
                        </Link>
                          <Link
                            href="/admin/reports"
                            onClick={() => setDropdownOpen(false)}
                            className="flex items-center gap-2.5 px-4 py-2.5 text-sm text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-500/10 transition-colors"
                          >
                            <Flag className="w-4 h-4" />
                            {t('adminReports.title', { defaultValue: 'Жалобы на карточки' })}
                          </Link>
                      </>
                    )}

                    <div className="my-1 border-t border-slate-100 dark:border-white/5" />

                    {/* Настройки */}
                    <Link
                      href="/settings"
                      onClick={() => setDropdownOpen(false)}
                      className="flex items-center gap-2.5 px-4 py-2.5 text-sm text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-white/5 transition-colors"
                    >
                      <Settings className="w-4 h-4" />
                      {t('nav.settings')}
                    </Link>

                    {/* Выход */}
                    <button
                      onClick={handleSignOut}
                      className="flex w-full items-center gap-2.5 px-4 py-2.5 text-sm text-red-500 dark:text-red-400 hover:bg-slate-100 dark:hover:bg-white/5 transition-colors"
                    >
                      <LogOut className="w-4 h-4" />
                      {t('nav.logout')}
                    </button>
                  </div>
                )}
              </div>
            </>
          ) : (
            <>
              {/* Войти */}
              <Link
                href="/login"
                suppressHydrationWarning
                className="flex items-center gap-1.5 text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white text-sm px-3 py-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800/50 transition-colors"
              >
                <LogIn className="w-4 h-4" />
                {mounted ? t('nav.login') : ''}
              </Link>

              {/* Регистрация */}
              <Link
                href="/register"
                suppressHydrationWarning
                className="flex items-center gap-1.5 bg-blue-600 hover:bg-blue-500 text-white text-sm font-medium px-3 py-1.5 rounded-lg transition-colors"
              >
                <UserPlus className="w-4 h-4" />
                {mounted ? t('nav.register') : ''}
              </Link>
            </>
          )}
        </div>
      </nav>
    </header>
  )
}
