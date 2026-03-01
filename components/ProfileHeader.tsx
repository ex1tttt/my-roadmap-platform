'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { Settings, Bell } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import UserAvatar from '@/components/UserAvatar'
import FollowListModal from '@/components/FollowListModal'
import Toast from '@/components/Toast'
import ProfileBadges from '@/components/ProfileBadges'
import { useTranslation } from 'react-i18next'

interface Props {
  profile: {
    id: string
    username: string
    avatar?: string | null
    bio?: string | null
  }
  cardsCount: number
  initialFollowersCount: number
  followingCount: number
  initialIsFollowing: boolean
  initialNotifyEnabled?: boolean
  isOwner: boolean
  currentUserId: string | null
}

export default function ProfileHeader({
  profile,
  cardsCount,
  initialFollowersCount,
  followingCount,
  initialIsFollowing,
  initialNotifyEnabled = false,
  isOwner,
  currentUserId,
}: Props) {
  const { t } = useTranslation()
  const [mounted, setMounted] = useState(false)
  const [isFollowing, setIsFollowing] = useState(initialIsFollowing)
  const [followersCount, setFollowersCount] = useState(initialFollowersCount)
  const [followingCountState, setFollowingCountState] = useState(followingCount)
  const [loading, setLoading] = useState(false)
  const [hovered, setHovered] = useState(false)
  const [notifyEnabled, setNotifyEnabled] = useState(initialNotifyEnabled)
  const [notifyLoading, setNotifyLoading] = useState(false)
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null)
  const [modalMode, setModalMode] = useState<'followers' | 'following' | null>(null)
  const router = useRouter()

  useEffect(() => setMounted(true), [])

  // Загружаем notify_enabled из таблицы follows (синхронизация при смене подписки)
  useEffect(() => {
    if (!currentUserId || !isFollowing) return
    supabase
      .from('follows')
      .select('notify_enabled')
      .eq('follower_id', currentUserId)
      .eq('following_id', profile.id)
      .maybeSingle()
      .then(({ data }) => {
        if (data) setNotifyEnabled(data.notify_enabled ?? false)
      })
  }, [currentUserId, profile.id, isFollowing])

  async function handleNotify() {
    if (!currentUserId || notifyLoading) return
    setNotifyLoading(true)
    const newVal = !notifyEnabled
    setNotifyEnabled(newVal)
    const { error } = await supabase
      .from('follows')
      .update({ notify_enabled: newVal })
      .match({ follower_id: currentUserId, following_id: profile.id })
    if (error) {
      setNotifyEnabled(!newVal)
      setToast({ message: 'Ошибка при изменении настроек', type: 'error' })
    } else {
      setToast({
        message: newVal ? 'Уведомления включены' : 'Уведомления выключены',
        type: 'success',
      })
    }
    setNotifyLoading(false)
  }

  async function handleFollow() {
    if (loading) return

    // Если не залогинен — отправляем на страницу входа
    if (!currentUserId) {
      router.push('/login')
      return
    }

    setLoading(true)

    // Оптимистичное обновление до запроса
    const wasFollowing = isFollowing
    if (wasFollowing) {
      setIsFollowing(false)
      setFollowersCount((n) => Math.max(0, n - 1))
    } else {
      setIsFollowing(true)
      setFollowersCount((n) => n + 1)
    }

    let error: unknown = null

    if (wasFollowing) {
      const res = await supabase
        .from('follows')
        .delete()
        .eq('follower_id', currentUserId)
        .eq('following_id', profile.id)
      error = res.error
    } else {
      const res = await supabase
        .from('follows')
        .insert({ follower_id: currentUserId, following_id: profile.id })
      error = res.error

      // Создаём уведомление владельцу профиля
      if (!error) {
        await supabase.from('notifications').insert({
          receiver_id: profile.id,
          actor_id: currentUserId,
          type: 'follow',
        })
      }
    }

    // При ошибке откатываем оптимистичное обновление
    if (error) {
      setIsFollowing(wasFollowing)
      setFollowersCount((n) => wasFollowing ? n + 1 : Math.max(0, n - 1))
    }

    setLoading(false)
  }

  if (!mounted) return null

  return (
    <>
    <div className="mb-8 flex flex-col gap-6 rounded-2xl border border-slate-200 dark:border-white/10 bg-white dark:bg-slate-900/50 p-6 sm:flex-row sm:items-start">
      {/* Аватар */}
      <div className="shrink-0">
        {profile.avatar ? (
          <img
            src={profile.avatar}
            alt={profile.username}
            className="h-20 w-20 rounded-full object-cover ring-2 ring-slate-200 dark:ring-white/10"
          />
        ) : (
          <UserAvatar username={profile.username} size={80} />
        )}
      </div>

      {/* Информация */}
      <div className="flex flex-1 flex-col gap-2">
        {/* Имя + кнопка действия */}
        <div className="flex items-center justify-between gap-4">
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white">{profile.username}</h1>

          {isOwner ? (
            <Link
              href="/settings"
              className="inline-flex items-center gap-2 rounded-lg border border-slate-200 dark:border-white/10 bg-slate-50 dark:bg-white/5 px-3 py-1.5 text-sm text-slate-600 dark:text-slate-400 transition-colors hover:border-slate-300 dark:hover:border-white/20 hover:text-slate-800 dark:hover:text-slate-200"
            >
              <Settings className="h-4 w-4" />
              {t('profile.settings')}
            </Link>
          ) : currentUserId ? (
            <div className="flex items-center gap-2">
              {/* Колокольчик — только если подписан */}
              {isFollowing && (
                <button
                  onClick={handleNotify}
                  disabled={notifyLoading}
                  title={notifyEnabled ? 'Выключить уведомления' : 'Включить уведомления'}
                  className="flex items-center justify-center rounded-lg border border-slate-200 dark:border-white/10 bg-slate-50 dark:bg-white/5 p-1.5 transition-colors hover:border-slate-300 dark:hover:border-white/20 disabled:opacity-50"
                >
                  <Bell
                    className={`h-4 w-4 transition-colors ${
                      notifyEnabled ? 'fill-yellow-400 text-yellow-400' : 'text-slate-400'
                    }`}
                  />
                </button>
              )}
              <button
                onClick={handleFollow}
                disabled={loading}
                onMouseEnter={() => setHovered(true)}
                onMouseLeave={() => setHovered(false)}
                className={`rounded-lg px-4 py-1.5 text-sm font-medium transition-all disabled:cursor-not-allowed disabled:opacity-50 ${
                  isFollowing
                    ? hovered
                      ? 'border border-red-500/40 bg-red-950/40 text-red-400'
                      : 'border border-slate-700 bg-slate-800 text-slate-300'
                    : 'border border-blue-500/40 bg-blue-600 text-white hover:bg-blue-500'
                }`}
              >
                {isFollowing ? (hovered ? t('follow.unsubscribe') : t('follow.subscribed')) : t('follow.subscribe')}
              </button>
            </div>
          ) : null}
        </div>

        {/* Био */}
        {profile.bio ? (
          <p className="text-sm text-slate-600 dark:text-slate-400">{profile.bio}</p>
        ) : (
          <p className="text-sm italic text-slate-400 dark:text-slate-600">{t('profile.noDescription')}</p>
        )}

        {/* Статистика */}
        <div className="mt-2 flex flex-wrap items-center gap-5 text-sm">
          <span className="text-slate-500 dark:text-slate-400">
            <span className="font-bold text-slate-900 dark:text-white">{cardsCount}</span>{' '}
            {t('profile.card', { count: cardsCount })}
          </span>

          <button
            type="button"
            onClick={() => setModalMode('followers')}
            className="group flex items-baseline gap-1 transition-colors"
            title={t('follow.followers')}
          >
            <span className="font-bold text-slate-900 dark:text-white group-hover:text-blue-400 transition-colors">
              {followersCount}
            </span>
            <span className="text-slate-500 dark:text-slate-400">
              {t('follow.follower', { count: followersCount })}
            </span>
          </button>

          <button
            type="button"
            onClick={() => setModalMode('following')}
            className="group flex items-baseline gap-1 transition-colors"
            title={t('follow.following')}
          >
            <span className="font-bold text-slate-900 dark:text-white group-hover:text-blue-400 transition-colors">
              {followingCountState}
            </span>
            <span className="text-slate-500 dark:text-slate-400">{t('follow.subscriptionsLabel')}</span>
          </button>
        </div>

        {/* Значки / достижения */}
        <ProfileBadges profileId={profile.id} />
      </div>
    </div>

    {/* Модальное окно подписчиков / подписок */}
    {modalMode && (
      <FollowListModal
        mode={modalMode}
        profileId={profile.id}
        currentUserId={currentUserId}
        canUnfollow={isOwner}
        isOpen={true}
        onClose={() => setModalMode(null)}
        onUnfollow={
          modalMode === 'following'
            ? () => setFollowingCountState((n) => Math.max(0, n - 1))
            : undefined
        }
      />
    )}

    {/* Toast-уведомление */}
    {toast && (
      <Toast
        message={toast.message}
        type={toast.type}
        onClose={() => setToast(null)}
      />
    )}
    </>
  )
}