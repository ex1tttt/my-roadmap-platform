'use client'

import { useState, useEffect, ReactNode } from 'react'

interface Props {
  children: ReactNode
  /** Класс/стиль-заглушки во время SSR. По умолчанию — невидимый блок без высоты. */
  fallback?: ReactNode
}

/**
 * Рендерит children только на клиенте (после гидратации).
 * На сервере возвращает fallback (по умолчанию — пустой <div>).
 * Предотвращает ошибки гидратации для компонентов, зависящих от
 * browser-only API (localStorage, navigator, i18n и т.д.).
 */
export default function ClientOnly({ children, fallback = <div /> }: Props) {
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setMounted(true)
  }, [])

  if (!mounted) return <>{fallback}</>

  return <>{children}</>
}
