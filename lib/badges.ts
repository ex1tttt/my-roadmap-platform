/**
 * lib/badges.ts
 * Утилита для проверки и выдачи значков пользователю.
 */

import { supabase } from '@/lib/supabase'
import { toast } from 'sonner'

export type BadgeType = 'first_card' | 'like' | 'comment' | 'follow_received' | 'fan' | 'collector'

/** Вставляет значок если ещё не выдан. Возвращает true если выдан впервые. */
async function awardIfNew(userId: string, badgeId: string): Promise<boolean> {
  const { data: existing } = await supabase
    .from('user_badges')
    .select('badge_id')
    .eq('user_id', userId)
    .eq('badge_id', badgeId)
    .maybeSingle()

  if (existing) return false

  const { error } = await supabase
    .from('user_badges')
    .insert({ user_id: userId, badge_id: badgeId, awarded_at: new Date().toISOString() })

  if (error) {
    if (error.code === '23505') return false
    console.error('[badges] insert error:', error)
    return false
  }
  return true
}

export async function checkAndAwardBadges(userId: string, type: BadgeType): Promise<void> {

  // ── first_card: pioneer (1), creator (5), explorer (10) ─────────────────
  if (type === 'first_card') {
    const { count, error } = await supabase
      .from('cards')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', userId)

    if (error) { console.error('[badges] first_card count error:', error); return }
    const n = count ?? 0

    if (n >= 1 && await awardIfNew(userId, 'pioneer'))  toast.success('🏆 Значок «Первопроходец» получен!')
    if (n >= 5 && await awardIfNew(userId, 'creator'))   toast.success('🏆 Значок «Картограф» получен!')
    if (n >= 10 && await awardIfNew(userId, 'explorer')) toast.success('🏆 Значок «Исследователь» получен!')
  }

  // ── like: sensei (100 лайков на картах владельца), popular (500) ─────────
  if (type === 'like') {
    const { data: userCards, error: cardsErr } = await supabase
      .from('cards')
      .select('id')
      .eq('user_id', userId)

    if (cardsErr) { console.error('[badges] like cards error:', cardsErr); return }

    const cardIds = (userCards ?? []).map((c: { id: string }) => c.id)
    if (cardIds.length === 0) return

    const { count, error: likesErr } = await supabase
      .from('likes')
      .select('id', { count: 'exact', head: true })
      .in('card_id', cardIds)

    if (likesErr) { console.error('[badges] like count error:', likesErr); return }
    const n = count ?? 0

    if (n >= 100 && await awardIfNew(userId, 'sensei'))  toast.success('🏆 Значок «Сенсей» получен!')
    if (n >= 500 && await awardIfNew(userId, 'popular')) toast.success('🏆 Значок «Популярный» получен!')
  }

  // ── comment: critic (50), wordsmith (100) ────────────────────────────────
  if (type === 'comment') {
    const { count, error } = await supabase
      .from('comments')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', userId)

    if (error) { console.error('[badges] comment count error:', error); return }
    const n = count ?? 0

    if (n >= 50  && await awardIfNew(userId, 'critic'))    toast.success('🏆 Значок «Критик» получен!')
    if (n >= 100 && await awardIfNew(userId, 'wordsmith')) toast.success('🏆 Значок «Словоплёт» получен!')
  }

  // ── follow_received: social (10 подписчиков), influencer (50) ────────────
  if (type === 'follow_received') {
    const { count, error } = await supabase
      .from('follows')
      .select('id', { count: 'exact', head: true })
      .eq('following_id', userId)

    if (error) { console.error('[badges] follow_received count error:', error); return }
    const n = count ?? 0

    if (n >= 10 && await awardIfNew(userId, 'social'))      toast.success('🏆 Значок «Общительный» получен!')
    if (n >= 50 && await awardIfNew(userId, 'influencer'))  toast.success('🏆 Значок «Инфлюенсер» получен!')
  }

  // ── fan: поставил 50 лайков ──────────────────────────────────────────────
  if (type === 'fan') {
    const { count, error } = await supabase
      .from('likes')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', userId)

    if (error) { console.error('[badges] fan count error:', error); return }
    const n = count ?? 0

    if (n >= 50 && await awardIfNew(userId, 'fan')) toast.success('🏆 Значок «Фанат» получен!')
  }

  // ── collector: добавил 20 в избранное ────────────────────────────────────
  if (type === 'collector') {
    const { count, error } = await supabase
      .from('favorites')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', userId)

    if (error) { console.error('[badges] collector count error:', error); return }
    const n = count ?? 0

    if (n >= 20 && await awardIfNew(userId, 'collector')) toast.success('🏆 Значок «Коллекционер» получен!')
  }
}
