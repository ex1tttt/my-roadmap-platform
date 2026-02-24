'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { Star } from 'lucide-react'

type Props = {
  roadmapId: string
  initialAverageRate?: number
}

// Рисует одну звезду с частичной заливкой (для среднего значения)
function StarIcon({ fill, size = 22 }: { fill: number; size?: number }) {
  // fill: 0..1 — доля заливки
  const id = `star-clip-${Math.random().toString(36).slice(2)}`
  const clipped = Math.min(1, Math.max(0, fill))

  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      xmlns="http://www.w3.org/2000/svg"
      style={{ display: 'block', flexShrink: 0 }}
    >
      <defs>
        <clipPath id={id}>
          <rect x="0" y="0" width={24 * clipped} height="24" />
        </clipPath>
      </defs>
      {/* Фоновая (пустая) звезда */}
      <path
        d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"
        fill="none"
        stroke="#475569"
        strokeWidth="1.5"
        strokeLinejoin="round"
      />
      {/* Залитая звезда (обрезается по ширине) */}
      <path
        d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"
        fill="#FBBF24"
        stroke="#FBBF24"
        strokeWidth="1.5"
        strokeLinejoin="round"
        clipPath={`url(#${id})`}
      />
    </svg>
  )
}

export default function StarRating({ roadmapId, initialAverageRate = 0 }: Props) {
  const [average, setAverage] = useState(initialAverageRate)
  const [totalCount, setTotalCount] = useState(0)
  const [userRating, setUserRating] = useState<number | null>(null)
  const [hovered, setHovered] = useState<number | null>(null)
  const [currentUserId, setCurrentUserId] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  // Получаем текущего пользователя
  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      setCurrentUserId(data.user?.id ?? null)
    })
  }, [])

  // Загружаем все рейтинги и оценку текущего пользователя
  useEffect(() => {
    async function fetchRatings() {
      const { data } = await supabase
        .from('ratings')
        .select('value, user_id')
        .eq('roadmap_id', roadmapId)

      if (!data || data.length === 0) return

      const values = data.map((r: any) => r.value as number)
      const avg = values.reduce((a, b) => a + b, 0) / values.length
      setAverage(avg)
      setTotalCount(values.length)

      const { data: { user } } = await supabase.auth.getUser()
      if (user) {
        const own = data.find((r: any) => r.user_id === user.id)
        if (own) setUserRating(own.value)
      }
    }

    fetchRatings()
  }, [roadmapId])

  async function handleRate(value: number) {
    if (!currentUserId || loading) return
    setLoading(true)

    await supabase.from('ratings').upsert(
      { roadmap_id: roadmapId, user_id: currentUserId, value },
      { onConflict: 'roadmap_id,user_id' }
    )

    // Обновляем среднее с сервера
    const { data } = await supabase
      .from('ratings')
      .select('value')
      .eq('roadmap_id', roadmapId)

    if (data && data.length > 0) {
      const values = data.map((r: any) => r.value as number)
      const avg = values.reduce((a, b) => a + b, 0) / values.length
      setAverage(avg)
      setTotalCount(values.length)
    }

    setUserRating(value)
    setLoading(false)
  }

  // Что показывать в звёздах: hover → целое число, иначе → средний балл
  const displayValue = hovered ?? (userRating !== null ? userRating : average)

  return (
    <div className="flex flex-col items-start gap-1.5">
      <div
        className="flex items-center gap-0.5"
        onMouseLeave={() => setHovered(null)}
        role="group"
        aria-label={`Рейтинг: ${average.toFixed(1)} из 5`}
      >
        {[1, 2, 3, 4, 5].map((star) => {
          // Доля заливки для текущей звезды
          const fill = hovered !== null
            ? (star <= hovered ? 1 : 0)
            : Math.min(1, Math.max(0, displayValue - (star - 1)))

          const isInteractive = !!currentUserId

          return (
            <button
              key={star}
              type="button"
              disabled={!isInteractive || loading}
              onClick={() => handleRate(star)}
              onMouseEnter={() => isInteractive && setHovered(star)}
              className={`
                rounded transition-transform
                ${isInteractive && !loading ? 'cursor-pointer hover:scale-110 active:scale-95' : 'cursor-default'}
                disabled:opacity-75
              `}
              aria-label={`Поставить ${star} ${star === 1 ? 'звезду' : star < 5 ? 'звезды' : 'звёзд'}`}
            >
              <StarIcon fill={fill} size={22} />
            </button>
          )
        })}
      </div>

      {/* Подпись */}
      <p className="text-xs text-slate-500">
        {totalCount > 0 ? (
          <>
            <span className="font-semibold text-amber-400">{average.toFixed(1)}</span>
            {' · '}
            {totalCount} {totalCount === 1 ? 'оценка' : totalCount < 5 ? 'оценки' : 'оценок'}
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
