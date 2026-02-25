'use client'

import { useState } from 'react'
import { ExternalLink, CheckCircle2, Circle } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { useTranslation } from 'react-i18next'

type Step = {
  id: string
  order: number
  title: string
  content?: string
  link?: string
  media_url?: string
}

interface Props {
  cardId: string
  userId: string | null
  steps: Step[]
  initialDone: string[]   // step_id-ы уже выполненных шагов
}

function normalizeUrl(url: string): string {
  if (!url) return url
  return /^https?:\/\//i.test(url) ? url : `https://${url}`
}

function getYouTubeId(url: string): string | null {
  const m = url.match(/(?:youtu\.be\/|[?&]v=|embed\/|v\/)([\w-]{11})/i)
  return m ? m[1] : null
}

function isVideoFile(url: string): boolean {
  return /\.(mp4|webm)(?:\?|$)/i.test(url)
}

function renderMedia(url: string | undefined, title: string) {
  if (!url) return null
  const ytId = getYouTubeId(url)
  if (ytId) {
    return (
      <div className="mt-4 aspect-video w-full overflow-hidden rounded-xl">
        <iframe
          className="h-full w-full"
          src={`https://www.youtube.com/embed/${ytId}`}
          title={title}
          frameBorder="0"
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
          allowFullScreen
        />
      </div>
    )
  }
  if (isVideoFile(url)) return <video controls src={url} className="mt-4 w-full rounded-xl" />
  return (
    <a href={url} target="_blank" rel="noopener noreferrer" className="mt-4 block overflow-hidden rounded-xl">
      <img src={url} alt={title} className="w-full object-cover transition-transform duration-300 hover:scale-105" />
    </a>
  )
}

export default function StepsProgress({ cardId, userId, steps, initialDone }: Props) {
  const { t } = useTranslation()
  const [done, setDone] = useState<Set<string>>(() => new Set(initialDone))
  const [pending, setPending] = useState<Set<string>>(new Set())

  const total = steps.length
  const completedCount = steps.filter((s) => done.has(s.id)).length
  const percent = total === 0 ? 0 : Math.round((completedCount / total) * 100)

  async function toggleStep(stepId: string) {
    if (!userId) return
    if (pending.has(stepId)) return

    // оптимистичное обновление
    const wasDone = done.has(stepId)
    setPending((p) => new Set(p).add(stepId))
    setDone((prev) => {
      const next = new Set(prev)
      wasDone ? next.delete(stepId) : next.add(stepId)
      return next
    })

    if (wasDone) {
      await supabase
        .from('user_progress')
        .delete()
        .eq('user_id', userId)
        .eq('step_id', stepId)
    } else {
      await supabase
        .from('user_progress')
        .insert({ user_id: userId, card_id: cardId, step_id: stepId })
    }

    setPending((p) => {
      const next = new Set(p)
      next.delete(stepId)
      return next
    })
  }

  return (
    <section>
      {/* Прогресс-бар */}
      <div className="mb-8">
        <div className="mb-2 flex items-center justify-between text-sm">
          <span className="font-medium text-slate-700 dark:text-slate-300">
            {userId ? t('steps.yourProgress') : t('steps.roadmapSteps')}
          </span>
          {userId && (
            <span className="tabular-nums text-slate-500 dark:text-slate-400">
              {completedCount} / {total}
              <span className="ml-1.5 font-semibold text-blue-400">{percent}%</span>
            </span>
          )}
        </div>

        {userId && (
          <div className="h-2 w-full overflow-hidden rounded-full bg-slate-200 dark:bg-white/10">
            <div
              className="h-full rounded-full bg-linear-to-r from-blue-500 to-indigo-500 transition-all duration-500"
              style={{ width: `${percent}%` }}
            />
          </div>
        )}
      </div>

      {/* Список шагов */}
      <ol className="relative space-y-6 pl-8">
        {/* Вертикальная линия */}
        <div className="absolute left-3.5 top-3 bottom-3 w-px bg-linear-to-b from-blue-500/60 via-slate-700 to-slate-800" />

        {steps.map((s, idx) => {
          const isDone = done.has(s.id)
          const isLoading = pending.has(s.id)

          return (
            <li key={s.id} className="relative">
              {/* Кружок на линии */}
              <div
                className={`absolute -left-8 flex h-7 w-7 items-center justify-center rounded-full border-2 bg-white dark:bg-zinc-950 text-xs font-bold shadow-md transition-all duration-300 ${
                  isDone
                    ? 'border-emerald-500 text-emerald-400 shadow-[0_0_10px_rgba(52,211,153,0.4)]'
                    : 'border-blue-500 text-blue-400 shadow-[0_0_10px_rgba(59,130,246,0.4)]'
                }`}
              >
                {isDone ? '✓' : (s.order ?? idx + 1)}
              </div>

              {/* Карточка шага */}
              <div
                className={`rounded-xl border p-6 transition-all duration-300 ${
                  isDone
                    ? 'border-emerald-500/30 bg-emerald-50 dark:bg-emerald-950/20'
                    : 'border-slate-200 dark:border-white/10 bg-white dark:bg-white/5 hover:border-blue-500/50 hover:bg-blue-50/50 dark:hover:bg-white/[0.07] hover:shadow-[0_0_20px_rgba(59,130,246,0.08)]'
                }`}
              >
                {/* Заголовок + чекбокс */}
                <button
                  type="button"
                  onClick={() => toggleStep(s.id)}
                  disabled={!userId || isLoading}
                  title={!userId ? t('steps.loginToTrack') : isDone ? t('steps.unmark') : t('steps.markDone')}
                  className="flex w-full items-start gap-3 text-left disabled:cursor-default"
                >
                  <span className={`mt-0.5 shrink-0 transition-colors ${isLoading ? 'opacity-40' : ''}`}>
                    {isDone
                      ? <CheckCircle2 className="h-5 w-5 text-emerald-400" />
                      : <Circle className={`h-5 w-5 ${userId ? 'text-slate-400 dark:text-slate-600 hover:text-slate-600 dark:hover:text-slate-400' : 'text-slate-500 dark:text-slate-700'}`} />
                    }
                  </span>
                  <h3
                    className={`text-base font-semibold transition-all duration-200 ${
                      isDone ? 'text-slate-400 dark:text-slate-500 line-through decoration-emerald-600/60' : 'text-slate-800 dark:text-slate-100'
                    }`}
                  >
                    {s.title}
                  </h3>
                </button>

                {/* Описание */}
                {s.content && (
                  <p className={`mt-2 pl-8 text-sm leading-relaxed transition-colors duration-200 ${
                    isDone ? 'text-slate-400 dark:text-slate-600' : 'text-slate-600 dark:text-slate-400'
                  }`}>
                    {s.content}
                  </p>
                )}

                {/* Ссылка */}
                {s.link && (
                  <div className="mt-3 pl-8">
                    <a
                      href={normalizeUrl(s.link)}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1.5 rounded-md border border-blue-500/30 bg-blue-500/10 px-3 py-1.5 text-xs font-medium text-blue-400 transition-colors hover:border-blue-400/60 hover:bg-blue-500/20 hover:text-blue-300"
                    >
                      <ExternalLink className="h-3.5 w-3.5" />
                      {s.link}
                    </a>
                  </div>
                )}

                {/* Медиа */}
                {s.media_url && (
                  <div className="pl-8">
                    {renderMedia(s.media_url, s.title)}
                  </div>
                )}
              </div>
            </li>
          )
        })}
      </ol>
    </section>
  )
}
