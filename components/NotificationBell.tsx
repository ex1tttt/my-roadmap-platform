'use client'

import { useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { Bell } from 'lucide-react'
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

function formatNotification(n: Notification): string {
  const actor = n.actor?.username ?? 'Кто-то'
  switch (n.type) {
    case 'follow':        return `${actor} подписался на вас`
    case 'like':          return `${actor} лайкнул вашу карту «${n.card_title ?? ''}»`
    case 'comment':       return `${actor} прокомментировал вашу карту «${n.card_title ?? ''}»`
    case 'comment_like':  return `${actor} лайкнул ваш комментарий`
    default:              return `${actor} совершил действие`
  }
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
    const { data } = await supabase
      .from('notifications')
      .select('id, type, is_read, created_at, card_id, card_title, actor:actor_id(id, username)')
      .eq('receiver_id', userId)
      .order('created_at', { ascending: false })
      .limit(20)

    if (data) {
      console.log('Список уведомлений в UI:', data)
      setNotifications(data as unknown as Notification[])
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
        () => {
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
        className="relative flex h-8 w-8 items-center justify-center rounded-lg text-slate-400 transition-colors hover:bg-white/10 hover:text-white"
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
        <div className="absolute right-0 top-10 z-50 w-80 rounded-xl border border-white/10 bg-slate-900 shadow-2xl">
          <div className="flex items-center justify-between border-b border-white/5 px-4 py-2.5">
            <span className="text-sm font-semibold text-slate-200">Уведомления</span>
          </div>

          {notifications.length === 0 ? (
            <p className="px-4 py-6 text-center text-sm text-slate-500">Нет уведомлений</p>
          ) : (
            <>
              <ul className="max-h-96 divide-y divide-white/5 overflow-y-auto">
                {notifications.map((n) => (
                  <li key={n.id}>
                    {n.actor ? (
                      <Link
                        href={n.card_id ? `/card/${n.card_id}` : `/profile/${n.actor.id}`}
                        onClick={() => setOpen(false)}
                        className={`flex flex-col gap-0.5 px-4 py-3 text-sm transition-colors hover:bg-white/5 ${
                          !n.is_read ? 'bg-blue-500/5' : ''
                        }`}
                      >
                        <span className={!n.is_read ? 'text-slate-200' : 'text-slate-400'}>
                          {formatNotification(n)}
                        </span>
                        <span className="text-xs text-slate-600">{timeAgo(n.created_at)}</span>
                      </Link>
                    ) : (
                      <div className={`flex flex-col gap-0.5 px-4 py-3 text-sm ${!n.is_read ? 'bg-blue-500/5' : ''}`}>
                        <span className="text-slate-400">{formatNotification(n)}</span>
                        <span className="text-xs text-slate-600">{timeAgo(n.created_at)}</span>
                      </div>
                    )}
                  </li>
                ))}
              </ul>
              {notifications.some((n) => n.is_read) && (
                <div className="border-t border-white/5 px-4 py-2">
                  <button
                    onClick={clearRead}
                    className="w-full rounded-lg px-3 py-1.5 text-xs text-slate-500 transition-colors hover:bg-white/5 hover:text-slate-300"
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
