
'use client'

import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { supabase } from '@/lib/supabase'
import { ALL_BADGES } from '@/components/ProfileBadges'
import { Trophy, Lock } from 'lucide-react'
import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'

export default function AchievementsPage() {
  const { t } = useTranslation()
  const [earnedIds, setEarnedIds] = useState<Set<string>>(new Set())
  const [loading, setLoading] = useState(true)
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setMounted(true)
    async function load() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { setLoading(false); return }
      const { data } = await supabase
        .from('user_badges')
        .select('badge_id')
        .eq('user_id', user.id)
      setEarnedIds(new Set((data ?? []).map((b: { badge_id: string }) => b.badge_id)))
      setLoading(false)
    }
    load()
  }, [])

  if (!mounted) return null

  const earned = ALL_BADGES.filter(b => earnedIds.has(b.id))
  const locked = ALL_BADGES.filter(b => !earnedIds.has(b.id))

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-[#020617] px-4 py-10">
      <div className="mx-auto max-w-2xl">

        {/* Назад */}
        <Link
          href="/settings"
          className="mb-6 inline-flex items-center gap-1.5 rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-white/5 px-3 py-1.5 text-xs text-slate-600 dark:text-slate-400 transition-colors hover:text-slate-900 dark:hover:text-slate-200"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          <span suppressHydrationWarning>{t('card.back')}</span>
        </Link>

        {/* Заголовок */}
        <div className="mb-8 flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-amber-400/15">
            <Trophy className="h-5 w-5 text-amber-400" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-slate-900 dark:text-white">
              {t('achievements.title')}
            </h1>
            {!loading && (
              <p className="text-sm text-slate-500 dark:text-slate-400">
                {earned.length} / {ALL_BADGES.length}
              </p>
            )}
          </div>
        </div>

        {loading ? (
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
            {Array(6).fill(0).map((_, i) => (
              <div key={i} className="h-40 rounded-xl bg-slate-200 dark:bg-white/5 animate-pulse" />
            ))}
          </div>
        ) : (
          <>
            {/* Полученные */}
            {earned.length > 0 && (
              <section className="mb-8">
                <h2 className="mb-4 text-xs font-semibold uppercase tracking-widest text-slate-500 dark:text-slate-400">
                  ✅ Получено ({earned.length})
                </h2>
                <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
                  {earned.map(badge => (
                    <div
                      key={badge.id}
                      className={`flex flex-col items-center gap-3 rounded-xl border p-5 ${badge.bgEarned} ${badge.ringEarned} ring-1 shadow-md ${badge.glow}`}
                    >
                      <span className="text-5xl leading-none">{badge.emoji}</span>
                      <div className="text-center">
                        <p className="text-sm font-semibold text-slate-800 dark:text-slate-100">
                          {t(`badges.${badge.id}.label`)}
                        </p>
                        <p className="mt-1 text-[11px] leading-snug text-slate-500 dark:text-slate-400">
                          {t(`badges.${badge.id}.description`)}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              </section>
            )}

            {/* Заблокированные */}
            {locked.length > 0 && (
              <section>
                <h2 className="mb-4 text-xs font-semibold uppercase tracking-widest text-slate-500 dark:text-slate-400">
                  🔒 Не получено ({locked.length})
                </h2>
                <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
                  {locked.map(badge => (
                    <div
                      key={badge.id}
                      className="flex flex-col items-center gap-3 rounded-xl border border-slate-200 dark:border-white/5 bg-slate-100/60 dark:bg-white/3 p-5 opacity-60"
                    >
                      <span className="text-5xl leading-none grayscale">{badge.emoji}</span>
                      <div className="text-center">
                        <p className="text-sm font-semibold text-slate-600 dark:text-slate-400">
                          {t(`badges.${badge.id}.label`)}
                        </p>
                        <p className="mt-1 flex items-center justify-center gap-1 text-[11px] leading-snug text-slate-400 dark:text-slate-500">
                          <Lock className="h-2.5 w-2.5 shrink-0" />
                          {t(`badges.${badge.id}.hint`)}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              </section>
            )}
          </>
        )}
      </div>
    </div>
  )
}
