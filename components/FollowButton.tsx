'use client'

import { useState, useEffect } from 'react'
import { Bell, BellOff } from 'lucide-react'
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
  const [notifyNewCards, setNotifyNewCards] = useState(false)
  const [bellLoading, setBellLoading] = useState(false)

  useEffect(() => setMounted(true), [])

  // Загружаем текущее значение notify_enabled при монтировании
  useEffect(() => {
    if (!currentUserId || !initialIsFollowing) return
    supabase
      .from('follows')
      .select('notify_enabled')
      .eq('follower_id', currentUserId)
      .eq('following_id', profileId)
      .maybeSingle()
      .then(({ data }) => {
        if (data) setNotifyNewCards(data.notify_enabled ?? false)
      })
  }, [currentUserId, profileId, initialIsFollowing])

  async function handleFollow() {
    if (!currentUserId || loading) return
    setLoading(true)

    // Оптимистичное обновление
    if (isFollowing) {
      setIsFollowing(false)
      setNotifyNewCards(false)
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

  async function handleBell() {
    if (!currentUserId || bellLoading || !isFollowing) return
    setBellLoading(true)
    const next = !notifyNewCards
    setNotifyNewCards(next)
    await supabase
      .from('follows')
      .update({ notify_enabled: next })
      .eq('follower_id', currentUserId)
      .eq('following_id', profileId)
    setBellLoading(false)
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
        <span className="flex items-center gap-1.5">
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
        {/* Колокольчик — только когда подписан */}
        {isFollowing && (
          <button
            onClick={handleBell}
            disabled={bellLoading}
            title={notifyNewCards ? 'Отключить уведомления о новых карточках' : 'Уведомлять о новых карточках'}
            className={`rounded-lg p-1 text-xs transition-all disabled:opacity-50 ${
              notifyNewCards
                ? 'border border-yellow-500/40 bg-yellow-950/40 text-yellow-400 hover:bg-yellow-900/40'
                : 'border border-slate-700 bg-slate-800 text-slate-400 hover:text-slate-200'
            }`}
          >
            {notifyNewCards ? <Bell size={14} /> : <BellOff size={14} />}
          </button>
        )}
        </span>
      )}
    </span>
  )

  return stats
}
