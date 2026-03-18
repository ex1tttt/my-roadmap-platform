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
    if (error.code === '23505') return false;
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

    if (error) { return }
    const n = count ?? 0

    if (n >= 1 && await awardIfNew(userId, 'pioneer'))  toast.success('🏆 Значок «Первопроходец» получен!')
    if (n >= 5) {
      if (await awardIfNew(userId, 'creator')) toast.success('🏆 Значок «Картограф» получен!')
    }
    if (n >= 10 && await awardIfNew(userId, 'explorer')) toast.success('🏆 Значок «Исследователь» получен!')
  }

  // ── like: sensei (100 лайков на картах владельца), popular (500) ─────────
  if (type === 'like') {
    const { data: userCards, error: cardsErr } = await supabase
      .from('cards')
      .select('id')
      .eq('user_id', userId)

    if (cardsErr) { return }

    const cardIds = (userCards ?? []).map((c: { id: string }) => c.id)
    if (cardIds.length === 0) return

    const { count, error: likesErr } = await supabase
      .from('likes')
      .select('id', { count: 'exact', head: true })
      .in('card_id', cardIds)

    if (likesErr) { return }
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

    if (error) { return }
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

    if (error) { return }
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

    if (error) { return }
    const n = count ?? 0

    if (n >= 50 && await awardIfNew(userId, 'fan')) toast.success('🏆 Значок «Фанат» получен!')
  }

  // ── collector: добавил 20 в избранное ────────────────────────────────────
  if (type === 'collector') {
    const { count, error } = await supabase
      .from('favorites')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', userId)

    if (error) { return }
    const n = count ?? 0

    if (n >= 20 && await awardIfNew(userId, 'collector')) toast.success('🏆 Значок «Коллекционер» получен!')
  }
}

/** Проверяет и отзывает достижения, если условие больше не выполняется */
export async function checkAndRevokeBadges(userId: string): Promise<void> {
  // 1. Карточки: pioneer (1), creator (5), explorer (10)
  const { count: cardCount } = await supabase
    .from('cards')
    .select('id', { count: 'exact', head: true })
    .eq('user_id', userId);

  if ((cardCount ?? 0) < 1) {
    await supabase.from('user_badges').delete().eq('user_id', userId).eq('badge_id', 'pioneer');
  }
  if ((cardCount ?? 0) < 5) {
    await supabase.from('user_badges').delete().eq('user_id', userId).eq('badge_id', 'creator');
  }
  if ((cardCount ?? 0) < 10) {
    await supabase.from('user_badges').delete().eq('user_id', userId).eq('badge_id', 'explorer');
  }

  // 2. Лайки на своих карточках: sensei (100), popular (500)
  const { data: userCards } = await supabase
    .from('cards')
    .select('id')
    .eq('user_id', userId);
  const cardIds = (userCards ?? []).map((c: { id: string }) => c.id);
  let likeCount = 0;
  if (cardIds.length > 0) {
    const { count: likes } = await supabase
      .from('likes')
      .select('id', { count: 'exact', head: true })
      .in('card_id', cardIds);
    likeCount = likes ?? 0;
  }
  if (likeCount < 100) {
    await supabase.from('user_badges').delete().eq('user_id', userId).eq('badge_id', 'sensei');
  }
  if (likeCount < 500) {
    await supabase.from('user_badges').delete().eq('user_id', userId).eq('badge_id', 'popular');
  }

  // 3. Комментарии: critic (50), wordsmith (100)
  const { count: commentCount } = await supabase
    .from('comments')
    .select('id', { count: 'exact', head: true })
    .eq('user_id', userId);
  if ((commentCount ?? 0) < 50) {
    await supabase.from('user_badges').delete().eq('user_id', userId).eq('badge_id', 'critic');
  }
  if ((commentCount ?? 0) < 100) {
    await supabase.from('user_badges').delete().eq('user_id', userId).eq('badge_id', 'wordsmith');
  }

  // 4. Подписчики: social (10), influencer (50)
  const { count: followersCount } = await supabase
    .from('follows')
    .select('id', { count: 'exact', head: true })
    .eq('following_id', userId);
  if ((followersCount ?? 0) < 10) {
    await supabase.from('user_badges').delete().eq('user_id', userId).eq('badge_id', 'social');
  }
  if ((followersCount ?? 0) < 50) {
    await supabase.from('user_badges').delete().eq('user_id', userId).eq('badge_id', 'influencer');
  }

  // 5. Поставил 50 лайков: fan
  const { count: fanCount } = await supabase
    .from('likes')
    .select('id', { count: 'exact', head: true })
    .eq('user_id', userId);
  if ((fanCount ?? 0) < 50) {
    await supabase.from('user_badges').delete().eq('user_id', userId).eq('badge_id', 'fan');
  }

  // 6. Добавил 20 в избранное: collector
  const { count: favCount } = await supabase
    .from('favorites')
    .select('id', { count: 'exact', head: true })
    .eq('user_id', userId);
  if ((favCount ?? 0) < 20) {
    await supabase.from('user_badges').delete().eq('user_id', userId).eq('badge_id', 'collector');
  }
}

/** Обнуляет ВСЕ достижения пользователя и пересчитывает их с нуля */
export async function recalculateAllBadges(userId: string): Promise<void> {
  // Удаляем все текущие достижения
  const { error: deleteError } = await supabase
    .from('user_badges')
    .delete()
    .eq('user_id', userId)

  if (deleteError) {
    return
  }

  // Пересчитываем все типы достижений
  await checkAndAwardBadges(userId, 'first_card')
  await checkAndAwardBadges(userId, 'like')
  await checkAndAwardBadges(userId, 'comment')
  await checkAndAwardBadges(userId, 'follow_received')
  await checkAndAwardBadges(userId, 'fan')
  await checkAndAwardBadges(userId, 'collector')
}
