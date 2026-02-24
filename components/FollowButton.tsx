'use client'

import { useState } from 'react'
import { supabase } from '@/lib/supabase'

interface Props {
  profileId: string
  currentUserId: string | null
  isOwner: boolean
  initialIsFollowing: boolean
  initialFollowersCount: number
  followingCount: number
}

function plural(n: number, one: string, few: string, many: string) {
  const mod10 = n % 10
  const mod100 = n % 100
  if (mod10 === 1 && mod100 !== 11) return one
  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 10 || mod100 >= 20)) return few
  return many
}

export default function FollowButton({
  profileId,
  currentUserId,
  isOwner,
  initialIsFollowing,
  initialFollowersCount,
  followingCount,
}: Props) {
  const [isFollowing, setIsFollowing] = useState(initialIsFollowing)
  const [followersCount, setFollowersCount] = useState(initialFollowersCount)
  const [loading, setLoading] = useState(false)
  const [hovered, setHovered] = useState(false)

  async function handleFollow() {
    if (!currentUserId || loading) return
    setLoading(true)

    // Оптимистичное обновление
    if (isFollowing) {
      setIsFollowing(false)
      setFollowersCount((n) => Math.max(0, n - 1))
    } else {
      setIsFollowing(true)
      setFollowersCount((n) => n + 1)
    }

    if (isFollowing) {
      await supabase
        .from('follows')
        .delete()
        .eq('follower_id', currentUserId)
        .eq('following_id', profileId)
    } else {
      await supabase
        .from('follows')
        .insert({ follower_id: currentUserId, following_id: profileId })
    }

    setLoading(false)
  }

  // Блок статистики: подписчики + подписки + кнопка
  const stats = (
    <span className="flex items-center gap-5">
      {/* Подписчики */}
      <button
        type="button"
        className="group flex items-baseline gap-1 text-sm transition-colors hover:text-white"
        title="Подписчики"
      >
        <span className="font-bold text-white group-hover:text-blue-400 transition-colors">{followersCount}</span>
        <span className="text-slate-400">{plural(followersCount, 'подписчик', 'подписчика', 'подписчиков')}</span>
      </button>

      {/* Подписки */}
      <button
        type="button"
        className="group flex items-baseline gap-1 text-sm transition-colors hover:text-white"
        title="Подписки"
      >
        <span className="font-bold text-white group-hover:text-blue-400 transition-colors">{followingCount}</span>
        <span className="text-slate-400">подписок</span>
      </button>

      {/* Кнопка подписки (только если не хозяин и залогинен) */}
      {!isOwner && currentUserId && (
        <button
          onClick={handleFollow}
          disabled={loading}
          onMouseEnter={() => setHovered(true)}
          onMouseLeave={() => setHovered(false)}
          className={`rounded-lg px-3 py-1 text-xs font-medium transition-all disabled:cursor-not-allowed disabled:opacity-50 ${
            isFollowing
              ? hovered
                ? 'border border-red-500/40 bg-red-950/40 text-red-400'
                : 'border border-slate-700 bg-slate-800 text-slate-300'
              : 'border border-blue-500/40 bg-blue-600 text-white hover:bg-blue-500'
          }`}
        >
          {isFollowing ? (hovered ? 'Отписаться' : 'Вы подписаны') : 'Подписаться'}
        </button>
      )}
    </span>
  )

  return stats
}
