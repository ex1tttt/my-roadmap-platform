'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { useTranslation } from 'react-i18next'
import { ArrowLeft, Flag, CheckCircle, Clock, XCircle, Loader2, ExternalLink } from 'lucide-react'

const ADMIN_IDS = [
  'a48b5f93-2e98-48c8-98f1-860ca962f651',
  'b63af445-e18d-4e5b-a0e1-ba747f2b4948',
]

const STATUS_COLORS = {
  pending: 'text-yellow-400 bg-yellow-400/10 border-yellow-400/30',
  reviewed: 'text-blue-400 bg-blue-400/10 border-blue-400/30',
  resolved: 'text-green-400 bg-green-400/10 border-green-400/30',
}

type Report = {
  id: string
  reason: string
  description: string | null
  status: 'pending' | 'reviewed' | 'resolved'
  created_at: string
  card_id: string
  reporter_id: string
  cards: { id: string; title: string; user_id: string } | null
  profiles: { id: string; username: string; avatar: string | null } | null
}

export default function AdminReportsPage() {
  const router = useRouter()
  const { t } = useTranslation()
  const [authorized, setAuthorized] = useState<boolean | null>(null)
  const [reports, setReports] = useState<Report[]>([])
  const [loading, setLoading] = useState(true)
  const [activeStatus, setActiveStatus] = useState<'pending' | 'reviewed' | 'resolved'>('pending')
  const [updating, setUpdating] = useState<string | null>(null)
  const [fetchError, setFetchError] = useState<string | null>(null)

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!session || !ADMIN_IDS.includes(session.user.id)) {
        setAuthorized(false)
        router.replace('/')
        return
      }
      setAuthorized(true)
      loadReports('pending')
    })
  }, [router])

  async function loadReports(status: 'pending' | 'reviewed' | 'resolved') {
    setLoading(true)
    setActiveStatus(status)
    setFetchError(null)
    try {
      const res = await fetch(`/api/report-card?status=${status}`)
      const json = await res.json()
      if (!res.ok) {
        setFetchError(json.error ?? `Ошибка ${res.status}`)
        setReports([])
      } else {
        setReports(json.data ?? [])
      }
    } catch (e: Error | unknown) {
      const error = e instanceof Error ? e : new Error(String(e))
      setFetchError(error.message)
    } finally {
      setLoading(false)
    }
  }

  async function updateStatus(id: string, newStatus: 'reviewed' | 'resolved') {
    if (updating) return
    setUpdating(id)
    try {
      const res = await fetch('/api/report-card', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, status: newStatus }),
      })
      if (res.ok) {
        setReports((prev) => prev.filter((r) => r.id !== id))
      }
    } finally {
      setUpdating(null)
    }
  }

  if (authorized === null) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-white dark:bg-[#020617]">
        <Loader2 className="animate-spin text-blue-500" size={40} />
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-[#020617] text-slate-900 dark:text-slate-100">
      <div className="mx-auto max-w-5xl px-4 sm:px-6 py-6 sm:py-8">
        {/* Шапка */}
        <div className="mb-6 flex flex-wrap items-center gap-3">
          <Link href="/" className="flex items-center gap-1.5 text-sm text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white">
            <ArrowLeft size={16} /> {t('adminReports.backHome')}
          </Link>
          <div className="flex items-center gap-2">
            <Flag className="text-red-500" size={20} />
            <h1 className="text-lg sm:text-xl font-bold">{t('adminReports.title')}</h1>
          </div>
        </div>

        {/* Табы статусов */}
        <div className="mb-6 flex flex-wrap gap-2">
          {(['pending', 'reviewed', 'resolved'] as const).map((s) => {
            const color = STATUS_COLORS[s]
            return (
              <button
                key={s}
                onClick={() => loadReports(s)}
                className={`rounded-xl border px-4 py-2 text-sm font-medium transition-all ${
                  activeStatus === s
                    ? color
                    : 'border-slate-200 dark:border-white/10 text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
                }`}
              >
                {t(`adminReports.tabs.${s}`)}
              </button>
            )
          })}
        </div>

        {/* Список жалоб */}
        {loading ? (
          <div className="flex justify-center py-20">
            <Loader2 className="animate-spin text-blue-500" size={32} />
          </div>
        ) : fetchError ? (
          <div className="rounded-2xl border border-red-500/30 bg-red-500/10 px-6 py-8 text-center text-red-400">
            <p className="font-semibold mb-1">{t('adminReports.loadError')}</p>
            <p className="text-sm text-red-500">{fetchError}</p>
            <p className="mt-3 text-xs text-slate-400">{t('adminReports.migrationHint')}</p>
          </div>
        ) : reports.length === 0 ? (
          <div className="rounded-2xl border border-slate-200 dark:border-white/10 bg-white dark:bg-white/5 py-16 text-center text-slate-400">
            <Flag className="mx-auto mb-3 text-slate-300 dark:text-slate-600" size={32} />
            <p>{t('adminReports.noReports')}</p>
          </div>
        ) : (
          <div className="space-y-4">
            {reports.map((report) => {
              const cardTitle = Array.isArray(report.cards)
                ? (report.cards[0]?.title ?? t('adminReports.cardDeleted'))
                : (report.cards?.title ?? t('adminReports.cardDeleted'))
              const cardId = Array.isArray(report.cards)
                ? report.cards[0]?.id
                : report.cards?.id
              const reporterName = Array.isArray(report.profiles)
                ? (report.profiles[0]?.username ?? t('adminReports.unknown'))
                : (report.profiles?.username ?? t('adminReports.unknown'))

              return (
                <div
                  key={report.id}
                  className="rounded-2xl border border-slate-200 dark:border-white/10 bg-white dark:bg-white/5 p-4 sm:p-5"
                >
                  <div className="flex flex-col gap-4 sm:flex-row sm:flex-wrap sm:items-start sm:justify-between">
                    <div className="min-w-0 flex-1">
                      {/* Карточка */}
                      <div className="mb-1 flex items-center gap-2">
                        <span className="text-xs text-slate-500">{t('adminReports.card')}:</span>
                        {cardId ? (
                          <a
                            href={`/card/${cardId}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="flex items-center gap-1 text-sm font-semibold text-blue-400 hover:underline"
                          >
                            {cardTitle}
                            <ExternalLink size={12} />
                          </a>
                        ) : (
                          <span className="text-sm text-slate-500 line-through">{cardTitle}</span>
                        )}
                      </div>

                      {/* Жалобщик */}
                      <div className="mb-2 flex items-center gap-2">
                        <span className="text-xs text-slate-500">{t('adminReports.from')}:</span>
                        <span className="text-sm text-slate-700 dark:text-slate-300">{reporterName}</span>
                      </div>

                      {/* Причина */}
                      <div className="mb-2 flex items-center gap-2">
                        <span className="rounded-full border border-red-500/30 bg-red-500/10 px-2.5 py-0.5 text-xs font-medium text-red-400">
                          {t(`report.reasons.${report.reason}`, { defaultValue: report.reason })}
                        </span>
                        <span className="text-xs text-slate-500">
                          {new Date(report.created_at).toLocaleDateString('ru-RU', {
                            day: '2-digit',
                            month: '2-digit',
                            year: 'numeric',
                            hour: '2-digit',
                            minute: '2-digit',
                          })}
                        </span>
                      </div>

                      {/* Описание */}
                      {report.description && (
                        <p className="mt-1 rounded-xl bg-slate-100 dark:bg-white/5 px-4 py-3 text-sm text-slate-700 dark:text-slate-300">
                          {report.description}
                        </p>
                      )}
                    </div>

                    {/* Действия */}
                    <div className="flex shrink-0 flex-row flex-wrap gap-2 sm:flex-col">
                      {report.status === 'pending' && (
                        <>
                          <button
                            disabled={updating === report.id}
                            onClick={() => updateStatus(report.id, 'reviewed')}
                            className="flex items-center gap-1.5 rounded-xl border border-blue-500/30 bg-blue-500/10 px-3 py-1.5 text-xs font-medium text-blue-400 transition-opacity hover:opacity-80 disabled:opacity-40"
                          >
                            <CheckCircle size={14} /> {t('adminReports.actions.reviewed')}
                          </button>
                          <button
                            disabled={updating === report.id}
                            onClick={() => updateStatus(report.id, 'resolved')}
                            className="flex items-center gap-1.5 rounded-xl border border-green-500/30 bg-green-500/10 px-3 py-1.5 text-xs font-medium text-green-400 transition-opacity hover:opacity-80 disabled:opacity-40"
                          >
                            <XCircle size={14} /> {t('adminReports.actions.resolved')}
                          </button>
                        </>
                      )}
                      {report.status === 'reviewed' && (
                        <button
                          disabled={updating === report.id}
                          onClick={() => updateStatus(report.id, 'resolved')}
                          className="flex items-center gap-1.5 rounded-xl border border-green-500/30 bg-green-500/10 px-3 py-1.5 text-xs font-medium text-green-400 transition-opacity hover:opacity-80 disabled:opacity-40"
                        >
                          <XCircle size={14} /> {t('adminReports.actions.resolved')}
                        </button>
                      )}
                      {report.status === 'resolved' && (
                        <span className="flex items-center gap-1.5 rounded-xl border border-green-500/30 bg-green-500/10 px-3 py-1.5 text-xs font-medium text-green-400">
                          <CheckCircle size={14} /> {t('adminReports.actions.closed')}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
