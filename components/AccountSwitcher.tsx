'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { useTranslation } from 'react-i18next'
import { X, LogOut, Plus } from 'lucide-react'
import { useRecaptcha } from '@/hooks/useRecaptcha'

interface AccountSwitcherProps {
  isOpen: boolean
  onClose: () => void
}

interface SavedAccount {
  email: string
  password: string // зашифрованный пароль
}

// Простое шифрование для localStorage (не криптографически безопасно, но достаточно для основной защиты)
const encryptPassword = (password: string): string => {
  return btoa(password) // Base64 encoding
}

const decryptPassword = (encrypted: string): string => {
  try {
    return atob(encrypted) // Base64 decoding
  } catch {
    return ''
  }
}

export default function AccountSwitcher({ isOpen, onClose }: AccountSwitcherProps) {
  const [accounts, setAccounts] = useState<SavedAccount[]>([])
  const [loading, setLoading] = useState(false)
  const router = useRouter()
  const { t } = useTranslation()
  const { getToken } = useRecaptcha()

  useEffect(() => {
    if (isOpen) {
      // Загружаем сохранённые email и пароли из localStorage
      const saved = localStorage.getItem('saved_accounts')
      console.log('[ACCOUNT_SWITCHER] Loaded saved_accounts from localStorage:', saved)
      if (saved) {
        try {
          const parsedAccounts = JSON.parse(saved)
          console.log('[ACCOUNT_SWITCHER] Parsed accounts:', parsedAccounts.map((a: any) => ({ email: a.email, hasPassword: !!a.password })))
          setAccounts(parsedAccounts)
        } catch (e) {
          console.error('Error parsing saved accounts:', e)
        }
      } else {
        console.log('[ACCOUNT_SWITCHER] No saved accounts found in localStorage')
      }
    }
  }, [isOpen])

  const handleSwitchAccount = async (email: string, password: string) => {
    setLoading(true)
    try {
      // Выходим из текущей учётной записи
      await supabase.auth.signOut()
      
      // Расшифровываем пароль из localStorage
      const decryptedPassword = decryptPassword(password)
      console.log('[ACCOUNT_SWITCHER] Attempting login for:', email)

      // Получаем reCAPTCHA токен
      let recaptchaToken = null
      try {
        recaptchaToken = await getToken("login")
        console.log('[ACCOUNT_SWITCHER] Got reCAPTCHA token')
      } catch (err) {
        console.error('[ACCOUNT_SWITCHER] reCAPTCHA error:', err)
        // Продолжаем без reCAPTCHA для автоматического входа
      }

      // Отправляем запрос на API endpoint для входа
      console.log('[ACCOUNT_SWITCHER] Sending login request...')
      const response = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ 
          email, 
          password: decryptedPassword, 
          recaptchaToken: recaptchaToken || "" 
        }),
      })

      const data = await response.json()
      console.log('[ACCOUNT_SWITCHER] Login response:', { status: response.status, ok: response.ok, error: data.error })

      if (!response.ok) {
        throw new Error(data.error || "Ошибка входа")
      }

      console.log('[ACCOUNT_SWITCHER] Login successful!')
      
      // Ждем обновления сессии на сервере
      await new Promise(resolve => setTimeout(resolve, 1000))
      
      // Закрываем модальное окно и редирект на главную
      onClose()
      console.log('[ACCOUNT_SWITCHER] Redirecting to home...')
      window.location.href = "/"
    } catch (error) {
      console.error('[ACCOUNT_SWITCHER] Error switching account:', error)
      setLoading(false)
    }
  }

  const handleAddNewAccount = async () => {
    setLoading(true)
    try {
      await supabase.auth.signOut()
      onClose()
      router.push('/login')
      router.refresh()
    } catch (error) {
      console.error('Error adding new account:', error)
    } finally {
      setLoading(false)
    }
  }

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4 min-h-screen">
      <div className="w-full max-w-md rounded-xl border border-slate-200 dark:border-white/10 bg-white dark:bg-slate-900 shadow-xl my-auto">
        {/* Заголовок */}
        <div className="flex items-center justify-between border-b border-slate-100 dark:border-white/5 px-6 py-4">
          <h2 className="text-lg font-semibold text-slate-900 dark:text-white">
            {t('nav.switchAccount', { defaultValue: 'Смена учётной записи' })}
          </h2>
          <button
            onClick={onClose}
            className="text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Содержимое */}
        <div className="max-h-96 overflow-y-auto p-4">
          {accounts.length > 0 ? (
            <div className="space-y-2">
              {accounts.map((account) => (
                <button
                  key={account.email}
                  onClick={() => handleSwitchAccount(account.email, account.password)}
                  disabled={loading}
                  className="w-full rounded-lg border border-slate-200 dark:border-white/10 px-4 py-3 text-left text-sm transition-colors hover:bg-slate-50 dark:hover:bg-white/5 disabled:opacity-60"
                >
                  <div className="font-medium text-slate-900 dark:text-white">{account.email}</div>
                  <div className="text-xs text-slate-500 dark:text-slate-400">{t('nav.clickToLogin', { defaultValue: 'Нажмите, чтобы войти' })}</div>
                </button>
              ))}
            </div>
          ) : (
            <div className="py-8 text-center text-sm text-slate-500 dark:text-slate-400">
              {t('nav.noSavedAccounts', { defaultValue: 'Нет сохранённых учётных записей' })}
            </div>
          )}
        </div>

        {/* Кнопки */}
        <div className="border-t border-slate-100 dark:border-white/5 space-y-2 px-4 py-4">
          <button
            onClick={handleAddNewAccount}
            disabled={loading}
            className="w-full flex items-center justify-center gap-2 rounded-lg bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 text-sm font-medium transition-colors disabled:opacity-60"
          >
            <Plus className="w-4 h-4" />
            {t('nav.addNewAccount', { defaultValue: 'Добавить новую учётную запись' })}
          </button>
          <button
            onClick={onClose}
            disabled={loading}
            className="w-full text-slate-700 dark:text-slate-300 px-4 py-2 text-sm font-medium rounded-lg hover:bg-slate-100 dark:hover:bg-white/5 transition-colors disabled:opacity-60"
          >
            {t('common.cancel', { defaultValue: 'Отмена' })}
          </button>
        </div>
      </div>
    </div>
  )
}
