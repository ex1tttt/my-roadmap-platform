'use client'

import { useTranslation } from 'react-i18next'
import { Loader2 } from 'lucide-react'

interface PrivacyPolicyModalProps {
  isOpen: boolean
  onClose: () => void
  onAgree: () => Promise<void>
  isAgreed: boolean
  onAgreeChange: (agreed: boolean) => void
  isSaving: boolean
}

export default function PrivacyPolicyModal({
  isOpen,
  onClose,
  onAgree,
  isAgreed,
  onAgreeChange,
  isSaving,
}: PrivacyPolicyModalProps) {
  const { t } = useTranslation()

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="w-full max-w-2xl max-h-[80vh] overflow-y-auto rounded-lg bg-white dark:bg-slate-900 p-6">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-semibold text-slate-900 dark:text-white">
            {t('privacy.title')}
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200"
          >
            ✕
          </button>
        </div>

        <div className="prose dark:prose-invert mb-6 text-sm text-slate-700 dark:text-slate-300 space-y-4">
          {Object.keys(t('privacy.sections', { returnObjects: true }) || {}).map(
            (sectionKey) => {
              const section = t(`privacy.sections.${sectionKey}`, { returnObjects: true }) as any
              if (!section || !section.title) return null

              return (
                <section key={sectionKey}>
                  <h3 className="font-semibold text-slate-900 dark:text-white mb-2">
                    {section.title}
                  </h3>
                  {section.content && <p>{section.content}</p>}
                  {section.intro && <p>{section.intro}</p>}
                  {section.items && (
                    <ul className="list-disc list-inside space-y-1">
                      {section.items.map((item: string, idx: number) => (
                        <li key={idx}>{item}</li>
                      ))}
                    </ul>
                  )}
                </section>
              )
            }
          )}
        </div>

        <div className="space-y-3">
          <label className="flex items-center gap-3 cursor-pointer">
            <input
              type="checkbox"
              checked={isAgreed}
              onChange={(e) => onAgreeChange(e.target.checked)}
              className="h-4 w-4 rounded border-slate-300 dark:border-slate-600 accent-blue-500"
            />
            <span className="text-sm text-slate-700 dark:text-slate-300">
              {t('privacy.agreeLabel')}
            </span>
          </label>
          <div className="flex gap-3">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 rounded-lg border border-slate-200 dark:border-slate-700 px-4 py-2 text-sm font-medium text-slate-600 dark:text-slate-300 transition-all hover:bg-slate-50 dark:hover:bg-white/5"
            >
              {t('privacy.closeButton')}
            </button>
            <button
              type="button"
              onClick={onAgree}
              disabled={!isAgreed || isSaving}
              className="flex-1 inline-flex items-center justify-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white transition-all hover:bg-blue-500 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {isSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
              {isSaving ? t('common.saving') : t('privacy.agreeButton')}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
