'use client'

import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import { useTranslation } from 'react-i18next'

interface Props {
  profileId: string
  currentUserId: string | null
  isOwner: boolean
  initialIsFollowing: boolean
  initialFollowersCount: number
  followingCount: number
}

export default function FollowButton({
  profileId,
  currentUserId,
  isOwner,
  initialIsFollowing,
  initialFollowersCount,
  followingCount,
}: Props) {
  const { t } = useTranslation()
  const [mounted, setMounted] = useState(false)
  const [isFollowing, setIsFollowing] = useState(initialIsFollowing)
  const [followersCount, setFollowersCount] = useState(initialFollowersCount)
  const [loading, setLoading] = useState(false)
  const [hovered, setHovered] = useState(false)

  useEffect(() => setMounted(true), [])

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

  if (!mounted) return null

  // Блок статистики: подписчики + подписки + кнопка
  const stats = (
    <span className="flex items-center gap-5">
      {/* Подписчики */}
      <button
        type="button"
        className="group flex items-baseline gap-1 text-sm transition-colors hover:text-white"
        title={t('follow.followers')}
      >
        <span className="font-bold text-white group-hover:text-blue-400 transition-colors">{followersCount}</span>
        <span className="text-slate-400">{t('follow.follower', { count: followersCount })}</span>
      </button>

      {/* Подписки */}
      <button
        type="button"
        className="group flex items-baseline gap-1 text-sm transition-colors hover:text-white"
        title={t('follow.following')}
      >
        <span className="font-bold text-white group-hover:text-blue-400 transition-colors">{followingCount}</span>
        <span className="text-slate-400">{t('follow.subscriptionsLabel')}</span>
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
          {isFollowing ? (hovered ? t('follow.unsubscribe') : t('follow.subscribed')) : t('follow.subscribe')}
        </button>
      )}
    </span>
  )

  return stats
}
