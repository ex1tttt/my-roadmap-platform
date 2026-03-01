'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'
import { Heart, Eye, Layers, ArrowLeft, TrendingUp, Bookmark, MessageSquare, Star } from 'lucide-react'
import { motion, useMotionValue, useTransform, animate } from 'framer-motion'
import { useHasMounted } from '@/hooks/useHasMounted'

// ─── Анимированный счётчик ────────────────────────────────────────────────────
function AnimatedNumber({ value }: { value: number }) {
  const count = useMotionValue(0)
  const rounded = useTransform(count, (latest) => Math.round(latest).toLocaleString())

  useEffect(() => {
    const controls = animate(count, value, { duration: 1.2, ease: 'easeOut' })
    return controls.stop
  }, [value])

  return <motion.span>{rounded}</motion.span>
}

// ─── Анимированное десятичное число ──────────────────────────────────────────
function AnimatedDecimal({ value }: { value: number }) {
  const count = useMotionValue(0)
  const formatted = useTransform(count, (latest) => latest.toFixed(1))

  useEffect(() => {
    const controls = animate(count, value, { duration: 1.2, ease: 'easeOut' })
    return controls.stop
  }, [value])

  return <motion.span>{formatted}</motion.span>
}

// ─── Одна статкарточка ────────────────────────────────────────────────────────
function StatCard({
  label,
  value,
  icon,
  accent,
  decimal,
}: {
  label: string
  value: number
  icon: React.ReactNode
  accent: string
  decimal?: boolean
}) {
  return (
    <div
      className={`flex items-center gap-4 rounded-2xl border border-slate-200 dark:border-slate-800 bg-linear-to-br ${accent} to-transparent bg-white dark:bg-slate-900/50 px-6 py-5`}
    >
      <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-slate-100 dark:bg-white/5">
        {icon}
      </div>
      <div>
        <p className="text-2xl font-bold leading-tight text-slate-900 dark:text-slate-100">
          {decimal ? <AnimatedDecimal value={value} /> : <AnimatedNumber value={value} />}
        </p>
        <p className="text-sm text-slate-500 dark:text-slate-400">{label}</p>
      </div>
    </div>
  )
}

// ─── Строка карточки в таблице ────────────────────────────────────────────────
type CardRow = {
  id: string
  title: string
  views_count: number
  likesCount: number
  favoritesCount: number
  commentsCount: number
  avgRating: number
}

