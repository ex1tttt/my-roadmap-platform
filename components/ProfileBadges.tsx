'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'

// ─── Реестр всех значков (экспортируется для настроек) ───────────────────────
export const ALL_BADGES = [
  {
    id: 'pioneer',
    emoji: '🚀',
    label: 'Первопроходец',
    description: 'Создана первая карточка-роадмап!',
    hint: 'Создайте свою первую карточку-роадмап',
    ringEarned: 'ring-amber-400/60',
    bgEarned: 'bg-amber-400/10',
    glow: 'shadow-amber-400/30',
  },
  {
    id: 'sensei',
    emoji: '🎓',
    label: 'Сенсей',
    description: 'Ваши карты лайкнули 100 раз!',
    hint: 'Наберите 100 лайков на всех ваших карточках',
    ringEarned: 'ring-violet-400/60',
    bgEarned: 'bg-violet-400/10',
    glow: 'shadow-violet-400/30',
  },
  {
    id: 'critic',
    emoji: '💬',
    label: 'Критик',
    description: '50 комментариев написано!',
    hint: 'Напишите 50 комментариев на карточках',
    ringEarned: 'ring-emerald-400/60',
    bgEarned: 'bg-emerald-400/10',
    glow: 'shadow-emerald-400/30',
  },
] as const

export type BadgeDef = (typeof ALL_BADGES)[number]

// ─── Один значок ─────────────────────────────────────────────────────────────
function BadgeItem({
  badge,
  earned,
  featured,
}: {
  badge: BadgeDef
  earned: boolean
  featured: boolean
}) {
  return (
    <div className="group relative flex flex-col items-center gap-1">
      {/* Корона над значком если он выбран как витринный */}
      {featured && earned && (
        <span className="absolute -top-3 left-1/2 -translate-x-1/2 text-sm leading-none select-none z-10" title="Витринный значок">
          👑
        </span>
      )}

      {/* Круглая иконка */}
      <div
        className={`
          flex h-12 w-12 items-center justify-center rounded-full ring-2 transition-transform duration-200
          group-hover:scale-110
          ${
            earned
              ? `${badge.bgEarned} ${badge.ringEarned} shadow-lg ${badge.glow}`
              : 'bg-slate-100 dark:bg-white/5 ring-slate-200 dark:ring-white/10'
          }
        `}
      >
        <span className={`text-2xl leading-none select-none ${earned ? '' : 'grayscale opacity-25'}`}>
          {badge.emoji}
        </span>
      </div>

      {/* Подпись */}
      <span
        className={`text-[10px] font-medium leading-tight text-center max-w-13 truncate ${
          earned
            ? featured
              ? 'text-amber-500 dark:text-amber-400'
              : 'text-slate-700 dark:text-slate-300'
            : 'text-slate-400 dark:text-slate-600'
        }`}
      >
        {badge.label}
      </span>

      {/* Tooltip */}
      <div className="pointer-events-none absolute bottom-full left-1/2 z-50 mb-2 w-max max-w-45 -translate-x-1/2 rounded-lg border border-slate-200 dark:border-white/10 bg-white dark:bg-slate-900 px-3 py-2 shadow-xl opacity-0 scale-95 transition-all duration-150 group-hover:opacity-100 group-hover:scale-100">
        <p className="text-xs font-semibold text-slate-800 dark:text-slate-100">
          {badge.label}{featured && earned ? ' 👑' : ''}
        </p>
        <p className="mt-0.5 text-[11px] leading-snug text-slate-500 dark:text-slate-400">
          {earned
            ? featured ? badge.description + ' (витрина профиля)' : badge.description
            : `🔒 ${badge.hint}`}
        </p>
        <span className="absolute left-1/2 top-full -translate-x-1/2 border-4 border-transparent border-t-white dark:border-t-slate-900" />
      </div>
    </div>
  )
}

// ─── Главный компонент ────────────────────────────────────────────────────────
export default function ProfileBadges({ profileId }: { profileId: string }) {
  const [earnedIds, setEarnedIds] = useState<Set<string>>(new Set())
  const [featuredId, setFeaturedId] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!profileId) return
    Promise.all([
      supabase.from('user_badges').select('badge_id').eq('user_id', profileId),
      supabase.from('profiles').select('featured_badge').eq('id', profileId).maybeSingle(),
    ]).then(([badgesRes, profileRes]) => {
      setEarnedIds(new Set((badgesRes.data ?? []).map((r: { badge_id: string }) => r.badge_id)))
      // featured_badge может отсутствовать если миграция ещё не выполнена — не падаем
      if (!profileRes.error) {
        setFeaturedId(profileRes.data?.featured_badge ?? null)
      }
      setLoading(false)
    })
  }, [profileId])

  if (loading) {
    return (
      <div className="mt-4 flex items-center gap-4">
        {ALL_BADGES.map((b) => (
          <div key={b.id} className="flex flex-col items-center gap-1">
            <div className="h-12 w-12 animate-pulse rounded-full bg-slate-200 dark:bg-white/10" />
            <div className="h-2.5 w-10 animate-pulse rounded bg-slate-200 dark:bg-white/10" />
          </div>
        ))}
      </div>
    )
  }

  return (
    <div className="mt-4 flex flex-wrap items-end gap-4">
      {ALL_BADGES.map((badge) => (
        <BadgeItem
          key={badge.id}
          badge={badge}
          earned={earnedIds.has(badge.id)}
          featured={featuredId === badge.id}
        />
      ))}
    </div>
  )
}
