'use client'

import { useState, useEffect, useCallback } from 'react'
import Link from 'next/link'
import { X, UserMinus } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import UserAvatar from '@/components/UserAvatar'

interface FollowUser {
  id: string
  username: string
  avatar: string | null
}

interface Props {
  mode: 'followers' | 'following'
  profileId: string
  /** ID текущего залогиненного пользователя (для кнопки «Отписаться») */
  currentUserId: string | null
  /** Показывать кнопку «Отписаться» (только хозяину профиля) */
  canUnfollow: boolean
  isOpen: boolean
  onClose: () => void
  /** Колбэк при успешной отписке — чтобы обновить счётчик в ProfileHeader */
  onUnfollow?: () => void
}

export default function FollowListModal({
  mode,
  profileId,
  currentUserId,
  canUnfollow,
  isOpen,
  onClose,
  onUnfollow,
}: Props) {
  const [users, setUsers] = useState<FollowUser[]>([])
  const [loading, setLoading] = useState(false)
  const [unfollowing, setUnfollowing] = useState<Set<string>>(new Set())

  const fetchUsers = useCallback(async () => {
    setLoading(true)

    if (mode === 'followers') {
      // Кто подписан на profileId → follower_id
      const { data: rows } = await supabase
        .from('follows')
        .select('follower_id')
        .eq('following_id', profileId)

      const ids = (rows ?? []).map((r: any) => r.follower_id as string)
      if (ids.length === 0) {
        setUsers([])
        setLoading(false)
        return
      }

      const { data: profiles } = await supabase
        .from('profiles')
        .select('id, username, avatar')
        .in('id', ids)

      setUsers((profiles ?? []) as FollowUser[])
    } else {
      // На кого подписан profileId → following_id
      const { data: rows } = await supabase
        .from('follows')
        .select('following_id')
        .eq('follower_id', profileId)

      const ids = (rows ?? []).map((r: any) => r.following_id as string)
      if (ids.length === 0) {
        setUsers([])
        setLoading(false)
        return
      }

      const { data: profiles } = await supabase
        .from('profiles')
        .select('id, username, avatar')
        .in('id', ids)

      setUsers((profiles ?? []) as FollowUser[])
    }

    setLoading(false)
  }, [mode, profileId])

  useEffect(() => {
    if (isOpen) {
      setUsers([])
      fetchUsers()
    }
  }, [isOpen, fetchUsers])

  // Закрытие по Escape
  useEffect(() => {
    if (!isOpen) return
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [isOpen, onClose])

  async function handleUnfollow(targetId: string) {
    if (!currentUserId) return
    setUnfollowing((prev) => new Set(prev).add(targetId))

    await supabase
      .from('follows')
      .delete()
      .eq('follower_id', currentUserId)
      .eq('following_id', targetId)

    // Убираем из локального списка
    setUsers((prev) => prev.filter((u) => u.id !== targetId))
    setUnfollowing((prev) => {
      const next = new Set(prev)
      next.delete(targetId)
      return next
    })

    onUnfollow?.()
  }

  if (!isOpen) return null

  const title = mode === 'followers' ? 'Подписчики' : 'Подписки'

  return (
    /* Backdrop */
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4"
      onClick={onClose}
    >
      {/* Панель */}
      <div
        className="relative w-full max-w-md rounded-2xl border border-slate-200 dark:border-white/10 bg-white dark:bg-zinc-900 shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Шапка */}
          <div className="flex items-center justify-between border-b border-slate-200 dark:border-white/10 px-5 py-4">
          <h2 className="text-base font-semibold text-slate-900 dark:text-white">{title}</h2>
          <button
            onClick={onClose}
            className="rounded-lg p-1 text-slate-500 dark:text-slate-400 transition-colors hover:bg-slate-100 dark:hover:bg-white/10 hover:text-slate-900 dark:hover:text-white"
            aria-label="Закрыть"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Список */}
        <div className="max-h-[60vh] overflow-y-auto px-2 py-2">
          {loading ? (
            <div className="flex flex-col gap-2 px-3 py-4">
              {[...Array(4)].map((_, i) => (
                <div key={i} className="flex items-center gap-3 rounded-xl px-2 py-2 animate-pulse">
                  <div className="h-9 w-9 rounded-full bg-slate-200 dark:bg-slate-800" />
                  <div className="h-4 w-32 rounded bg-slate-200 dark:bg-slate-800" />
                </div>
              ))}
            </div>
          ) : users.length === 0 ? (
            <p className="py-8 text-center text-sm text-slate-500">
              {mode === 'followers' ? 'Пока нет подписчиков' : 'Нет подписок'}
            </p>
          ) : (
            <ul className="flex flex-col gap-0.5">
              {users.map((user) => (
                <li
                  key={user.id}
                  className="flex items-center justify-between gap-3 rounded-xl px-3 py-2 transition-colors hover:bg-slate-100 dark:hover:bg-white/5"
                >
                  <Link
                    href={`/profile/${user.id}`}
                    onClick={onClose}
                    className="flex min-w-0 flex-1 items-center gap-3"
                  >
                    {user.avatar ? (
                      <img
                        src={user.avatar}
                        alt={user.username}
                        className="h-9 w-9 shrink-0 rounded-full object-cover ring-1 ring-slate-200 dark:ring-white/10"
                      />
                    ) : (
                      <UserAvatar username={user.username} size={36} />
                    )}
                    <span className="truncate text-sm font-medium text-slate-700 dark:text-slate-200 hover:text-slate-900 dark:hover:text-white">
                      {user.username}
                    </span>
                  </Link>

                  {/* Кнопка «Отписаться» только в режиме following и если canUnfollow */}
                  {mode === 'following' && canUnfollow && (
                    <button
                      onClick={() => handleUnfollow(user.id)}
                      disabled={unfollowing.has(user.id)}
                      className="shrink-0 flex items-center gap-1.5 rounded-lg border border-slate-300 dark:border-slate-700 bg-slate-100 dark:bg-slate-800 px-2.5 py-1 text-xs font-medium text-slate-600 dark:text-slate-300 transition-all hover:border-red-500/40 hover:bg-red-50 dark:hover:bg-red-950/40 hover:text-red-500 dark:hover:text-red-400 disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      {unfollowing.has(user.id)
                        ? '...'
                        : <><UserMinus className="h-3 w-3" /> <span>Отписаться</span></>}
                    </button>
                  )}
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  )
}
