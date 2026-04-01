'use client'

import { useCallback } from 'react'

/**
 * Ожидание загрузки reCAPTCHA скрипта
 */
function waitForGreCaptcha(timeout = 10000): Promise<typeof window.grecaptcha> {
  return new Promise((resolve, reject) => {
    const startTime = Date.now()
    
    const check = () => {
      if (window.grecaptcha) {
        resolve(window.grecaptcha)
      } else if (Date.now() - startTime > timeout) {
        reject(new Error('reCAPTCHA failed to load within timeout'))
      } else {
        setTimeout(check, 100)
      }
    }
    
    check()
  })
}

/**
 * Хук для получения reCAPTCHA v3 токена
 */
export function useRecaptcha() {
  const getToken = useCallback(async (action: string = 'submit'): Promise<string | null> => {
    try {
      // Ожидаем загрузки grecaptcha если её еще нет
      let grecaptcha = window.grecaptcha
      if (!grecaptcha) {
        console.log('Waiting for reCAPTCHA to load...')
        grecaptcha = await waitForGreCaptcha()
      }

      if (!grecaptcha) {
        console.error('reCAPTCHA не загружена после ожидания')
        return null
      }

      const token = await grecaptcha.execute(
        process.env.NEXT_PUBLIC_RECAPTCHA_SITE_KEY!,
        { action }
      )

      console.log(`reCAPTCHA token obtained for action: ${action}`)
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
