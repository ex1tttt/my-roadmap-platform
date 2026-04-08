/**
 * Верификация reCAPTCHA v3 токена на сервере
 */
export async function verifyRecaptchaToken(token: string): Promise<{
  success: boolean
  score: number
  action: string
}> {
  const secretKey = process.env.RECAPTCHA_SECRET_KEY
  
  // В режиме разработки (localhost) пропускаем валидацию для удобства
  if (process.env.NODE_ENV === 'development') {
    console.log('[reCAPTCHA] Development mode - accepting token without verification')
    return { success: true, score: 0.9, action: 'submit' }
  }

  if (!secretKey) {
    console.error('[reCAPTCHA] RECAPTCHA_SECRET_KEY не установлен на сервере')
    // На продакшене без SECRET_KEY не можем проверить - возвращаем ошибку
    return { success: false, score: 0, action: '' }
  }

  try {
    console.log('[reCAPTCHA] Verifying token...', {
      tokenLength: token.length,
      tokenStart: token.substring(0, 10) + '...',
      siteKey: process.env.NEXT_PUBLIC_RECAPTCHA_SITE_KEY?.substring(0, 10) + '...'
    })

    const response = await fetch('https://www.google.com/recaptcha/api/siteverify', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: `secret=${secretKey}&response=${token}`,
    })

    const data = await response.json()

    // Логирование для отладки
    console.log('[reCAPTCHA] verification result:', {
      success: data.success,
      score: data.score,
      action: data.action,
      challenge_ts: data.challenge_ts,
      hostname: data.hostname,
      errorCodes: data['error-codes'],
      httpStatus: response.status
    })

    // Если Google вернул ошибку - логируем подробно
    if (!data.success || data['error-codes']?.length > 0) {
      console.warn('[reCAPTCHA] Verification failed:', {
        success: data.success,
        errors: data['error-codes'],
        fullResponse: JSON.stringify(data)
      })
    }

    // Возвращаем результат проверки
    return {
      success: data.success,
      score: data.score || 0,
      action: data.action || '',
    }
  } catch (error) {
    console.error('Ошибка при проверке reCAPTCHA:', error)
    return { success: false, score: 0, action: '' }
  }
}

/**
 * Проверка, прошла ли капча минимальный порог
 * @param score Score от Google (0.0 - 1.0)
 * @param threshold Минимальный допустимый score (по умолчанию 0.1 для теста)
 */
export function isValidScore(score: number, threshold = 0.1): boolean {
  const isValid = score >= threshold
  console.log(`reCAPTCHA score validation: score=${score}, threshold=${threshold}, valid=${isValid}`)
  return isValid
}
