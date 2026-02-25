import { useEffect, useState } from 'react'

/**
 * Возвращает true после монтирования компонента на клиенте.
 * Во время SSR всегда возвращает false.
 * Используется для предотвращения ошибок гидратации при работе с i18n, темами и т.п.
 */
export function useHasMounted(): boolean {
  const [hasMounted, setHasMounted] = useState(false)

  useEffect(() => {
    setHasMounted(true)
  }, [])

  return hasMounted
}
