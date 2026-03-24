/**
 * Верификация reCAPTCHA v3 токена на сервере
 */
export async function verifyRecaptchaToken(token: string): Promise<{
  success: boolean
  score: number
  action: string
}> {
  if (!process.env.RECAPTCHA_SECRET_KEY) {
    console.error('RECAPTCHA_SECRET_KEY не установлен')
    return { success: false, score: 0, action: '' }
  }

  try {
    const response = await fetch('https://www.google.com/recaptcha/api/siteverify', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: `secret=${process.env.RECAPTCHA_SECRET_KEY}&response=${token}`,
    })

    const data = await response.json()

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
 * @param threshold Минимальный допустимый score (по умолчанию 0.5)
 */
export function isValidScore(score: number, threshold = 0.5): boolean {
  return score >= threshold
}
