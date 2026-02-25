'use client'

import React, { useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { Bell, X, UserPlus, Heart, MessageSquare, Zap } from 'lucide-react'
import { supabase } from '@/lib/supabase'

type Notification = {
  id: string
  type: string
  is_read: boolean
  created_at: string
  actor: {
    id: string
    username: string
  } | null
  card_id: string | null
  card_title: string | null
}

function renderNotificationText(n: Notification): React.ReactNode {
  const actor = <span className="font-medium">{n.actor?.username ?? 'Кто-то'}</span>
  const cardTitle = n.card_title
    ? <> вашей карточке &laquo;<span className="font-bold text-slate-100">{n.card_title}</span>&raquo;</>
    : <> вашей карточке</>

  switch (n.type) {
    case 'follow':
      return <>{actor} подписался на вас</>
    case 'like':
      return <>{actor} поставил лайк{cardTitle}</>
    case 'comment':
      return <>{actor} прокомментировал{cardTitle}</>
    case 'comment_like':
      return <>{actor} лайкнул ваш комментарий</>
    default:
      return <>{actor} совершил действие</>
  }
}

function getNotificationIcon(type: string) {
  switch (type) {
    case 'follow':       return <UserPlus className="h-3.5 w-3.5 text-blue-400" />
    case 'like':         return <Heart className="h-3.5 w-3.5 text-rose-400" />
    case 'comment':      return <MessageSquare className="h-3.5 w-3.5 text-emerald-400" />
    case 'comment_like': return <Heart className="h-3.5 w-3.5 text-orange-400" />
    default:             return <Zap className="h-3.5 w-3.5 text-slate-400" />
  }
}

function getNotificationHref(n: Notification): string {
  if (n.type === 'follow') return `/profile/${n.actor?.id ?? ''}`
  if (n.card_id) return `/card/${n.card_id}`
  return `/profile/${n.actor?.id ?? ''}`
}

function timeAgo(iso: string): string {
  const diff = (Date.now() - new Date(iso).getTime()) / 1000
  if (diff < 60)   return 'только что'
  if (diff < 3600) return `${Math.floor(diff / 60)} мин. назад`
  if (diff < 86400) return `${Math.floor(diff / 3600)} ч. назад`
  return `${Math.floor(diff / 86400)} дн. назад`
}

export default function NotificationBell({ userId }: { userId: string }) {
  const [notifications, setNotifications] = useState<Notification[]>([])
  const [open, setOpen] = useState(false)
  const [hasUnread, setHasUnread] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  // Загружаем последние 20 уведомлений
  async function fetchNotifications() {
    const { data, error } = await supabase
      .from('notifications')
      .select('id, type, is_read, created_at, card_id, actor_id')
      .eq('receiver_id', userId)
      .order('created_at', { ascending: false })
      .limit(20)

    if (data) {
      // Подгружаем профили актёров
      const actorIds = [...new Set(data.map((n: any) => n.actor_id).filter(Boolean))] as string[]
      const cardIds  = [...new Set(data.map((n: any) => n.card_id).filter(Boolean))]  as string[]

      const [actorsRes, cardsRes] = await Promise.all([
        actorIds.length > 0
          ? supabase.from('profiles').select('id, username').in('id', actorIds)
          : Promise.resolve({ data: [] as any[] }),
        cardIds.length > 0
          ? supabase.from('cards').select('id, title').in('id', cardIds)
          : Promise.resolve({ data: [] as any[] }),
      ])

      const actorMap = new Map((actorsRes.data ?? []).map((a: any) => [a.id, a]))
      const cardMap  = new Map((cardsRes.data  ?? []).map((c: any) => [c.id, c.title]))

      const mapped = data.map((n: any) => ({
        ...n,
        actor:      actorMap.get(n.actor_id) ?? null,
        card_title: cardMap.get(n.card_id)   ?? null,
      }))
      setNotifications(mapped as Notification[])
      setHasUnread(data.some((n: any) => !n.is_read))
    }
  }

  // Помечаем все как прочитанные
  async function markAllRead() {
    await supabase
      .from('notifications')
      .update({ is_read: true })
      .eq('receiver_id', userId)
      .eq('is_read', false)
    setNotifications((prev) => prev.map((n) => ({ ...n, is_read: true })))
    setHasUnread(false)
  }

  // Удаляем все прочитанные уведомления
  async function clearRead() {
    await supabase
      .from('notifications')
      .delete()
      .eq('receiver_id', userId)
      .eq('is_read', true)
    setNotifications((prev) => prev.filter((n) => !n.is_read))
  }

  // Очищаем все уведомления
  async function clearAll() {
    // Оптимистичное обновление — очищаем мгновенно
    setNotifications([])
    setHasUnread(false)
    await supabase
      .from('notifications')
      .delete()
      .eq('receiver_id', userId)
  }

  // Удаляем одно уведомление по id
  async function deleteOne(id: string) {
    // Оптимистичное обновление — убираем из списка мгновенно
    setNotifications((prev) => {
      const next = prev.filter((n) => n.id !== id)
      setHasUnread(next.some((n) => !n.is_read))
      return next
    })
    await supabase
      .from('notifications')
      .delete()
      .eq('id', id)
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

  // Realtime: слушаем INSERT в notifications для текущего пользователя
  useEffect(() => {
    if (!userId) return

    const channel = supabase
      .channel(`notifications-${userId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'notifications',
          filter: `receiver_id=eq.${userId}`,
        },
        (payload) => {
          console.log('Данные из Realtime:', payload.new)
          // Мгновенно зажигаем красный индикатор
          setHasUnread(true)
          // Если попап открыт — обновляем список
          setOpen((isOpen) => {
            if (isOpen) fetchNotifications()
            return isOpen
          })
        }
      )
      .subscribe((status) => {
        console.log('Realtime статус:', status)
      })

    return () => { supabase.removeChannel(channel) }
  }, [userId])

  // Закрываем при клике вне
  useEffect(() => {
    function onClickOutside(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    document.addEventListener('mousedown', onClickOutside)
    return () => document.removeEventListener('mousedown', onClickOutside)
  }, [])

  function handleOpen() {
    if (!open) {
      fetchNotifications()
      // Помечаем как прочитанные с небольшой задержкой, чтобы точка ещё была видна
      setTimeout(markAllRead, 600)
    }
    setOpen((o) => !o)
  }

  return (
    <div ref={ref} className="relative">
      {/* Кнопка колокольчика */}
      <button
        onClick={handleOpen}
        aria-label="Уведомления"
        className="relative flex h-8 w-8 items-center justify-center rounded-lg text-slate-500 dark:text-slate-400 transition-colors hover:bg-slate-100 dark:hover:bg-white/10 hover:text-slate-900 dark:hover:text-white"
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
        <div className="absolute right-0 top-10 z-50 w-80 rounded-xl border border-slate-200 dark:border-white/10 bg-white dark:bg-slate-900 shadow-2xl">
          <div className="flex items-center justify-between border-b border-slate-100 dark:border-white/5 px-4 py-2.5">
            <span className="text-sm font-semibold text-slate-800 dark:text-slate-200">Уведомления</span>
            {notifications.length > 0 && (
              <button
                onClick={clearAll}
                className="text-xs text-slate-500 transition-colors hover:text-red-400"
              >
                Очистить всё
              </button>
            )}
          </div>

          {notifications.length === 0 ? (
            <p className="px-4 py-6 text-center text-sm text-slate-500">Нет уведомлений</p>
          ) : (
            <>
                <ul className="max-h-96 divide-y divide-slate-100 dark:divide-white/5 overflow-y-auto">
                {notifications.map((n) => (
                  <li key={n.id} className="group relative">
                    {/* Кнопка удаления одного уведомления */}
                    <button
                      onClick={() => deleteOne(n.id)}
                      title="Удалить"
                      className="absolute right-2 top-1/2 -translate-y-1/2 flex h-6 w-6 items-center justify-center rounded text-slate-600 opacity-0 transition-all group-hover:opacity-100 hover:bg-red-500/10 hover:text-red-400 z-10"
                    >
                      <X className="h-3.5 w-3.5" />
                    </button>
                    {n.actor ? (
                      <Link
                        href={getNotificationHref(n)}
                        onClick={() => setOpen(false)}
                        className={`flex items-start gap-3 px-4 py-3 pr-8 text-sm transition-colors hover:bg-slate-50 dark:hover:bg-white/5 ${
                          !n.is_read ? 'bg-blue-500/5' : ''
                        }`}
                      >
                        <span className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-slate-100 dark:bg-white/5">
                          {getNotificationIcon(n.type)}
                        </span>
                        <span className="flex flex-col gap-0.5">
                          <span className={!n.is_read ? 'text-slate-700 dark:text-slate-200' : 'text-slate-500 dark:text-slate-400'}>
                            {renderNotificationText(n)}
                          </span>
                          <span className="text-xs text-slate-400 dark:text-slate-600">{timeAgo(n.created_at)}</span>
                        </span>
                      </Link>
                    ) : (
                      <div className={`flex items-start gap-3 px-4 py-3 pr-8 text-sm ${!n.is_read ? 'bg-blue-500/5' : ''}`}>
                        <span className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-slate-100 dark:bg-white/5">
                          {getNotificationIcon(n.type)}
                        </span>
                        <span className="flex flex-col gap-0.5">
                          <span className="text-slate-500 dark:text-slate-400">{renderNotificationText(n)}</span>
                          <span className="text-xs text-slate-400 dark:text-slate-600">{timeAgo(n.created_at)}</span>
                        </span>
                      </div>
                    )}
                  </li>
                ))}
              </ul>
              {notifications.some((n) => n.is_read) && (
                <div className="border-t border-slate-100 dark:border-white/5 px-4 py-2">
                  <button
                    onClick={clearRead}
                    className="w-full rounded-lg px-3 py-1.5 text-xs text-slate-500 transition-colors hover:bg-slate-100 dark:hover:bg-white/5 hover:text-slate-700 dark:hover:text-slate-300"
                  >
                    Очистить прочитанные
                  </button>
                </div>
              )}
            </>
          )}
        </div>
      )}
    </div>
  )
}
