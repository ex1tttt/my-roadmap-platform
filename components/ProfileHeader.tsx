'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { Settings } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import UserAvatar from '@/components/UserAvatar'
import FollowListModal from '@/components/FollowListModal'

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
  isOwner: boolean
  currentUserId: string | null
}

function plural(n: number, one: string, few: string, many: string) {
  const mod10 = n % 10
  const mod100 = n % 100
  if (mod10 === 1 && mod100 !== 11) return one
  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 10 || mod100 >= 20)) return few
  return many
}

export default function ProfileHeader({
  profile,
  cardsCount,
  initialFollowersCount,
  followingCount,
  initialIsFollowing,
  isOwner,
  currentUserId,
}: Props) {
  const [isFollowing, setIsFollowing] = useState(initialIsFollowing)
  const [followersCount, setFollowersCount] = useState(initialFollowersCount)
  const [followingCountState, setFollowingCountState] = useState(followingCount)
  const [loading, setLoading] = useState(false)
  const [hovered, setHovered] = useState(false)
  const [modalMode, setModalMode] = useState<'followers' | 'following' | null>(null)
  const router = useRouter()

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

  return (
    <>
    <div className="mb-8 flex flex-col gap-6 rounded-2xl border border-white/10 bg-slate-900/50 p-6 sm:flex-row sm:items-start">
      {/* Аватар */}
      <div className="shrink-0">
        {profile.avatar ? (
          <img
            src={profile.avatar}
            alt={profile.username}
            className="h-20 w-20 rounded-full object-cover ring-2 ring-white/10"
          />
        ) : (
          <UserAvatar username={profile.username} size={80} />
        )}
      </div>

      {/* Информация */}
      <div className="flex flex-1 flex-col gap-2">
        {/* Имя + кнопка действия */}
        <div className="flex items-center justify-between gap-4">
          <h1 className="text-2xl font-bold text-white">{profile.username}</h1>

          {isOwner ? (
            <Link
              href="/settings"
              className="inline-flex items-center gap-2 rounded-lg border border-white/10 bg-white/5 px-3 py-1.5 text-sm text-slate-400 transition-colors hover:border-white/20 hover:text-slate-200"
            >
              <Settings className="h-4 w-4" />
              Настройки
            </Link>
          ) : currentUserId ? (
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
              {isFollowing ? (hovered ? 'Отписаться' : 'Вы подписаны') : 'Подписаться'}
            </button>
          ) : null}
        </div>

        {/* Био */}
        {profile.bio ? (
          <p className="text-sm text-slate-400">{profile.bio}</p>
        ) : (
          <p className="text-sm italic text-slate-600">Описание не добавлено</p>
        )}

        {/* Статистика */}
        <div className="mt-2 flex flex-wrap items-center gap-5 text-sm">
          <span className="text-slate-400">
            <span className="font-bold text-white">{cardsCount}</span>{' '}
            {plural(cardsCount, 'карточка', 'карточки', 'карточек')}
          </span>

          <button
            type="button"
            onClick={() => setModalMode('followers')}
            className="group flex items-baseline gap-1 transition-colors"
            title="Подписчики"
          >
            <span className="font-bold text-white group-hover:text-blue-400 transition-colors">
              {followersCount}
            </span>
            <span className="text-slate-400">
              {plural(followersCount, 'подписчик', 'подписчика', 'подписчиков')}
            </span>
          </button>

          <button
            type="button"
            onClick={() => setModalMode('following')}
            className="group flex items-baseline gap-1 transition-colors"
            title="Подписки"
          >
            <span className="font-bold text-white group-hover:text-blue-400 transition-colors">
              {followingCountState}
            </span>
            <span className="text-slate-400">подписок</span>
          </button>
        </div>
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
    </>
  )
}
