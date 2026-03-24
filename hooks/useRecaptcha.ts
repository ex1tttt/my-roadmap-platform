'use client'

import { useCallback } from 'react'

/**
 * Хук для получения reCAPTCHA v3 токена
 */
export function useRecaptcha() {
  const getToken = useCallback(async (action: string = 'submit'): Promise<string | null> => {
    try {
      if (!window.grecaptcha) {
        console.error('reCAPTCHA не загружена')
        return null
      }

      const token = await window.grecaptcha.execute(
        process.env.NEXT_PUBLIC_RECAPTCHA_SITE_KEY!,
        { action }
      )

      return token
    } catch (error) {
      console.error('Ошибка при получении reCAPTCHA токена:', error)
      return null
    }
  }, [])

  return { getToken }
}

// Расширить Window интерфейс для TypeScript
declare global {
  interface Window {
    grecaptcha: {
      execute: (siteKey: string, options: { action: string }) => Promise<string>
    }
  }
}
