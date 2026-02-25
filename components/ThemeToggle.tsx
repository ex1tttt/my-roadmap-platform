'use client'

import { useEffect, useState } from 'react'
import { useTheme } from 'next-themes'
import { Sun, Moon } from 'lucide-react'

export default function ThemeToggle() {
  const { theme, setTheme } = useTheme()
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setMounted(true)
  }, [])

  // Не рендерим на сервере — избегаем ошибок гидратации
  if (!mounted) {
    return <div className="h-8 w-8" />
  }

  const isDark = theme === 'dark'

  return (
    <button
      onClick={() => setTheme(isDark ? 'light' : 'dark')}
      aria-label={isDark ? 'Переключить на светлую тему' : 'Переключить на тёмную тему'}
      className="relative flex h-8 w-8 items-center justify-center rounded-full text-slate-500 dark:text-slate-400 transition-colors hover:bg-slate-100 dark:hover:bg-white/10 hover:text-slate-900 dark:hover:text-white"
    >
      <Sun
        className={`absolute h-4 w-4 transition-all duration-300 ${
          isDark ? 'scale-100 opacity-100 rotate-0' : 'scale-0 opacity-0 rotate-90'
        }`}
      />
      <Moon
        className={`absolute h-4 w-4 transition-all duration-300 ${
          isDark ? 'scale-0 opacity-0 -rotate-90' : 'scale-100 opacity-100 rotate-0'
        }`}
      />
    </button>
  )
}
