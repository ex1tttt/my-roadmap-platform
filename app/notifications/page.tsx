'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { Bell, Heart, MessageSquare, UserPlus, Zap, Trash2, CheckCheck } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import UserAvatar from '@/components/UserAvatar'

// ─── Типы ───────────────────────────────────────────────────────────
type RawNotification = {
  id: string
  type: string
  is_read: boolean
  created_at: string
  actor_id: string | null
  card_id: string | null
  card_title?: string | null
  actor?: {
    id: string
    username: string
    avatar?: string | null
  } | null
}

type GroupedNotification = {
  /** Ключ группы — уникальный строковый идентификатор для React */
  key: string
  type: string
  /** Все actor-объекты (для аватарок). Последний — самый свежий. */
  actors: Array<{ id: string; username: string; avatar?: string | null }>
  /** Все id сырых уведомлений в этой группе — нужны для удаления */
  ids: string[]
  card_id: string | null
  card_title: string | null
  /** Самое свежее created_at в группе */
  latest_at: string
  is_read: boolean
}

// ─── Агрегация ───────────────────────────────────────────────────────
/**
 * Группирует сырые уведомления:
 *  - like     → по card_id
 *  - follow   → все вместе
 *  - comment  → по card_id (отдельно от like)
 *  - остальные→ по типу + card_id
 */
