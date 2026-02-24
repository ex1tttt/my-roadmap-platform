'use client'

import { useEffect, useId, useState } from 'react'
import { supabase } from '@/lib/supabase'

type Props = {
  roadmapId: string
  initialAverageRate?: number
}

// Стабильный clipId передаётся снаружи (uid + индекс звезды)
function StarIcon({ fill, clipId }: { fill: number; clipId: string }) {
  const clipped = Math.min(1, Math.max(0, fill))
  return (
    <svg width={22} height={22} viewBox="0 0 24 24" style={{ display: 'block', flexShrink: 0 }}>
      <defs>
        <clipPath id={clipId}>
          <rect x="0" y="0" width={24 * clipped} height="24" />
        </clipPath>
      </defs>
      {/* Фоновая пустая звезда */}
      <path
        d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"
        fill="none"
        stroke="#475569"
        strokeWidth="1.5"
        strokeLinejoin="round"
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

export default function StarRating({ roadmapId, initialAverageRate = 0 }: Props) {
  const uid = useId() // стабильный уникальный префикс для clipPath id

  const [average, setAverage] = useState(initialAverageRate)
  const [totalCount, setTotalCount] = useState(0)
  const [userRating, setUserRating] = useState<number | null>(null)
  const [hovered, setHovered] = useState<number | null>(null)
  const [currentUserId, setCurrentUserId] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  // Загружаем пользователя + рейтинги за один проход
  useEffect(() => {
    let cancelled = false

    async function load() {
      const [{ data: { user } }, { data: ratings, error }] = await Promise.all([
        supabase.auth.getUser(),
        supabase.from('ratings').select('rate, user_id').eq('roadmap_id', roadmapId),
      ])

      if (cancelled) return

      if (error) {
        console.error('StarRating: ошибка загрузки рейтингов:', error)
        return
      }

      const userId = user?.id ?? null
      setCurrentUserId(userId)

      if (!ratings || ratings.length === 0) return

      const values = ratings.map((r: any) => r.rate as number)
      const avg = values.reduce((a: number, b: number) => a + b, 0) / values.length
      setAverage(avg)
      setTotalCount(values.length)

      if (userId) {
        const own = ratings.find((r: any) => r.user_id === userId)
        if (own) setUserRating(own.rate)
      }
    }

    load()
    return () => { cancelled = true }
  }, [roadmapId])

  async function handleRate(value: number) {
    if (!currentUserId || submitting) return

    // Оптимистичное обновление
    const prevRating = userRating
    const prevAverage = average
    const prevCount = totalCount
    setUserRating(value)
    setSubmitting(true)

    const { error: upsertError } = await supabase
      .from('ratings')
      .upsert(
        { user_id: currentUserId, roadmap_id: roadmapId, rate: value },
        { onConflict: 'roadmap_id,user_id' }
      )

    if (upsertError) {
      console.error('StarRating: ошибка сохранения оценки:', upsertError)
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
      console.error('StarRating: ошибка обновления среднего:', fetchError)
    } else if (ratings && ratings.length > 0) {
      const values = ratings.map((r: any) => r.rate as number)
      const avg = values.reduce((a: number, b: number) => a + b, 0) / values.length
      setAverage(avg)
      setTotalCount(values.length)
    }

    setSubmitting(false)
  }

  // Что рисуем в звёздах: hover → оценка пользователя → среднее
  const displayValue = hovered ?? (userRating !== null ? userRating : average)
  const isInteractive = !!currentUserId && !submitting

  function declCount(n: number) {
    if (n % 10 === 1 && n % 100 !== 11) return 'оценка'
    if ([2, 3, 4].includes(n % 10) && ![12, 13, 14].includes(n % 100)) return 'оценки'
    return 'оценок'
  }

  return (
    <div className="flex flex-col items-start gap-1.5">
      <div
        className="flex items-center gap-0.5"
        onMouseLeave={() => setHovered(null)}
        role="group"
        aria-label={`Рейтинг: ${average.toFixed(1)} из 5`}
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
              className={`rounded p-0.5 transition-transform ${
                isInteractive
                  ? 'cursor-pointer hover:scale-110 active:scale-95'
                  : 'cursor-default opacity-75'
              }`}
              aria-label={`Поставить ${star} ${star === 1 ? 'звезду' : star < 5 ? 'звезды' : 'звёзд'}`}
            >
              <StarIcon fill={fill} clipId={`${uid}-star-${star}`} />
            </button>
          )
        })}
      </div>

      {/* Подпись */}
      <p className="text-xs text-slate-500">
        {submitting ? (
          <span className="animate-pulse">Сохранение...</span>
        ) : totalCount > 0 ? (
          <>
            <span className="font-semibold text-amber-400">{average.toFixed(1)}</span>
            {' · '}
            {totalCount} {declCount(totalCount)}
            {userRating !== null && (
              <span className="ml-1.5 text-slate-600">(вы: {userRating})</span>
            )}
          </>
        ) : currentUserId ? (
          'Будьте первым, кто оценит'
        ) : (
          'Войдите, чтобы оценить'
        )}
      </p>
    </div>
  )
}
