'use client'

import React, { useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { Bell, X, UserPlus, Heart, MessageSquare, Zap } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import UserAvatar from '@/components/UserAvatar'
import { useTranslation } from 'react-i18next'

// ─── Типы ────────────────────────────────────────────────────────────
type RawNotification = {
  id: string
  type: string
  is_read: boolean
  created_at: string
  actor_id: string | null
  card_id: string | null
  actor?: { id: string; username: string; avatar?: string | null } | null
  card_title?: string | null
}

type GroupedNotification = {
  key: string
  type: string
  actors: Array<{ id: string; username: string; avatar?: string | null }>
  ids: string[]
  card_id: string | null
  card_title: string | null
  latest_at: string
  is_read: boolean
}

// ─── Агрегация ───────────────────────────────────────────────────────
function groupNotifications(data: RawNotification[]): GroupedNotification[] {
  const map = new Map<string, GroupedNotification>()
  const sorted = [...data].sort(
    (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
  )
  for (const n of sorted) {
    const groupKey = n.type === 'follow' ? 'follow' : `${n.type}::${n.card_id ?? 'no-card'}`
    if (map.has(groupKey)) {
      const g = map.get(groupKey)!
      g.ids.push(n.id)
      if (n.actor && !g.actors.some((a) => a.id === n.actor!.id)) g.actors.push(n.actor)
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
  return Array.from(map.values()).sort(
    (a, b) => new Date(b.latest_at).getTime() - new Date(a.latest_at).getTime()
  )
}

// ─── Helpers ─────────────────────────────────────────────────────────
function buildText(g: GroupedNotification, t: (k: string, o?: any) => string): string {
  const first  = g.actors[0]?.username ?? t('notifications.someone')
  const rest   = g.actors.length - 1
  const others = rest > 0 ? ` ${t('notifications.andMore', { count: rest, defaultValue: `и ещё ${rest}` })}` : ''
  const card   = g.card_title ? `«${g.card_title}»` : t('notifications.yourCard', { defaultValue: 'вашу карточку' })

  switch (g.type) {
    case 'like':         return `${first}${others} ${t('notifications.liked', { defaultValue: 'лайкнули' })} ${card}`
    case 'comment':      return `${first}${others} ${t('notifications.commented', { defaultValue: 'прокомментировали' })} ${card}`
    case 'comment_like': return `${first}${others} ${t('notifications.likedComment', { defaultValue: 'лайкнули ваш комментарий в' })} ${card}`
    case 'follow':       return `${first}${others} ${t('notifications.startedFollowing', { defaultValue: 'подписались на вас' })}`
    default:             return `${first} ${t('notifications.didAction', { defaultValue: 'совершил действие' })}`
  }
}

function getGroupHref(g: GroupedNotification): string {
  if (g.type === 'follow' && g.actors[0]) return `/profile/${g.actors[0].id}`
  if (g.card_id) return `/card/${g.card_id}${g.type === 'comment' ? '#comments' : ''}`
  return '#'
}

function getGroupIcon(type: string) {
  switch (type) {
    case 'follow':       return <UserPlus    className="h-3.5 w-3.5 text-blue-400" />
    case 'like':         return <Heart       className="h-3.5 w-3.5 text-rose-400" />
    case 'comment':      return <MessageSquare className="h-3.5 w-3.5 text-emerald-400" />
    case 'comment_like': return <Heart       className="h-3.5 w-3.5 text-orange-400" />
    default:             return <Zap         className="h-3.5 w-3.5 text-slate-400" />
  }
}

function timeAgo(iso: string, t: (key: string, opts?: any) => string): string {
  const diff = (Date.now() - new Date(iso).getTime()) / 1000
  if (diff < 60)    return t('notifications.justNow')
  if (diff < 3600)  return t('notifications.minutesAgo', { count: Math.floor(diff / 60) })
  if (diff < 86400) return t('notifications.hoursAgo',   { count: Math.floor(diff / 3600) })
  return t('notifications.daysAgo', { count: Math.floor(diff / 86400) })
}

// ─── AvatarGroup ─────────────────────────────────────────────────────
function AvatarGroup({ actors }: { actors: Array<{ id: string; username: string; avatar?: string | null }> }) {
  const SHOW = 3
  const visible  = actors.slice(0, SHOW)
  const overflow = actors.length - SHOW
  return (
    <div className="flex shrink-0 items-center">
      {visible.map((a, i) => (
        <span
          key={a.id}
          className="rounded-full ring-2 ring-white dark:ring-slate-900"
          style={{ marginLeft: i === 0 ? 0 : -6, zIndex: SHOW - i }}
        >
          <UserAvatar username={a.username} avatarUrl={a.avatar} size={24} />
        </span>
      ))}
      {overflow > 0 && (
        <span
          className="inline-flex items-center justify-center rounded-full bg-slate-200 dark:bg-slate-700 text-[10px] font-semibold text-slate-600 dark:text-slate-300 ring-2 ring-white dark:ring-slate-900"
          style={{ width: 24, height: 24, marginLeft: -6, zIndex: 0 }}
        >
          +{overflow}
        </span>
      )}
    </div>
  )
}

// ─── Компонент ───────────────────────────────────────────────────────
export default function NotificationBell({ userId }: { userId: string }) {
  const { t } = useTranslation()
  const [mounted, setMounted]   = useState(false)
  const [groups, setGroups]     = useState<GroupedNotification[]>([])
  const [open, setOpen]         = useState(false)
  const [hasUnread, setHasUnread] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => setMounted(true), [])

  async function fetchNotifications() {
    const { data } = await supabase
      .from('notifications')
      .select('id, type, is_read, created_at, card_id, actor_id')
      .eq('receiver_id', userId)
      .order('created_at', { ascending: false })
      .limit(50)

    if (!data) return

    const actorIds = [...new Set(data.map((n: any) => n.actor_id).filter(Boolean))] as string[]
    const cardIds  = [...new Set(data.map((n: any) => n.card_id).filter(Boolean))]  as string[]

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

    const enriched: RawNotification[] = data.map((n: any) => ({
      ...n,
      actor:      actorMap.get(n.actor_id) ?? null,
      card_title: cardMap.get(n.card_id)   ?? null,
    }))

    setGroups(groupNotifications(enriched))
    setHasUnread(data.some((n: any) => !n.is_read))
  }

  async function markAllRead() {
    await supabase
      .from('notifications')
      .update({ is_read: true })
      .eq('receiver_id', userId)
      .eq('is_read', false)
    setGroups((prev) => prev.map((g) => ({ ...g, is_read: true })))
    setHasUnread(false)
  }

  async function clearAll() {
    setGroups([])
    setHasUnread(false)
    await supabase.from('notifications').delete().eq('receiver_id', userId)
  }

  async function deleteGroup(ids: string[]) {
    setGroups((prev) => {
      const next = prev.filter((g) => g.ids.join() !== ids.join())
      setHasUnread(next.some((g) => !g.is_read))
      return next
    })
    await supabase.from('notifications').delete().in('id', ids)
  }

  // Проверка непрочитанных при монтировании
  useEffect(() => {
    if (!userId) return
    supabase
      .from('notifications')
      .select('id', { count: 'exact', head: true })
      .eq('receiver_id', userId)
      .eq('is_read', false)
      .then(({ count }) => setHasUnread((count ?? 0) > 0))
  }, [userId])

  // Realtime
  useEffect(() => {
    if (!userId) return
    const channel = supabase
      .channel(`notifications-${userId}`)
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'notifications', filter: `receiver_id=eq.${userId}` },
        () => {
          setHasUnread(true)
          setOpen((isOpen) => {
            if (isOpen) fetchNotifications()
            return isOpen
          })
        }
      )
      .subscribe()
    return () => { supabase.removeChannel(channel) }
  }, [userId])

  // Закрываем при клике вне
  useEffect(() => {
    function onClickOutside(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', onClickOutside)
    return () => document.removeEventListener('mousedown', onClickOutside)
  }, [])

  function handleOpen() {
    if (!open) {
      fetchNotifications()
      setTimeout(markAllRead, 600)
    }
    setOpen((o) => !o)
  }

  if (!mounted) return null

  return (
    <div ref={ref} className="relative">
      {/* Кнопка колокольчика */}
      <button
        onClick={handleOpen}
        aria-label={t('notifications.title')}
        className="relative flex h-8 w-8 items-center justify-center rounded-lg text-slate-500 dark:text-slate-400 transition-colors hover:bg-slate-100 dark:hover:bg-slate-800/50 hover:text-slate-900 dark:hover:text-white"
      >
        <Bell className="h-4 w-4" />
        {hasUnread && (
          <span className="absolute right-1 top-1 flex h-2 w-2">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-red-400 opacity-75" />
            <span className="relative inline-flex h-2 w-2 rounded-full bg-red-500 ring-2 ring-black" />
          </span>
        )}
      </button>

      {/* Дропдаун */}
      {open && (
        <div className="absolute right-0 top-10 z-50 w-80 rounded-xl border border-slate-200/60 dark:border-white/10 bg-white dark:bg-slate-900 shadow-lg dark:shadow-none">
          {/* Шапка */}
          <div className="flex items-center justify-between border-b border-slate-100 dark:border-white/5 px-4 py-2.5">
            <span className="text-sm font-semibold text-slate-800 dark:text-slate-200">
              {t('notifications.title')}
            </span>
            {groups.length > 0 && (
              <button onClick={clearAll} className="text-xs text-slate-500 transition-colors hover:text-red-400">
                {t('notifications.clearAll')}
              </button>
            )}
          </div>

          {groups.length === 0 ? (
            <p className="px-4 py-6 text-center text-sm text-slate-500">{t('notifications.empty')}</p>
          ) : (
            <>
              <ul className="max-h-96 divide-y divide-slate-100 dark:divide-white/5 overflow-y-auto">
                {groups.map((g) => (
                  <li key={g.key} className="group relative">
                    {/* Кнопка удаления группы */}
                    <button
                      onClick={() => deleteGroup(g.ids)}
                      title={t('notifications.deleteLabel')}
                      className="absolute right-2 top-1/2 -translate-y-1/2 z-10 flex h-6 w-6 items-center justify-center rounded text-slate-600 opacity-0 transition-all group-hover:opacity-100 hover:bg-red-500/10 hover:text-red-400"
                    >
                      <X className="h-3.5 w-3.5" />
                    </button>

                    <Link
                      href={getGroupHref(g)}
                      onClick={() => setOpen(false)}
                      className={`flex items-start gap-2.5 px-4 py-3 pr-8 text-sm transition-colors hover:bg-slate-50 dark:hover:bg-white/5 ${
                        !g.is_read ? 'bg-blue-500/5' : ''
                      }`}
                    >
                      {/* Иконка типа */}
                      <span className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-slate-100 dark:bg-white/5">
                        {getGroupIcon(g.type)}
                      </span>

                      {/* Аватарки */}
                      <AvatarGroup actors={g.actors} />

                      {/* Текст + время */}
                      <span className="min-w-0 flex-1">
                        <span className={`block leading-snug ${!g.is_read ? 'text-slate-800 dark:text-slate-200' : 'text-slate-500 dark:text-slate-400'}`}>
                          {buildText(g, t)}
                        </span>
                        <span className="mt-0.5 block text-xs text-slate-400 dark:text-slate-600">
                          {timeAgo(g.latest_at, t)}
                        </span>
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>

              {/* Ссылка на полную страницу */}
              <div className="border-t border-slate-100 dark:border-white/5 px-4 py-2">
                <Link
                  href="/notifications"
                  onClick={() => setOpen(false)}
                  className="block w-full rounded-lg px-3 py-1.5 text-center text-xs font-medium text-blue-500 transition-colors hover:bg-blue-500/10"
                >
                  {t('notifications.seeAll')}
                </Link>
              </div>
            </>
          )}
        </div>
      )}
    </div>
  )
}
