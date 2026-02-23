'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'
import Card from '@/components/Card'
import { User, Heart, Map as MapIcon } from 'lucide-react'

type Step = { id: string; order: number; title: string; content?: string; media_url?: string }
type Profile = { id: string; username: string; avatar?: string }
type CardType = {
  id: string
  title: string
  description?: string
  category?: string
  user: Profile
  steps?: Step[]
}

type Tab = 'my' | 'liked'

export default function ProfilePage() {
  const router = useRouter()
  const [profile, setProfile] = useState<Profile | null>(null)
  const [myCards, setMyCards] = useState<CardType[]>([])
  const [likedCards, setLikedCards] = useState<CardType[]>([])
  const [tab, setTab] = useState<Tab>('my')
  const [loading, setLoading] = useState(true)

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

      // Загружаем мои карточки и лайкнутые параллельно
      const [myCardsRes, likedRes] = await Promise.all([
        supabase.from('cards').select('*').eq('user_id', userId),
        supabase.from('likes').select('card_id').eq('user_id', userId),
      ])

      const myCardsRaw = myCardsRes.data ?? []
      const likedCardIds = (likedRes.data ?? []).map((l: any) => l.card_id)

      // Загружаем лайкнутые карточки отдельно, чтобы знать их user_id для профилей
      const likedCardsRaw = likedCardIds.length > 0
        ? (await supabase.from('cards').select('*').in('id', likedCardIds)).data ?? []
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

      // Загружаем шаги и профили параллельно
      const [stepsRes, profilesRes] = await Promise.all([
        supabase.from('steps').select('*').in('card_id', allCardIds).order('order', { ascending: true }),
        supabase.from('profiles').select('*').in('id', allUserIds),
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

      const toCardType = (c: any): CardType => ({
        id: c.id,
        title: c.title,
        description: c.description,
        category: c.category,
        user: profilesMap.get(c.user_id) ?? { id: c.user_id, username: 'Unknown' },
        steps: stepsByCard.get(c.id) ?? [],
      })

      setMyCards(myCardsRaw.map(toCardType))
      setLikedCards(likedCardsRaw.map(toCardType))
      setLoading(false)
    }

    load()
  }, [router])

  const tabs: { key: Tab; label: string; icon: React.ReactNode; count: number }[] = [
    { key: 'my', label: 'Мои дорожные карты', icon: <MapIcon className="w-4 h-4" />, count: myCards.length },
    { key: 'liked', label: 'Понравилось', icon: <Heart className="w-4 h-4" />, count: likedCards.length },
  ]

  const displayed = tab === 'my' ? myCards : likedCards

  if (loading) {
    return (
      <div className="min-h-screen bg-zinc-50 dark:bg-black flex items-center justify-center">
        <p className="text-gray-500 dark:text-gray-400">Загрузка...</p>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-zinc-50 dark:bg-black py-12 px-6">
      <main className="mx-auto max-w-6xl">

        {/* Шапка профиля */}
        <section className="mb-10 flex items-center gap-5">
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
            </p>
          </div>
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
        {displayed.length === 0 ? (
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
            ) : (
              <p className="text-gray-500 dark:text-gray-400">Вы ещё не поставили ни одного лайка.</p>
            )}
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {displayed.map((c) => (
              <Link key={c.id} href={`/card/${c.id}`} className="cursor-pointer">
                <Card card={c} />
              </Link>
            ))}
          </div>
        )}
      </main>
    </div>
  )
}
