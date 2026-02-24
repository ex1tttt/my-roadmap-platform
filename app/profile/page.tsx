'use client'

import { useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'
import Card from '@/components/Card'
import { User, Heart, Map as MapIcon, Trash2, Bookmark, Settings, MoreVertical, Pencil } from 'lucide-react'

type Step = { id: string; order: number; title: string; content?: string; media_url?: string }
type Profile = { id: string; username: string; avatar?: string; bio?: string | null }
type CardType = {
  id: string
  title: string
  description?: string
  category?: string
  user: Profile
  steps?: Step[]
  likesCount: number
  isLiked: boolean
  isFavorite: boolean
  averageRating: number
  commentsCount: number
}

type Tab = 'my' | 'liked' | 'favorites'

export default function ProfilePage() {
  const router = useRouter()
  const [profile, setProfile] = useState<Profile | null>(null)
  const [myCards, setMyCards] = useState<CardType[]>([])
  const [likedCards, setLikedCards] = useState<CardType[]>([])
  const [favoriteCards, setFavoriteCards] = useState<CardType[]>([])
  const [favoritesLoaded, setFavoritesLoaded] = useState(false)
  const [favoritesLoading, setFavoritesLoading] = useState(false)
  const [favoritesCount, setFavoritesCount] = useState(0)
  const [tab, setTab] = useState<Tab>('my')
  const [loading, setLoading] = useState(true)
  const [openMenuId, setOpenMenuId] = useState<string | null>(null)
  const [followersCount, setFollowersCount] = useState(0)
  const [followingCount, setFollowingCount] = useState(0)
  const menuRef = useRef<HTMLDivElement>(null)

  // Закрываем меню при клике вне его
  useEffect(() => {
    if (!openMenuId) return
    function handleClick(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setOpenMenuId(null)
      }
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [openMenuId])

  useEffect(() => {
    const load = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) {
        router.replace('/login')
        return
      }

      const userId = user.id

      // Профиль пользователя
      const { data: profileData } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', userId)
        .maybeSingle()

      setProfile(profileData ?? { id: userId, username: user.email?.split('@')[0] ?? 'Пользователь' })

      // Загружаем мои карточки, лайкнутые и подписки параллельно
      const [myCardsRes, likedRes, , followersRes, followingRes] = await Promise.all([
        supabase.from('cards').select('*').order('created_at', { ascending: false }).eq('user_id', userId),
        supabase.from('likes').select('card_id').eq('user_id', userId),
        supabase.from('favorites').select('*', { count: 'exact', head: true }).eq('user_id', userId)
          .then(({ count }) => setFavoritesCount(count ?? 0)),
        // Подписчики: строки, где following_id = userId
        supabase.from('follows').select('*', { count: 'exact', head: true }).eq('following_id', userId),
        // Подписки: строки, где follower_id = userId
        supabase.from('follows').select('*', { count: 'exact', head: true }).eq('follower_id', userId),
      ])

      setFollowersCount(followersRes.count ?? 0)
      setFollowingCount(followingRes.count ?? 0)

      const myCardsRaw = myCardsRes.data ?? []
      const likedCardIds = (likedRes.data ?? []).map((l: any) => l.card_id)

      // Загружаем лайкнутые карточки отдельно, чтобы знать их user_id для профилей
      const likedCardsRaw = likedCardIds.length > 0
        ? (await supabase.from('cards').select('*').order('created_at', { ascending: false }).in('id', likedCardIds)).data ?? []
        : []

      const allCardIds = Array.from(new Set([
        ...myCardsRaw.map((c: any) => c.id),
        ...likedCardsRaw.map((c: any) => c.id),
      ]))

      const allUserIds = Array.from(new Set([
        ...myCardsRaw.map((c: any) => c.user_id),
        ...likedCardsRaw.map((c: any) => c.user_id),
        userId,
      ]))

      if (allCardIds.length === 0) {
        setMyCards([])
        setLikedCards([])
        setLoading(false)
        return
      }

      // Загружаем шаги, профили и социальные данные параллельно
      const [stepsRes, profilesRes, likesRes, userLikesRes, userFavsRes, ratingsRes, commentsRes] = await Promise.all([
        supabase.from('steps').select('*').in('card_id', allCardIds).order('order', { ascending: true }),
        supabase.from('profiles').select('*').in('id', allUserIds),
        supabase.from('likes').select('card_id').in('card_id', allCardIds),
        supabase.from('likes').select('card_id').eq('user_id', userId).in('card_id', allCardIds),
        supabase.from('favorites').select('roadmap_id').eq('user_id', userId).in('roadmap_id', allCardIds),
        supabase.from('ratings').select('roadmap_id, rate').in('roadmap_id', allCardIds),
        supabase.from('comments').select('roadmap_id').in('roadmap_id', allCardIds),
      ])

      const profilesMap: Map<string, Profile> = new Map()
      ;(profilesRes.data ?? []).forEach((p: any) =>
        profilesMap.set(p.id, { id: p.id, username: p.username, avatar: p.avatar })
      )

      const stepsByCard: Map<string, Step[]> = new Map()
      ;(stepsRes.data ?? []).forEach((s: any) => {
        const arr = stepsByCard.get(s.card_id) ?? []
        arr.push({ id: s.id, order: s.order, title: s.title, content: s.content, media_url: s.media_url })
        stepsByCard.set(s.card_id, arr)
      })

      const likesCountMap = new Map<string, number>()
      ;(likesRes.data ?? []).forEach((l: any) =>
        likesCountMap.set(l.card_id, (likesCountMap.get(l.card_id) ?? 0) + 1)
      )
      const userLikedSet = new Set<string>((userLikesRes.data ?? []).map((l: any) => l.card_id))
      const userFavSet = new Set<string>((userFavsRes.data ?? []).map((f: any) => f.roadmap_id))

      const ratingsMap = new Map<string, number[]>()
      ;(ratingsRes.data ?? []).forEach((r: any) => {
        const arr = ratingsMap.get(r.roadmap_id) ?? []
        arr.push(r.rate)
        ratingsMap.set(r.roadmap_id, arr)
      })
      const avgRatingMap = new Map<string, number>()
      ratingsMap.forEach((values, cardId) => {
        avgRatingMap.set(cardId, values.reduce((a, b) => a + b, 0) / values.length)
      })

      const commentsCountMap = new Map<string, number>()
      ;(commentsRes.data ?? []).forEach((cm: any) =>
        commentsCountMap.set(cm.roadmap_id, (commentsCountMap.get(cm.roadmap_id) ?? 0) + 1)
      )

      const toCardType = (c: any): CardType => ({
        id: c.id,
        title: c.title,
        description: c.description,
        category: c.category,
        user: profilesMap.get(c.user_id) ?? { id: c.user_id, username: 'Unknown' },
        steps: stepsByCard.get(c.id) ?? [],
        likesCount: likesCountMap.get(c.id) ?? 0,
        isLiked: userLikedSet.has(c.id),
        isFavorite: userFavSet.has(c.id),
        averageRating: avgRatingMap.get(c.id) ?? 0,
        commentsCount: commentsCountMap.get(c.id) ?? 0,
      })

      setMyCards(myCardsRaw.map(toCardType))
      setLikedCards(likedCardsRaw.map(toCardType))
      setLoading(false)
    }

    load()
  }, [router])

  // Ленивая загрузка избранного при первом переключении на вкладку
  useEffect(() => {
    if (tab !== 'favorites' || favoritesLoaded || favoritesLoading) return

    const loadFavorites = async () => {
      setFavoritesLoading(true)
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return

      const { data: favData } = await supabase
        .from('favorites')
        .select('roadmap_id')
        .eq('user_id', user.id)

      const favIds = (favData ?? []).map((f: any) => f.roadmap_id)

      if (favIds.length === 0) {
        setFavoriteCards([])
        setFavoritesLoaded(true)
        setFavoritesLoading(false)
        return
      }

      const { data: cardsData } = await supabase.from('cards').select('*').order('created_at', { ascending: false }).in('id', favIds)
      const cardsRaw = cardsData ?? []

      const cardIds = cardsRaw.map((c: any) => c.id)
      const userIds = Array.from(new Set(cardsRaw.map((c: any) => c.user_id)))

      const [stepsRes, profilesRes, likesRes2, userLikesRes2, userFavsRes2, ratingsRes2, commentsRes2] = await Promise.all([
        supabase.from('steps').select('*').in('card_id', cardIds).order('order', { ascending: true }),
        supabase.from('profiles').select('*').in('id', userIds),
        supabase.from('likes').select('card_id').in('card_id', cardIds),
        supabase.from('likes').select('card_id').eq('user_id', user.id).in('card_id', cardIds),
        supabase.from('favorites').select('roadmap_id').eq('user_id', user.id).in('roadmap_id', cardIds),
        supabase.from('ratings').select('roadmap_id, rate').in('roadmap_id', cardIds),
        supabase.from('comments').select('roadmap_id').in('roadmap_id', cardIds),
      ])

      const profilesMap = new Map<string, Profile>()
      ;(profilesRes.data ?? []).forEach((p: any) =>
        profilesMap.set(p.id, { id: p.id, username: p.username, avatar: p.avatar })
      )

      const stepsByCard = new Map<string, Step[]>()
      ;(stepsRes.data ?? []).forEach((s: any) => {
        const arr = stepsByCard.get(s.card_id) ?? []
        arr.push({ id: s.id, order: s.order, title: s.title, content: s.content, media_url: s.media_url })
        stepsByCard.set(s.card_id, arr)
      })

      const likesCountMap2 = new Map<string, number>()
      ;(likesRes2.data ?? []).forEach((l: any) =>
        likesCountMap2.set(l.card_id, (likesCountMap2.get(l.card_id) ?? 0) + 1)
      )
      const userLikedSet2 = new Set<string>((userLikesRes2.data ?? []).map((l: any) => l.card_id))
      const userFavSet2 = new Set<string>((userFavsRes2.data ?? []).map((f: any) => f.roadmap_id))

      const ratingsMap2 = new Map<string, number[]>()
      ;(ratingsRes2.data ?? []).forEach((r: any) => {
        const arr = ratingsMap2.get(r.roadmap_id) ?? []
        arr.push(r.rate)
        ratingsMap2.set(r.roadmap_id, arr)
      })
      const avgRatingMap2 = new Map<string, number>()
      ratingsMap2.forEach((values, cardId) => {
        avgRatingMap2.set(cardId, values.reduce((a, b) => a + b, 0) / values.length)
      })

      const commentsCountMap2 = new Map<string, number>()
      ;(commentsRes2.data ?? []).forEach((cm: any) =>
        commentsCountMap2.set(cm.roadmap_id, (commentsCountMap2.get(cm.roadmap_id) ?? 0) + 1)
      )

      setFavoriteCards(
        cardsRaw.map((c: any) => ({
          id: c.id,
          title: c.title,
          description: c.description,
          category: c.category,
          user: profilesMap.get(c.user_id) ?? { id: c.user_id, username: 'Unknown' },
          steps: stepsByCard.get(c.id) ?? [],
          likesCount: likesCountMap2.get(c.id) ?? 0,
          isLiked: userLikedSet2.has(c.id),
          isFavorite: userFavSet2.has(c.id),
          averageRating: avgRatingMap2.get(c.id) ?? 0,
          commentsCount: commentsCountMap2.get(c.id) ?? 0,
        }))
      )
      setFavoritesCount(cardsRaw.length)
      setFavoritesLoaded(true)
      setFavoritesLoading(false)
    }

    loadFavorites()
  }, [tab, favoritesLoaded, favoritesLoading])

  function handleCardLike(cardId: string, isLiked: boolean) {
    const update = (arr: CardType[]) =>
      arr.map((c) =>
        c.id === cardId
          ? { ...c, isLiked, likesCount: Math.max(0, isLiked ? c.likesCount + 1 : c.likesCount - 1) }
          : c
      )
    setMyCards(update)
    setLikedCards(update)
    setFavoriteCards(update)
  }

  function handleCardFavorite(cardId: string, isFavorite: boolean) {
    const update = (arr: CardType[]) =>
      arr.map((c) => (c.id === cardId ? { ...c, isFavorite } : c))
    setMyCards(update)
    setLikedCards(update)
    setFavoriteCards(update)
  }

  async function handleDelete(cardId: string) {
    if (!window.confirm('Вы уверены, что хотите удалить эту карточку?')) return
    const { error } = await supabase.from('cards').delete().eq('id', cardId)
    if (error) {
      alert('Ошибка при удалении: ' + error.message)
      return
    }
    setMyCards((prev) => prev.filter((c) => c.id !== cardId))
  }

  const tabs: { key: Tab; label: string; icon: React.ReactNode; count: number }[] = [
    { key: 'my', label: 'Мои дорожные карты', icon: <MapIcon className="w-4 h-4" />, count: myCards.length },
    { key: 'liked', label: 'Понравилось', icon: <Heart className="w-4 h-4" />, count: likedCards.length },
    { key: 'favorites', label: 'Избранное', icon: <Bookmark className="w-4 h-4" />, count: favoritesCount },
  ]

  const displayed = tab === 'my' ? myCards : tab === 'liked' ? likedCards : favoriteCards

  if (loading) {
    return (
      <div className="min-h-screen bg-zinc-50 dark:bg-black flex items-center justify-center">
        <p className="text-gray-500 dark:text-gray-400">Загрузка...</p>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-zinc-50 dark:bg-black py-12 px-6">
      <main className="mx-auto max-w-7xl">

        {/* Шапка профиля */}
        <section className="mb-10 flex items-center justify-between gap-5">
          <div className="flex items-center gap-5">
            <div className="flex h-20 w-20 items-center justify-center rounded-full bg-gray-200 dark:bg-gray-800 overflow-hidden shrink-0">
              {profile?.avatar ? (
                <img src={profile.avatar} alt={profile.username} className="h-full w-full object-cover" />
              ) : (
                <User className="h-10 w-10 text-gray-400" />
              )}
            </div>
            <div>
              <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">
                {profile?.username ?? '—'}
              </h1>
              <p className="text-sm text-gray-500 dark:text-gray-400">
                {myCards.length} карт · {likedCards.length} лайков
                {' · '}
                <span className="font-semibold text-slate-300">{followersCount}</span> подписчиков
                {' · '}
                <span className="font-semibold text-slate-300">{followingCount}</span> подписок
              </p>
              {profile?.bio ? (
                <p className="mt-2 text-sm text-slate-300 max-w-md">{profile.bio}</p>
              ) : (
                <p className="mt-2 text-xs text-slate-600 italic">Описание не добавлено</p>
              )}
            </div>
          </div>
          <Link
            href="/settings"
            className="flex items-center gap-2 rounded-lg border border-white/10 bg-white/5 px-4 py-2 text-sm text-gray-300 hover:bg-white/10 hover:text-white transition-colors"
          >
            <Settings className="h-4 w-4" />
            Настройки профиля
          </Link>
        </section>

        {/* Вкладки */}
        <div className="mb-8 flex gap-1 border-b border-gray-200 dark:border-white/10">
          {tabs.map((t) => (
            <button
              key={t.key}
              onClick={() => setTab(t.key)}
              className={`
                flex items-center gap-2 px-4 py-2.5 text-sm font-medium transition-colors
                border-b-2 -mb-px
                ${tab === t.key
                  ? 'border-blue-500 text-blue-500'
                  : 'border-transparent text-gray-500 hover:text-gray-900 dark:hover:text-gray-100'
                }
              `}
            >
              {t.icon}
              {t.label}
              <span className={`
                rounded-full px-1.5 py-0.5 text-xs font-semibold
                ${tab === t.key
                  ? 'bg-blue-500/15 text-blue-500'
                  : 'bg-gray-100 text-gray-500 dark:bg-white/10 dark:text-gray-400'
                }
              `}>
                {t.count}
              </span>
            </button>
          ))}
        </div>

        {/* Карточки */}
        {tab === 'favorites' && favoritesLoading ? (
          <div className="rounded-lg bg-white p-10 text-center shadow-sm dark:bg-gray-900">
            <p className="text-gray-500 dark:text-gray-400">Загрузка...</p>
          </div>
        ) : displayed.length === 0 ? (
          <div className="rounded-lg bg-white p-10 text-center shadow-sm dark:bg-gray-900">
            {tab === 'my' ? (
              <>
                <p className="text-gray-500 dark:text-gray-400">У вас пока нет дорожных карт.</p>
                <Link
                  href="/create"
                  className="mt-4 inline-flex items-center gap-1.5 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-500 transition-colors"
                >
                  Создать первую
                </Link>
              </>
            ) : tab === 'liked' ? (
              <p className="text-gray-500 dark:text-gray-400">Вы ещё не поставили ни одного лайка.</p>
            ) : (
              <p className="text-gray-500 dark:text-gray-400">В избранном пока ничего нет.</p>
            )}
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 items-stretch">
            {displayed.map((c) => (
              <div key={c.id} className="relative">
                <Card
                    card={c}
                    userId={profile?.id}
                    initialLikesCount={c.likesCount}
                    initialIsLiked={c.isLiked}
                    initialIsFavorite={c.isFavorite}
                    initialAverageRating={c.averageRating}
                    initialCommentsCount={c.commentsCount}
                    onLike={handleCardLike}
                    onFavorite={handleCardFavorite}
                    actions={tab === 'my' ? (
                      <div ref={openMenuId === c.id ? menuRef : undefined}>
                        <button
                          onClick={(e) => { e.preventDefault(); e.stopPropagation(); setOpenMenuId(openMenuId === c.id ? null : c.id) }}
                          className="flex h-8 w-8 items-center justify-center rounded-md text-slate-400 hover:text-white bg-black/40 hover:bg-white/10 backdrop-blur-sm transition-colors"
                          title="Действия"
                        >
                          <MoreVertical className="h-4 w-4" />
                        </button>
                        {openMenuId === c.id && (
                          <div className="absolute right-0 top-full z-30 mt-1 w-44 rounded-xl border border-white/10 bg-slate-900/95 p-1 shadow-xl backdrop-blur-md">
                            <Link
                              href={`/card/${c.id}/edit`}
                              onClick={() => setOpenMenuId(null)}
                              className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-sm text-slate-300 hover:bg-white/5 hover:text-white transition-colors"
                            >
                              <Pencil className="h-4 w-4" />
                              Редактировать
                            </Link>
                            <button
                              onClick={(e) => { e.preventDefault(); e.stopPropagation(); setOpenMenuId(null); handleDelete(c.id) }}
                              className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-sm text-red-400 hover:bg-red-500/10 hover:text-red-300 transition-colors"
                            >
                              <Trash2 className="h-4 w-4" />
                              Удалить
                            </button>
                          </div>
                        )}
                      </div>
                    ) : undefined}
                  />
              </div>
            ))}
          </div>
        )}
      </main>
    </div>
  )
}
