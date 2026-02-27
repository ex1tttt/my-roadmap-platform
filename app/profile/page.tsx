'use client'

import { useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'
import Card from '@/components/Card'
import FollowListModal from '@/components/FollowListModal'
import { User, Heart, Map as MapIcon, Trash2, Bookmark, Settings, MoreVertical, Pencil, Users } from 'lucide-react'
import ProfileTabsSelf from '@/components/ProfileTabsSelf'
import { useTranslation } from 'react-i18next'
import { useHasMounted } from '@/hooks/useHasMounted'

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
  const { t } = useTranslation()
  const mounted = useHasMounted()
  const [profile, setProfile] = useState<Profile | null>(null)
  const [myCards, setMyCards] = useState<CardType[]>([])
  const [likedCards, setLikedCards] = useState<CardType[]>([])
  const [favoriteCards, setFavoriteCards] = useState<CardType[]>([])
  const [favoritesLoaded, setFavoritesLoaded] = useState(false)
  const [favoritesLoading, setFavoritesLoading] = useState(false)
  const [favoritesCount, setFavoritesCount] = useState(0)
  const [tab, setTab] = useState<any>('my')
    const [sharedCards, setSharedCards] = useState<CardType[]>([])
  const [loading, setLoading] = useState(true)
  const [openMenuId, setOpenMenuId] = useState<string | null>(null)
  const [followersCount, setFollowersCount] = useState(0)
  const [followingCount, setFollowingCount] = useState(0)
  const [modalMode, setModalMode] = useState<'followers' | 'following' | null>(null)
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

      // --- Доступные мне ---
      const userEmail = user.email;
      if (userEmail) {
        const { data: collabRows = [] } = await supabase
          .from('card_collaborators')
          .select('card_id')
          .eq('user_email', userEmail);
        const cardIds = (collabRows ?? []).map((row: any) => row.card_id);
        if (cardIds.length > 0) {
          const { data: shared = [] } = await supabase
            .from('cards')
            .select('*')
            .in('id', cardIds);
          setSharedCards(shared ? shared.map(toCardType) : []);
        } else {
          setSharedCards([]);
        }
      }
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
    if (!window.confirm(t('card.deleteConfirm'))) return
    const { error } = await supabase.from('cards').delete().eq('id', cardId)
    if (error) {
      alert('Ошибка при удалении: ' + error.message)
      return
    }
    setMyCards((prev) => prev.filter((c) => c.id !== cardId))
  }

  const displayed = tab === 'my' ? myCards : tab === 'liked' ? likedCards : tab === 'favorites' ? favoriteCards : sharedCards

  if (!mounted) return <div className="opacity-0" />;

  if (loading) {
    return (
      <div className="min-h-screen bg-white dark:bg-[#020617] flex items-center justify-center">
        <p className="text-gray-500 dark:text-gray-400">{t('common.loading')}</p>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-white dark:bg-[#020617] py-12 px-6">
      <main className="mx-auto max-w-7xl">
        {/* Шапка профиля */}
        <section className="mb-10 flex items-center justify-between gap-5">
          <div className="flex items-center gap-5">
            <div className="flex h-20 w-20 items-center justify-center rounded-full bg-slate-200 dark:bg-slate-800 overflow-hidden shrink-0">
              {profile?.avatar ? (
                <img src={profile.avatar} alt={profile.username} className="h-full w-full object-cover" />
              ) : (
                <User className="h-10 w-10 text-slate-400" />
              )}
            </div>
            <div>
              <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100">
                {profile?.username ?? '—'}
              </h1>
              <p className="text-sm text-slate-500 dark:text-slate-400">
                {myCards.length} {t('profile.cards')} · {likedCards.length} {t('profile.liked').toLowerCase()}
                {' · '}
                <button
                  type="button"
                  onClick={() => setModalMode('followers')}
                  className="font-semibold text-slate-600 dark:text-slate-300 hover:text-blue-400 transition-colors"
                >
                  {followersCount} {t('follow.followers').toLowerCase()}
                </button>
                {' · '}
                <button
                  type="button"
                  onClick={() => setModalMode('following')}
                  className="font-semibold text-slate-600 dark:text-slate-300 hover:text-blue-400 transition-colors"
                >
                  {followingCount} {t('follow.following').toLowerCase()}
                </button>
              </p>
              {profile?.bio ? (
                <p className="mt-2 text-sm text-slate-600 dark:text-slate-300 max-w-md">{profile.bio}</p>
              ) : (
                <p className="mt-2 text-xs text-slate-500 dark:text-slate-400 italic">{t('profile.noBio')}</p>
              )}
            </div>
          </div>
          <Link
            href="/settings"
            className="flex items-center gap-2 rounded-lg border border-slate-200 dark:border-white/10 bg-white dark:bg-white/5 px-4 py-2 text-sm text-slate-700 dark:text-gray-300 hover:bg-slate-50 dark:hover:bg-white/10 hover:text-slate-900 dark:hover:text-white transition-colors"
          >
            <Settings className="h-4 w-4" />
            {t('profile.settings')}
          </Link>
        </section>

        {/* Вкладки с "Доступные мне" */}
        <ProfileTabsSelf
          myCards={myCards}
          likedCards={likedCards}
          favoriteCards={favoriteCards}
          sharedCards={sharedCards}
          profile={profile}
          followersCount={followersCount}
          followingCount={followingCount}
          tab={tab}
          setTab={setTab}
          favoritesCount={favoritesCount}
          loading={loading}
          favoritesLoading={favoritesLoading}
          displayed={displayed}
          handleCardLike={handleCardLike}
          handleCardFavorite={handleCardFavorite}
          handleDelete={handleDelete}
          openMenuId={openMenuId}
          setOpenMenuId={setOpenMenuId}
          menuRef={menuRef}
          t={t}
          modalMode={modalMode}
          setModalMode={setModalMode}
          setFollowingCount={setFollowingCount}
        />

        {/* Модалка подписчиков / подписок */}
        {modalMode && profile && (
          <FollowListModal
            mode={modalMode}
            profileId={profile.id}
            currentUserId={profile.id}
            canUnfollow={true}
            isOpen={true}
            onClose={() => setModalMode(null)}
            onUnfollow={() => setFollowingCount((n) => Math.max(0, n - 1))}
          />
        )}
      </main>
    </div>
  )
}
