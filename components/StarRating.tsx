'use client'

import { useEffect, useId, useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { useTranslation } from 'react-i18next'

import { Star, X } from 'lucide-react'

type Props = {
  roadmapId: string
  initialAverageRate?: number
  compact?: boolean
}

// Стабильный clipId передаётся снаружи (uid + индекс звезды)
function StarIcon({ fill, clipId, transitioning }: { fill: number; clipId: string; transitioning?: boolean }) {
  const clipped = Math.min(1, Math.max(0, fill))
  return (
    <svg
      width={22} height={22} viewBox="0 0 24 24"
      style={{ display: 'block', flexShrink: 0, transition: transitioning ? 'opacity 0.2s' : undefined }}
    >
      <defs>
        <clipPath id={clipId}>
          <rect x="0" y="0" width={24 * clipped} height="24" />
        </clipPath>
      </defs>
      {/* Фоновая пустая звезда */}
      <path
        d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"
        fill="none"
        stroke={clipped === 0 ? '#475569' : '#FBBF24'}
        strokeWidth="1.5"
        strokeLinejoin="round"
        style={{ transition: 'stroke 0.2s' }}
      />
      {/* Залитая звезда — обрезается по ширине */}
      <path
        d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"
        fill="#FBBF24"
        stroke="#FBBF24"
        strokeWidth="1.5"
        strokeLinejoin="round"
        clipPath={`url(#${clipId})`}
      />
    </svg>
  )
}

export default function StarRating({ roadmapId, initialAverageRate = 0, compact = false }: Props) {
  const uid = useId() // стабильный уникальный префикс для clipPath id
  const router = useRouter()
  const { t } = useTranslation()

  const [average, setAverage] = useState(initialAverageRate)
  const [totalCount, setTotalCount] = useState(0)
  const [userRating, setUserRating] = useState<number | null>(null)
  const [hovered, setHovered] = useState<number | null>(null)
  const [currentUserId, setCurrentUserId] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [unrating, setUnrating] = useState(false)
  const [isMounted, setIsMounted] = useState(false)

  useEffect(() => setIsMounted(true), [])

  // Загружаем пользователя + рейтинги за один проход
  useEffect(() => {
    let cancelled = false

    async function load() {
      const [userRes, ratingsRes] = await Promise.all([
        supabase.auth.getUser(),
        supabase.from('ratings').select('rate, user_id').eq('roadmap_id', roadmapId),
      ])
      const user = userRes.data?.user;
      const ratings = ratingsRes.data;
      const error = ratingsRes.error;

      if (cancelled) return

      if (error) {
        console.error('StarRating: ошибка загрузки рейтингов:', error)
        return
      }

      setCurrentUserId(user?.id ?? null)
      if (ratings && Array.isArray(ratings)) {
        setTotalCount(ratings.length)
        setAverage(
          ratings.length > 0
            ? ratings.reduce((sum, r) => sum + (r.rate ?? 0), 0) / ratings.length
            : 0
        )
        const userRate = ratings.find((r) => r.user_id === user?.id)?.rate ?? null
        setUserRating(userRate)
      }
    }

    load()
    return () => { cancelled = true }
  }, [roadmapId])

  // Realtime: подписка на изменения рейтингов для этой карточки
  useEffect(() => {
    const channel = supabase
      .channel(`ratings:${roadmapId}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'ratings', filter: `roadmap_id=eq.${roadmapId}` },
        () => {
          // Перезагружаем актуальные данные с сервера
          supabase
            .from('ratings')
            .select('rate, user_id')
            .eq('roadmap_id', roadmapId)
            .then(({ data: rows }) => {
              if (!rows) return
              setTotalCount(rows.length)
              setAverage(
                rows.length > 0
                  ? rows.reduce((s, r) => s + (r.rate ?? 0), 0) / rows.length
                  : 0
              )
              // Обновляем оценку текущего пользователя
              setCurrentUserId((uid) => {
                if (uid) {
                  const myRate = rows.find((r) => r.user_id === uid)?.rate ?? null
                  setUserRating(myRate)
                }
                return uid
              })
            })
        }
      )
      .subscribe()
    return () => { supabase.removeChannel(channel) }
  }, [roadmapId])

  async function handleRate(value: number) {
    if (!currentUserId || submitting) return

    // Повторный клик на ту же звезду — отмена оценки
    if (value === userRating) {
      handleUnrate()
      return
    }

    // Оптимистичное обновление
    const prevRating = userRating
    const prevAverage = average
    const prevCount = totalCount
    setUserRating(value)
    setSubmitting(true)

    const { error: upsertError } = await supabase
      .from('ratings')
      .upsert({ roadmap_id: roadmapId, user_id: currentUserId, rate: Math.round(value) })

    if (upsertError) {
      // Откатываем
      setUserRating(prevRating)
      setAverage(prevAverage)
      setTotalCount(prevCount)
      setSubmitting(false)
      return
    }

    // Пересчитываем среднее с сервера
    const { data: ratings, error: fetchError } = await supabase
      .from('ratings')
      .select('rate')
      .eq('roadmap_id', roadmapId)

    if (fetchError) {
      // Ошибка пересчёта среднего — Realtime подхватит позже
    } else if (ratings && ratings.length > 0) {
      const values = ratings.map((r: any) => r.rate as number)
      const avg = values.reduce((a: number, b: number) => a + b, 0) / values.length
      setAverage(avg)
      setTotalCount(values.length)
    }

    router.refresh()
    setSubmitting(false)
  }

  async function handleUnrate() {
    if (!currentUserId || submitting) return

    const prevRating = userRating
    const prevAverage = average
    const prevCount = totalCount

    // Оптимистично сбрасываем
    setUserRating(null)
    setTotalCount((prev) => Math.max(0, prev - 1))
    if (totalCount <= 1) {
      setAverage(0)
    } else {
      // Пересчитываем среднее без нашей оценки
      const newAvg = (average * totalCount - (prevRating ?? 0)) / (totalCount - 1)
      setAverage(newAvg)
    }
    setUnrating(true)
    setSubmitting(true)

    const { error } = await supabase
      .from('ratings')
      .delete()
      .match({ roadmap_id: roadmapId, user_id: currentUserId })

    if (error) {
      setUserRating(prevRating)
      setAverage(prevAverage)
      setTotalCount(prevCount)
      setSubmitting(false)
      setUnrating(false)
      return
    }

    // Пересчитываем среднее после удаления
    const { data: ratings, error: fetchError } = await supabase
      .from('ratings')
      .select('rate')
      .eq('roadmap_id', roadmapId)

    if (fetchError) {
      // Ошибка пересчёта — Realtime подхватит позже
    } else if (!ratings || ratings.length === 0) {
      setAverage(0)
      setTotalCount(0)
    } else {
      const values = ratings.map((r: any) => r.rate as number)
      const avg = values.reduce((a: number, b: number) => a + b, 0) / values.length
      setAverage(avg)
      setTotalCount(values.length)
    }

    router.refresh()
    setSubmitting(false)
    setUnrating(false)
  }

  // До монтирования — ничего не рендерим, чтобы избежать Hydration mismatch
  if (!isMounted) return null

  // Что рисуем в звёздах: hover → оценка пользователя → среднее
  const displayValue = hovered ?? (userRating !== null ? userRating : average)
  // Во время удаления оценки кнопки всё ещё недоступны, но остальные элементы показываются
  const isInteractive = !!currentUserId && !submitting

  function declCount(n: number) {
    return t('rating.count', { count: n })
  }

  // ── Компактный режим: одна строка «⭐ 4.4 · 12 оценок» ──
  if (compact) {
    return (
      <div className="flex items-center gap-1.5 text-xs text-slate-500 dark:text-slate-400">
        <Star className="h-3.5 w-3.5 fill-amber-400 stroke-amber-400" />
        {totalCount > 0 ? (
          <>
            <span className="font-semibold text-amber-400">{average.toFixed(1)}</span>
            <span className="text-slate-400">·</span>
            <span>{totalCount} {declCount(totalCount)}</span>
            {userRating !== null && (
              <span className="text-slate-500">({t('rating.yourRating', { value: userRating })})</span>
            )}
          </>
        ) : (
          <span>{isMounted ? (currentUserId ? t('rating.beFirst') : t('rating.loginToRate')) : ''}</span>
        )}
      </div>
    )
  }

  return (
    <div className="flex flex-col items-start gap-1.5">

      {/* Строка: звёзды + кнопка × */}
      <div className="flex items-center gap-1">
        <div
          className="flex items-center gap-0.5"
          onMouseLeave={() => setHovered(null)}
          role="group"
          aria-label={t('rating.label', { value: average.toFixed(1) })}
        >
          {[1, 2, 3, 4, 5].map((star) => {
            const fill = hovered !== null
              ? (star <= hovered ? 1 : 0)
              : Math.min(1, Math.max(0, displayValue - (star - 1)))

            return (
              <button
                key={star}
                type="button"
                disabled={!isInteractive}
                onClick={() => handleRate(star)}
                onMouseEnter={() => currentUserId && setHovered(star)}
                className={`rounded p-0.5 transition-all ${
                  isInteractive
                    ? 'cursor-pointer hover:scale-110 active:scale-95'
                    : 'cursor-default opacity-75'
                }`}
                aria-label={`${t('rating.label', { value: star })}`}
              >
                <StarIcon fill={fill} clipId={`${uid}-star-${star}`} transitioning={submitting} />
              </button>
            )
          })}
        </div>

        {/* Кнопка × — в той же строке что и звёзды */}
        {userRating !== null && isInteractive && (
          <button
            type="button"
            onClick={handleUnrate}
            title={t('rating.unrate')}
            className="rounded p-0.5 text-slate-400 transition-colors hover:text-red-500 active:scale-95"
            aria-label={t('rating.unrate')}
          >
            <X className="h-3.5 w-3.5" />
          </button>
        )}
      </div>

      {/* Статистика: среднее + количество (всегда видимо, спиннер во время сохранения) */}
      <p className="flex items-center gap-1.5 text-xs text-slate-500">
        {totalCount > 0 ? (
          <>
            <span className="font-semibold text-amber-400">{average.toFixed(1)}</span>
            {' · '}
            {totalCount} {declCount(totalCount)}
            {userRating !== null && (
              <span className="ml-1 text-slate-400">({t('rating.yourRating', { value: userRating })})</span>
            )}
          </>
        ) : (
          <span>{isMounted ? (currentUserId ? t('rating.beFirst') : t('rating.loginToRate')) : ''}</span>
        )}
        {submitting && (
          <span className={`inline-block h-2.5 w-2.5 rounded-full border-2 border-current border-t-transparent animate-spin ${
            unrating ? 'text-red-400' : 'text-amber-400'
          }`} />
        )}
      </p>
    </div>
  )
}
