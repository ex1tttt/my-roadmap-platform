'use client'

import { useEffect, useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { Heart } from 'lucide-react'
import { supabase } from '@/lib/supabase'

interface LikeButtonProps {
  cardId: string
}

export default function LikeButton({ cardId }: LikeButtonProps) {
  const router = useRouter()
  const [liked, setLiked] = useState(false)
  const [count, setCount] = useState(0)
  const [isLoading, setIsLoading] = useState(false)
  const [userId, setUserId] = useState<string | null>(null)
  const [animating, setAnimating] = useState(false)

  // Получаем текущего пользователя и начальные данные о лайках
  useEffect(() => {
    const init = async () => {
      const { data: { session } } = await supabase.auth.getSession()
      const uid = session?.user?.id ?? null
      setUserId(uid)

      // Считаем общее количество лайков
      const { count: total } = await supabase
        .from('likes')
        .select('*', { count: 'exact', head: true })
        .eq('card_id', cardId)

      setCount(total ?? 0)

      // Проверяем, лайкал ли текущий пользователь
      if (uid) {
        const { data } = await supabase
          .from('likes')
          .select('id')
          .eq('card_id', cardId)
          .eq('user_id', uid)
          .maybeSingle()

        setLiked(!!data)
      }
    }

    init()
  }, [cardId])

  const handleClick = useCallback(async () => {
    if (isLoading) return

    // Если не залогинен — редирект на логин
    if (!userId) {
      router.push('/login')
      return
    }

    // --- Optimistic UI ---
    const wasLiked = liked
    setLiked(!wasLiked)
    setCount(prev => wasLiked ? prev - 1 : prev + 1)
    setAnimating(true)
    setTimeout(() => setAnimating(false), 400)
    // ---------------------

    setIsLoading(true)
    try {
      if (wasLiked) {
        // Удаляем лайк
        await supabase
          .from('likes')
          .delete()
          .eq('card_id', cardId)
          .eq('user_id', userId)
      } else {
        // Добавляем лайк
        await supabase
          .from('likes')
          .insert({ card_id: cardId, user_id: userId })

        // Создаём уведомление (не если пользователь лайкает свою карточку)
        const { data: card } = await supabase
          .from('cards')
          .select('user_id, title')
          .eq('id', cardId)
          .maybeSingle()

        if (card && card.user_id !== userId) {
          await supabase.from('notifications').insert({
            receiver_id: card.user_id,
            actor_id: userId,
            type: 'like',
            card_id: cardId,
          })
        }
      }
    } catch {
      // Откатываем optimistic update при ошибке
      setLiked(wasLiked)
      setCount(prev => wasLiked ? prev + 1 : prev - 1)
    } finally {
      setIsLoading(false)
    }
  }, [cardId, isLoading, liked, router, userId])

  return (
    <button
      onClick={handleClick}
      aria-label={liked ? 'Убрать лайк' : 'Поставить лайк'}
      className={`
        group flex items-center gap-1.5 px-3 py-1.5 rounded-full
        border transition-all duration-200 select-none
        ${liked
          ? 'border-red-500/50 bg-red-500/10 text-red-400'
          : 'border-white/10 bg-white/5 text-gray-400 hover:border-red-500/40 hover:text-red-400'
        }
      `}
    >
      <Heart
        className={`
          w-4 h-4 transition-all duration-200
          ${animating ? 'scale-125' : 'scale-100'}
          ${liked
            ? 'fill-red-500 text-red-500 drop-shadow-[0_0_6px_rgba(239,68,68,0.8)]'
            : 'fill-transparent group-hover:text-red-400'
          }
        `}
      />
      <span className={`text-sm font-medium tabular-nums transition-colors duration-200 ${liked ? 'text-red-400' : ''}`}>
        {count}
      </span>
    </button>
  )
}
