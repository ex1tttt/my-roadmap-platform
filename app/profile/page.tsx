'use client'

import { useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'
import Card from '@/components/Card'
import FollowListModal from '@/components/FollowListModal'
import { User, Map as MapIcon, Trash2, Bookmark, MoreVertical, Pencil, Users } from 'lucide-react'
import ProfileTabsSelf from '@/components/ProfileTabsSelf'
import { useTranslation } from 'react-i18next'
import { useHasMounted } from '@/hooks/useHasMounted'
import { toast } from 'sonner'

type Step = { id: string; order: number; title: string; content?: string; media_url?: string }
type Profile = { id: string; username: string; avatar?: string; bio?: string | null }
type CardType = {
  id: string
  title: string
  description?: string
  category?: string
  is_pinned?: boolean
  user: Profile
  steps?: Step[]
  likesCount: number
  isLiked: boolean
  isFavorite: boolean
  averageRating: number
  commentsCount: number
}

type Tab = 'my' | 'shared'

export default function ProfilePage() {
  const router = useRouter()
  const { t } = useTranslation()
  const mounted = useHasMounted()
  const [profile, setProfile] = useState<Profile | null>(null)
  const [myCards, setMyCards] = useState<CardType[]>([])
  const [sharedCards, setSharedCards] = useState<CardType[]>([])
  const [tab, setTab] = useState<any>('my')
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

      // Загружаем мои карточки и подписки параллельно
      const [myCardsRes, followersRes, followingRes] = await Promise.all([
        supabase.from('cards').select('*').order('created_at', { ascending: false }).eq('user_id', userId),
        // Подписчики: строки, где following_id = userId
        supabase.from('follows').select('*', { count: 'exact', head: true }).eq('following_id', userId),
        // Подписки: строки, где follower_id = userId
        supabase.from('follows').select('*', { count: 'exact', head: true }).eq('follower_id', userId),
      ])

      setFollowersCount(followersRes.count ?? 0)
      setFollowingCount(followingRes.count ?? 0)

      const myCardsRaw = myCardsRes.data ?? []

      const allCardIds = myCardsRaw.map((c: any) => c.id)
      const allUserIds = Array.from(new Set([...myCardsRaw.map((c: any) => c.user_id), userId]))

      if (allCardIds.length === 0) {
        setMyCards([])
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
        is_pinned: c.is_pinned ?? false,
        user: profilesMap.get(c.user_id) ?? { id: c.user_id, username: 'Unknown' },
        steps: stepsByCard.get(c.id) ?? [],
        likesCount: likesCountMap.get(c.id) ?? 0,
        isLiked: userLikedSet.has(c.id),
        isFavorite: userFavSet.has(c.id),
        averageRating: avgRatingMap.get(c.id) ?? 0,
        commentsCount: commentsCountMap.get(c.id) ?? 0,
      })

      setMyCards(myCardsRaw.map(toCardType))

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
          const sharedCards = shared ?? [];

          // Загружаем профили владельцев, шаги и социальные данные для shared карточек
          const sharedOwnerIds = Array.from(new Set(sharedCards.map((c: any) => c.user_id)));
          const [sharedProfilesRes, sharedStepsRes, sharedLikesRes, sharedUserLikesRes, sharedUserFavsRes, sharedRatingsRes, sharedCommentsRes] = await Promise.all([
            sharedOwnerIds.length > 0
              ? supabase.from('profiles').select('*').in('id', sharedOwnerIds)
              : Promise.resolve({ data: [] }),
            supabase.from('steps').select('*').in('card_id', cardIds).order('order', { ascending: true }),
            supabase.from('likes').select('card_id').in('card_id', cardIds),
            supabase.from('likes').select('card_id').eq('user_id', userId).in('card_id', cardIds),
            supabase.from('favorites').select('roadmap_id').eq('user_id', userId).in('roadmap_id', cardIds),
            supabase.from('ratings').select('roadmap_id, rate').in('roadmap_id', cardIds),
            supabase.from('comments').select('roadmap_id').in('roadmap_id', cardIds),
          ]);

          // Добавляем профили в profilesMap
          (sharedProfilesRes.data ?? []).forEach((p: any) =>
            profilesMap.set(p.id, { id: p.id, username: p.username, avatar: p.avatar })
          );

          const sharedStepsByCard = new Map<string, Step[]>();
          (sharedStepsRes.data ?? []).forEach((s: any) => {
            const arr = sharedStepsByCard.get(s.card_id) ?? [];
            arr.push({ id: s.id, order: s.order, title: s.title, content: s.content, media_url: s.media_url });
            sharedStepsByCard.set(s.card_id, arr);
          });

          const sharedLikesCountMap = new Map<string, number>();
          (sharedLikesRes.data ?? []).forEach((l: any) =>
            sharedLikesCountMap.set(l.card_id, (sharedLikesCountMap.get(l.card_id) ?? 0) + 1)
          );
          const sharedUserLikedSet = new Set<string>((sharedUserLikesRes.data ?? []).map((l: any) => l.card_id));
          const sharedUserFavSet = new Set<string>((sharedUserFavsRes.data ?? []).map((f: any) => f.roadmap_id));

          const sharedRatingsMap = new Map<string, number[]>();
          (sharedRatingsRes.data ?? []).forEach((r: any) => {
            const arr = sharedRatingsMap.get(r.roadmap_id) ?? [];
            arr.push(r.rate);
            sharedRatingsMap.set(r.roadmap_id, arr);
          });
          const sharedAvgRatingMap = new Map<string, number>();
          sharedRatingsMap.forEach((values, cardId) => {
            sharedAvgRatingMap.set(cardId, values.reduce((a: number, b: number) => a + b, 0) / values.length);
          });

          const sharedCommentsCountMap = new Map<string, number>();
          (sharedCommentsRes.data ?? []).forEach((cm: any) =>
            sharedCommentsCountMap.set(cm.roadmap_id, (sharedCommentsCountMap.get(cm.roadmap_id) ?? 0) + 1)
          );

          const toSharedCardType = (c: any): CardType => ({
            id: c.id,
            title: c.title,
            description: c.description,
            category: c.category,
            is_pinned: c.is_pinned ?? false,
            user: profilesMap.get(c.user_id) ?? { id: c.user_id, username: 'Unknown' },
            steps: sharedStepsByCard.get(c.id) ?? [],
            likesCount: sharedLikesCountMap.get(c.id) ?? 0,
            isLiked: sharedUserLikedSet.has(c.id),
            isFavorite: sharedUserFavSet.has(c.id),
            averageRating: sharedAvgRatingMap.get(c.id) ?? 0,
            commentsCount: sharedCommentsCountMap.get(c.id) ?? 0,
          });

          setSharedCards(sharedCards.map(toSharedCardType));
        } else {
          setSharedCards([]);
        }
      }
      setLoading(false)
    }

    load()
  }, [router])

  function handleCardLike(cardId: string, isLiked: boolean) {
    setMyCards((prev) => prev.map((c) =>
      c.id === cardId ? { ...c, isLiked, likesCount: Math.max(0, isLiked ? c.likesCount + 1 : c.likesCount - 1) } : c
    ))
  }

  function handleCardFavorite(cardId: string, isFavorite: boolean) {
    setMyCards((prev) => prev.map((c) => (c.id === cardId ? { ...c, isFavorite } : c)))
  }

  async function handleDelete(cardId: string) {
    const { error } = await supabase.from('cards').delete().eq('id', cardId)
    if (error) {
      toast.error('Ошибка при удалении: ' + error.message)
      return
    }
    setMyCards((prev) => prev.filter((c) => c.id !== cardId))
  }

  const displayed = tab === 'my' ? myCards : sharedCards

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

        </section>

        {/* Вкладки с "Доступные мне" */}
        <ProfileTabsSelf
          myCards={myCards}
          setMyCards={setMyCards}
          likedCards={[]}
          favoriteCards={[]}
          sharedCards={sharedCards}
          profile={profile}
          followersCount={followersCount}
          followingCount={followingCount}
          tab={tab}
          setTab={setTab}
          favoritesCount={0}
          loading={loading}
          favoritesLoading={false}
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