function groupNotifications(data: RawNotification[]): GroupedNotification[] {
  const map = new Map<string, GroupedNotification>()

  // Сортируем по убыванию времени, чтобы первый вставленный → самый свежий
  const sorted = [...data].sort(
    (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
  )

  for (const n of sorted) {
    // Ключ группировки
    const groupKey =
      n.type === 'follow'
        ? 'follow'
        : `${n.type}::${n.card_id ?? 'no-card'}`

    if (map.has(groupKey)) {
      const g = map.get(groupKey)!
      g.ids.push(n.id)
      if (n.actor && !g.actors.some((a) => a.id === n.actor!.id)) {
        g.actors.push(n.actor)
      }
      // latest_at уже установлен на самое свежее (первый элемент в sorted)
      if (!n.is_read) g.is_read = false
    } else {
      map.set(groupKey, {
        key: groupKey,
        type: n.type,
        actors: n.actor ? [n.actor] : [],
        ids: [n.id],
        card_id: n.card_id,
        card_title: n.card_title ?? null,
        latest_at: n.created_at,
        is_read: n.is_read,
      })
    }
  }

  // Возвращаем сгруппированные, отсортированные по свежести
  return Array.from(map.values()).sort(
    (a, b) => new Date(b.latest_at).getTime() - new Date(a.latest_at).getTime()
  )
}

// ─── Helpers ─────────────────────────────────────────────────────────
function timeAgo(iso: string): string {
  const diff = (Date.now() - new Date(iso).getTime()) / 1000
  if (diff < 60)    return 'только что'
  if (diff < 3600)  return `${Math.floor(diff / 60)} мин назад`
  if (diff < 86400) return `${Math.floor(diff / 3600)} ч назад`
  if (diff < 86400 * 30) return `${Math.floor(diff / 86400)} дн назад`
  return new Date(iso).toLocaleDateString('ru-RU', { day: 'numeric', month: 'short' })
}

function buildText(g: GroupedNotification): string {
  const first = g.actors[0]?.username ?? 'Кто-то'
  const rest  = g.actors.length - 1
  const others = rest > 0 ? ` и ещё ${rest} ${plural(rest, 'человек', 'человека', 'человек')}` : ''
  const card  = g.card_title ? `«${g.card_title}»` : 'вашу карточку'

  switch (g.type) {
    case 'like':
      return `${first}${others} лайкнул${rest > 0 ? 'и' : ''} ${card}`
    case 'comment':
      return `${first}${others} оставил${rest > 0 ? 'и' : ''} комментарий к ${card}`
    case 'comment_like':
      return `${first}${others} лайкнул${rest > 0 ? 'и' : ''} ваш комментарий в ${card}`
    case 'follow':
      return `${first}${others} подписал${rest > 0 ? 'ись' : 'ся/ась'} на вас`
    default:
      return `${first} отправил уведомление`
  }
}

function plural(n: number, one: string, few: string, many: string): string {
  const mod10  = n % 10
  const mod100 = n % 100
  if (mod100 >= 11 && mod100 <= 14) return many
  if (mod10 === 1)  return one
  if (mod10 >= 2 && mod10 <= 4) return few
  return many
}

function getHref(g: GroupedNotification): string {
  if (g.type === 'follow' && g.actors[0]) return `/profile/${g.actors[0].id}`
  if (g.card_id) return `/card/${g.card_id}${g.type === 'comment' ? '#comments' : ''}`
  return '#'
}

function GroupIcon({ type }: { type: string }) {
  const cls = 'h-4 w-4'
  switch (type) {
    case 'like':         return <Heart        className={`${cls} text-rose-400`} />
    case 'comment':      return <MessageSquare className={`${cls} text-emerald-400`} />
    case 'comment_like': return <Heart        className={`${cls} text-orange-400`} />
    case 'follow':       return <UserPlus     className={`${cls} text-blue-400`} />
    default:             return <Zap          className={`${cls} text-slate-400`} />
  }
}

// ─── AvatarGroup ─────────────────────────────────────────────────────
function AvatarGroup({
  actors,
}: {
  actors: Array<{ id: string; username: string; avatar?: string | null }>
}) {
  const SHOW = 4
  const visible = actors.slice(0, SHOW)
  const overflow = actors.length - SHOW

  return (
    <div className="flex items-center">
      {visible.map((a, i) => (
        <span
          key={a.id}
          className="ring-2 ring-white dark:ring-slate-900 rounded-full"
          style={{ marginLeft: i === 0 ? 0 : -8, zIndex: SHOW - i }}
        >
          <UserAvatar username={a.username} avatarUrl={a.avatar} size={32} />
        </span>
      ))}
      {overflow > 0 && (
        <span
          className="ring-2 ring-white dark:ring-slate-900 rounded-full inline-flex items-center justify-center bg-slate-200 dark:bg-slate-700 text-xs font-semibold text-slate-600 dark:text-slate-300"
          style={{ width: 32, height: 32, marginLeft: -8, zIndex: 0 }}
        >
          +{overflow}
        </span>
      )}
    </div>
  )
}

// ─── Страница ─────────────────────────────────────────────────────────
export default function NotificationsPage() {
  const router = useRouter()
  const [groups, setGroups]       = useState<GroupedNotification[]>([])
  const [loading, setLoading]     = useState(true)
  const [userId, setUserId]       = useState<string | null>(null)
  const [mounted, setMounted]     = useState(false)

  useEffect(() => setMounted(true), [])

  // Загрузка и агрегация
  async function load() {
    setLoading(true)
    const { data: { session } } = await supabase.auth.getSession()
    const uid = session?.user?.id ?? null
    setUserId(uid)
    if (!uid) {
      router.replace('/login')
      return
    }

    const { data: rows, error } = await supabase
      .from('notifications')
      .select('id, type, is_read, created_at, actor_id, card_id')
      .eq('receiver_id', uid)
      .order('created_at', { ascending: false })
      .limit(100)

    if (error || !rows) {
      setLoading(false)
      return
    }

    // Параллельно загружаем профили и карточки
    const actorIds = [...new Set(rows.map((n: any) => n.actor_id).filter(Boolean))] as string[]
    const cardIds  = [...new Set(rows.map((n: any) => n.card_id).filter(Boolean))]  as string[]

    const [actorsRes, cardsRes] = await Promise.all([
      actorIds.length > 0
        ? supabase.from('profiles').select('id, username, avatar').in('id', actorIds)
        : Promise.resolve({ data: [] as any[] }),
      cardIds.length > 0
        ? supabase.from('cards').select('id, title').in('id', cardIds)
        : Promise.resolve({ data: [] as any[] }),
    ])

    const actorMap = new Map((actorsRes.data ?? []).map((a: any) => [a.id, a]))
    const cardMap  = new Map((cardsRes.data  ?? []).map((c: any) => [c.id, c.title]))

    const enriched: RawNotification[] = rows.map((n: any) => ({
      ...n,
      actor:      actorMap.get(n.actor_id) ?? null,
      card_title: cardMap.get(n.card_id)   ?? null,
    }))

    setGroups(groupNotifications(enriched))

    // Помечаем всё как прочитанное
    if (rows.some((n: any) => !n.is_read)) {
      await supabase
        .from('notifications')
        .update({ is_read: true })
        .eq('receiver_id', uid)
        .eq('is_read', false)
    }

    setLoading(false)
  }

  useEffect(() => {
    load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  async function deleteGroup(ids: string[]) {
    setGroups((prev) => prev.filter((g) => !ids.every((id) => g.ids.includes(id))))
    await supabase.from('notifications').delete().in('id', ids)
  }

  async function deleteAll() {
    if (!userId) return
    setGroups([])
    await supabase.from('notifications').delete().eq('receiver_id', userId)
  }

  if (!mounted) return null

  return (
    <div className="min-h-screen bg-white dark:bg-[#020617] py-12 px-4">
      <main className="mx-auto max-w-2xl">
        {/* Заголовок */}
        <div className="mb-8 flex items-center justify-between gap-4">
          <h1 className="flex items-center gap-2 text-2xl font-bold text-slate-900 dark:text-white">
            <Bell className="h-6 w-6 text-blue-400" />
            Уведомления
          </h1>
          {groups.length > 0 && (
            <button
              onClick={deleteAll}
              className="flex items-center gap-1.5 rounded-lg border border-slate-200 dark:border-white/10 px-3 py-1.5 text-xs text-slate-500 dark:text-slate-400 transition-colors hover:border-red-400/40 hover:bg-red-500/10 hover:text-red-400"
            >
              <Trash2 className="h-3.5 w-3.5" />
              Очистить все
            </button>
          )}
        </div>

        {/* Состояние загрузки */}
        {loading ? (
          <div className="space-y-3">
            {[...Array(5)].map((_, i) => (
              <div
                key={i}
                className="h-20 animate-pulse rounded-xl border border-slate-100 dark:border-white/5 bg-slate-50 dark:bg-white/5"
              />
            ))}
          </div>
        ) : groups.length === 0 ? (
          /* Пусто */
          <div className="flex flex-col items-center justify-center gap-4 rounded-2xl border border-dashed border-slate-200 dark:border-white/10 py-24 text-center">
            <span className="flex h-14 w-14 items-center justify-center rounded-full bg-slate-100 dark:bg-white/5">
              <Bell className="h-7 w-7 text-slate-400" />
            </span>
            <div>
              <p className="font-semibold text-slate-700 dark:text-slate-300">Нет уведомлений</p>
              <p className="mt-1 text-sm text-slate-500 dark:text-slate-500">Здесь будут появляться лайки, комментарии и подписки</p>
            </div>
          </div>
        ) : (
          /* Список групп */
          <ul className="space-y-2">
            {groups.map((g) => {
              const href     = getHref(g)
              const text     = buildText(g)
              const timeText = timeAgo(g.latest_at)
              const unread   = !g.is_read

              return (
                <li
                  key={g.key}
                  className={`group relative flex items-center gap-4 rounded-xl border px-4 py-3.5 transition-colors ${
                    unread
                      ? 'border-blue-200 dark:border-blue-500/20 bg-blue-50 dark:bg-blue-500/5'
                      : 'border-slate-100 dark:border-white/5 bg-white dark:bg-white/2 hover:bg-slate-50 dark:hover:bg-white/5'
                  }`}
                >
                  {/* Синяя точка непрочитанного */}
                  {unread && (
                    <span className="absolute left-2 top-1/2 -translate-y-1/2 h-1.5 w-1.5 rounded-full bg-blue-500" />
                  )}

                  {/* Иконка типа */}
                  <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-slate-100 dark:bg-white/5">
                    <GroupIcon type={g.type} />
                  </span>

                  {/* Аватарки */}
                  <AvatarGroup actors={g.actors} />

                  {/* Текст */}
                  <div className="min-w-0 flex-1">
                    <Link
                      href={href}
                      className="after:absolute after:inset-0 after:rounded-xl"
                    >
                      <p className={`text-sm leading-snug ${unread ? 'font-semibold text-slate-800 dark:text-slate-100' : 'text-slate-600 dark:text-slate-400'}`}>
                        {text}
                      </p>
                      <p className="mt-0.5 text-xs text-slate-400 dark:text-slate-600">
                        {timeText}
                        {g.actors.length > 1 && (
                          <span className="ml-1.5 inline-flex items-center gap-0.5 rounded-full bg-slate-100 dark:bg-white/10 px-1.5 py-0.5 text-[10px] font-medium text-slate-500 dark:text-slate-400">
                            <CheckCheck className="h-2.5 w-2.5" />
                            {g.actors.length}
                          </span>
                        )}
                      </p>
                    </Link>
                  </div>

                  {/* Кнопка удаления группы */}
                  <button
                    onClick={() => deleteGroup(g.ids)}
                    title="Удалить"
                    className="relative z-10 ml-auto flex h-7 w-7 shrink-0 items-center justify-center rounded-lg text-slate-400 opacity-0 transition-all group-hover:opacity-100 hover:bg-red-500/10 hover:text-red-400"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </li>
              )
            })}
          </ul>
        )}
      </main>
    </div>
  )
}