export default function StatsPage() {
  const router = useRouter()
  const mounted = useHasMounted()

  const [loading, setLoading] = useState(true)
  const [cards, setCards] = useState<CardRow[]>([])
  const [totalViews, setTotalViews] = useState(0)
  const [totalLikes, setTotalLikes] = useState(0)
  const [totalFavorites, setTotalFavorites] = useState(0)
  const [totalComments, setTotalComments] = useState(0)
  const [totalAvgRating, setTotalAvgRating] = useState(0)

  useEffect(() => {
    const load = async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser()

      if (!user) {
        router.replace('/login')
        return
      }

      // Карточки автора
      const { data: cardsRaw = [] } = await supabase
        .from('cards')
        .select('id, title, views_count')
        .eq('user_id', user.id)
        .order('views_count', { ascending: false })

      const cardIds = (cardsRaw ?? []).map((c: any) => c.id)

      const likesCountMap = new Map<string, number>()
      const favsCountMap = new Map<string, number>()
      const commentsCountMap = new Map<string, number>()
      const ratingsMap = new Map<string, number[]>()

      if (cardIds.length > 0) {
        const [likesRes, favsRes, commentsRes, ratingsRes] = await Promise.all([
          supabase.from('likes').select('card_id').in('card_id', cardIds),
          supabase.from('favorites').select('roadmap_id').in('roadmap_id', cardIds),
          supabase.from('comments').select('roadmap_id').in('roadmap_id', cardIds),
          supabase.from('ratings').select('roadmap_id, rate').in('roadmap_id', cardIds),
        ])

        ;(likesRes.data ?? []).forEach((l: any) =>
          likesCountMap.set(l.card_id, (likesCountMap.get(l.card_id) ?? 0) + 1)
        )
        ;(favsRes.data ?? []).forEach((f: any) =>
          favsCountMap.set(f.roadmap_id, (favsCountMap.get(f.roadmap_id) ?? 0) + 1)
        )
        ;(commentsRes.data ?? []).forEach((cm: any) =>
          commentsCountMap.set(cm.roadmap_id, (commentsCountMap.get(cm.roadmap_id) ?? 0) + 1)
        )
        ;(ratingsRes.data ?? []).forEach((r: any) => {
          const arr = ratingsMap.get(r.roadmap_id) ?? []
          arr.push(r.rate)
          ratingsMap.set(r.roadmap_id, arr)
        })
      }

      const rows: CardRow[] = (cardsRaw ?? []).map((c: any) => {
        const ratingArr = ratingsMap.get(c.id) ?? []
        const avg = ratingArr.length > 0
          ? ratingArr.reduce((a: number, b: number) => a + b, 0) / ratingArr.length
          : 0
        return {
          id: c.id,
          title: c.title,
          views_count: c.views_count ?? 0,
          likesCount: likesCountMap.get(c.id) ?? 0,
          favoritesCount: favsCountMap.get(c.id) ?? 0,
          commentsCount: commentsCountMap.get(c.id) ?? 0,
          avgRating: avg,
        }
      })

      const tViews = rows.reduce((s, c) => s + c.views_count, 0)
      const tLikes = rows.reduce((s, c) => s + c.likesCount, 0)
      const tFavs = rows.reduce((s, c) => s + c.favoritesCount, 0)
      const tComments = rows.reduce((s, c) => s + c.commentsCount, 0)
      const allRatings = [...ratingsMap.values()].flat()
      const tAvgRating = allRatings.length > 0
        ? allRatings.reduce((a, b) => a + b, 0) / allRatings.length
        : 0

      setCards(rows)
      setTotalViews(tViews)
      setTotalLikes(tLikes)
      setTotalFavorites(tFavs)
      setTotalComments(tComments)
      setTotalAvgRating(tAvgRating)
      setLoading(false)
    }

    load()
  }, [router])

  if (!mounted) return <div className="opacity-0" />

  if (loading) {
    return (
      <div className="min-h-screen bg-white dark:bg-[#020617] flex items-center justify-center">
        <p className="text-gray-500 dark:text-gray-400">Загрузка...</p>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-white dark:bg-[#020617] py-12 px-6">
      <main className="mx-auto max-w-4xl">

        {/* Назад */}
        <Link
          href="/profile"
          className="mb-8 inline-flex items-center gap-2 text-sm text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white transition-colors"
        >
          <ArrowLeft className="h-4 w-4" />
          Назад к профилю
        </Link>

        {/* Заголовок */}
        <div className="mb-8 flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-violet-100 dark:bg-violet-500/10">
            <TrendingUp className="h-5 w-5 text-violet-600 dark:text-violet-400" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100">Статистика</h1>
            <p className="text-sm text-slate-500 dark:text-slate-400">Показатели ваших карточек</p>
          </div>
        </div>

        {/* Сводные карточки */}
        <div className="mb-10 grid grid-cols-2 sm:grid-cols-3 gap-4">
          <StatCard
            label="Карточки"
            value={cards.length}
            icon={<Layers className="h-6 w-6 text-blue-400" />}
            accent="from-blue-500/10"
          />
          <StatCard
            label="Просмотры"
            value={totalViews}
            icon={<Eye className="h-6 w-6 text-violet-400" />}
            accent="from-violet-500/10"
          />
          <StatCard
            label="Лайки"
            value={totalLikes}
            icon={<Heart className="h-6 w-6 text-rose-400" />}
            accent="from-rose-500/10"
          />
          <StatCard
            label="Избранное"
            value={totalFavorites}
            icon={<Bookmark className="h-6 w-6 text-amber-400" />}
            accent="from-amber-500/10"
          />
          <StatCard
            label="Комментарии"
            value={totalComments}
            icon={<MessageSquare className="h-6 w-6 text-emerald-400" />}
            accent="from-emerald-500/10"
          />
          <StatCard
            label="Средняя оценка"
            value={totalAvgRating}
            icon={<Star className="h-6 w-6 text-yellow-400" />}
            accent="from-yellow-500/10"
            decimal
          />
        </div>

        {/* Таблица по карточкам */}
        {cards.length > 0 ? (
          <div className="overflow-x-auto overflow-hidden rounded-2xl border border-slate-200 dark:border-slate-800">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-white/5">
                  <th className="px-5 py-3 text-left font-medium text-slate-500 dark:text-slate-400">Карточка</th>
                  <th className="px-5 py-3 text-right font-medium text-slate-500 dark:text-slate-400">
                    <span className="inline-flex items-center justify-end gap-1">
                      <Eye className="h-3.5 w-3.5" /> Просмотры
                    </span>
                  </th>
                  <th className="px-5 py-3 text-right font-medium text-slate-500 dark:text-slate-400">
                    <span className="inline-flex items-center justify-end gap-1">
                      <Heart className="h-3.5 w-3.5" /> Лайки
                    </span>
                  </th>
                  <th className="px-5 py-3 text-right font-medium text-slate-500 dark:text-slate-400">
                    <span className="inline-flex items-center justify-end gap-1">
                      <Bookmark className="h-3.5 w-3.5" /> Избранное
                    </span>
                  </th>
                  <th className="px-5 py-3 text-right font-medium text-slate-500 dark:text-slate-400">
                    <span className="inline-flex items-center justify-end gap-1">
                      <MessageSquare className="h-3.5 w-3.5" /> Комментарии
                    </span>
                  </th>
                  <th className="px-5 py-3 text-right font-medium text-slate-500 dark:text-slate-400">
                    <span className="inline-flex items-center justify-end gap-1">
                      <Star className="h-3.5 w-3.5" /> Оценка
                    </span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {cards.map((card, idx) => (
                  <tr
                    key={card.id}
                    className={`border-b border-slate-100 dark:border-slate-800/60 hover:bg-slate-50 dark:hover:bg-white/5 transition-colors ${
                      idx === cards.length - 1 ? 'border-b-0' : ''
                    }`}
                  >
                    <td className="px-5 py-3">
                      <Link
                        href={`/card/${card.id}`}
                        className="font-medium text-slate-800 dark:text-slate-200 hover:text-blue-600 dark:hover:text-blue-400 transition-colors line-clamp-1"
                      >
                        {card.title}
                      </Link>
                    </td>
                    <td className="px-5 py-3 text-right tabular-nums text-slate-700 dark:text-slate-300">
                      {card.views_count.toLocaleString()}
                    </td>
                    <td className="px-5 py-3 text-right tabular-nums text-slate-700 dark:text-slate-300">
                      {card.likesCount.toLocaleString()}
                    </td>
                    <td className="px-5 py-3 text-right tabular-nums text-slate-700 dark:text-slate-300">
                      {card.favoritesCount.toLocaleString()}
                    </td>
                    <td className="px-5 py-3 text-right tabular-nums text-slate-700 dark:text-slate-300">
                      {card.commentsCount.toLocaleString()}
                    </td>
                    <td className="px-5 py-3 text-right tabular-nums text-slate-700 dark:text-slate-300">
                      {card.avgRating > 0 ? card.avgRating.toFixed(1) : '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="text-center text-slate-500 dark:text-slate-400 py-16">
            У вас пока нет карточек.
          </p>
        )}
      </main>
    </div>
  )
}
