'use client'

import { useState, useEffect } from 'react'
import { createPortal } from 'react-dom'
import { Flag, X } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'
import { supabase } from '@/lib/supabase'
import { useRecaptcha } from '@/hooks/useRecaptcha'

const REASONS = ['spam', 'inappropriate', 'misinformation', 'copyright', 'other'] as const
type Reason = typeof REASONS[number]

const REASON_ICONS: Record<Reason, string> = {
  spam: '🚫',
  inappropriate: '⚠️',
  misinformation: '❌',
  copyright: '©️',
  other: '💬',
}

interface Props {
  cardId: string
}

export default function ReportCardButton({ cardId }: Props) {
  const { t } = useTranslation()
  const { getToken: getRecaptchaToken } = useRecaptcha()
  const [open, setOpen] = useState(false)
  const [reason, setReason] = useState<Reason>('spam')
  const [description, setDescription] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [alreadyReported, setAlreadyReported] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Проверяем при загрузке — не жаловался ли уже этот пользователь
  useEffect(() => {
    supabase.auth.getUser().then(async ({ data: { user } }) => {
      if (!user) return
      const { data } = await supabase
        .from('card_reports')
        .select('id')
        .eq('card_id', cardId)
        .eq('reporter_id', user.id)
        .maybeSingle()
      if (data) setAlreadyReported(true)
    })
  }, [cardId])

  function handleClose() {
    setOpen(false)
    setDescription('')
    setReason('spam')
    setError(null)
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (submitting || alreadyReported) return
    setSubmitting(true)

    try {
      // Сначала проверяем локально перед запросом
      const { data: { user } } = await supabase.auth.getUser()
      if (user) {
        const { data: existing } = await supabase
          .from('card_reports')
          .select('id')
          .eq('card_id', cardId)
          .eq('reporter_id', user.id)
          .maybeSingle()
        if (existing) {
          setAlreadyReported(true)
          handleClose()
          return
        }
      }

      // Получаем reCAPTCHA токен
      const recaptchaToken = await getRecaptchaToken('report')
      if (!recaptchaToken) {
        setError('Не удалось инициализировать проверку безопасности')
        setSubmitting(false)
        return
      }

      const res = await fetch('/api/report-card', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ card_id: cardId, reason, description: description.trim(), recaptchaToken }),
      })
      const json = await res.json()

      if (!res.ok) {
        if (json.error === 'already_reported') {
          setAlreadyReported(true)
          handleClose()
          toast.info(t('report.alreadyReported'))
        } else {
          toast.error(t('report.error'))
        }
        return
      }

      toast.success(t('report.success'))
      setAlreadyReported(true)
      handleClose()
    } catch {
      toast.error(t('report.error'))
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <>
      {/* Кнопка-триггер */}
      <button
        onClick={() => !alreadyReported && setOpen(true)}
        title={alreadyReported ? t('report.alreadyReported') : t('report.label')}
        disabled={alreadyReported}
        className={`flex items-center gap-1.5 rounded-lg border px-2.5 py-1 text-xs transition-colors ${
          alreadyReported
            ? 'border-slate-200 dark:border-slate-700 bg-slate-100 dark:bg-white/5 text-slate-400 dark:text-slate-500 cursor-default'
            : 'border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-white/5 text-slate-500 dark:text-slate-400 hover:border-red-400/50 hover:bg-red-50 dark:hover:bg-red-500/10 hover:text-red-500 dark:hover:text-red-400'
        }`}
      >
        <Flag className="h-3.5 w-3.5" />
        {alreadyReported ? t('report.reported') : t('report.label')}
      </button>

      {/* Модальное окно */}
      {open && createPortal(
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm"
          onClick={(e) => { if (e.target === e.currentTarget) handleClose() }}
        >
          <div className="w-full max-w-md rounded-2xl border border-slate-200 dark:border-white/10 bg-white dark:bg-slate-900 shadow-2xl">
            {/* Заголовок */}
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-white/10 px-5 py-4">
              <div className="flex items-center gap-2.5">
                <div className="flex h-8 w-8 items-center justify-center rounded-full bg-red-100 dark:bg-red-500/15">
                  <Flag className="h-4 w-4 text-red-500" />
                </div>
                <div>
                  <h2 className="text-sm font-semibold text-slate-900 dark:text-slate-100">{t('report.title')}</h2>
                  <p className="text-xs text-slate-500 dark:text-slate-400">{t('report.subtitle')}</p>
                </div>
              </div>
              <button
                onClick={handleClose}
                className="rounded-lg p-1.5 text-slate-400 transition-colors hover:bg-slate-100 dark:hover:bg-white/10 hover:text-slate-600 dark:hover:text-slate-200"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <form onSubmit={handleSubmit}>
              {/* Причины */}
              <div className="px-5 pt-3 pb-1">
                <p className="mb-1.5 text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                  {t('report.reasonLabel')}
                </p>
                <div className="space-y-0.5">
                  {REASONS.map((r) => (
                    <button
                      key={r}
                      type="button"
                      onClick={() => setReason(r)}
                      className={`flex w-full items-center gap-3 rounded-xl px-3 py-2 text-sm transition-all ${
                        reason === r
                          ? 'bg-red-50 dark:bg-red-500/15 text-red-600 dark:text-red-400 ring-1 ring-red-300 dark:ring-red-500/40'
                          : 'text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-white/5'
                      }`}
                    >
                      <span className="text-base leading-none">{REASON_ICONS[r]}</span>
                      <span className="flex-1 text-left">{t(`report.reasons.${r}`)}</span>
                      {reason === r && (
                        <span className="ml-auto h-2 w-2 rounded-full bg-red-500 dark:bg-red-400" />
                      )}
                    </button>
                  ))}
                </div>
              </div>

              {/* Описание */}
              <div className="px-5 py-2">
                <p className="mb-1.5 text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                  {t('report.descriptionLabel')}
                </p>
                <textarea
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder={t('report.descriptionPlaceholder')}
                  rows={3}
                  maxLength={500}
                  className="w-full resize-none rounded-xl border border-slate-200 dark:border-white/10 bg-slate-50 dark:bg-white/5 px-3.5 py-2.5 text-sm text-slate-800 dark:text-slate-200 placeholder-slate-400 dark:placeholder-slate-500 outline-none focus:border-red-400 dark:focus:border-red-500/50 focus:ring-1 focus:ring-red-300 dark:focus:ring-red-500/30 transition-colors"
                />
                <p className="mt-1 text-right text-xs text-slate-400 dark:text-slate-500">{description.length}/500</p>
              </div>

              {/* Ошибка */}
              {error && (
                <div className="mx-5 mt-3 rounded-lg border border-red-200 dark:border-red-500/30 bg-red-50 dark:bg-red-500/10 px-3.5 py-2.5 text-sm text-red-600 dark:text-red-400">
                  {error}
                </div>
              )}

              {/* Кнопки */}
              <div className="flex gap-2 border-t border-slate-100 dark:border-white/10 px-5 py-3">
                <button
                  type="button"
                  onClick={handleClose}
                  className="flex-1 rounded-xl border border-slate-200 dark:border-white/10 py-2.5 text-sm font-medium text-slate-600 dark:text-slate-300 transition-colors hover:bg-slate-100 dark:hover:bg-white/5"
                >
                  {t('common.cancel')}
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="flex-1 rounded-xl bg-red-500 py-2.5 text-sm font-semibold text-white transition-all hover:bg-red-600 active:scale-[0.98] disabled:opacity-50"
                >
                  {submitting ? t('report.submitting') : t('report.submit')}
                </button>
              </div>
            </form>
          </div>
        </div>
      , document.body)}
    </>
  )
}

