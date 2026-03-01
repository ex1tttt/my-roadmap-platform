/**
 * lib/badges.ts
 * Утилита для проверки и выдачи значков пользователю.
 *
 * Использование (только в клиентских компонентах / actions):
 *   import { checkAndAwardBadges } from '@/lib/badges'
 *   await checkAndAwardBadges(userId, 'first_card')
 */

import { supabase } from '@/lib/supabase'
import { toast } from 'sonner'

export type BadgeType = 'first_card' | 'like' | 'comment'

/**
 * Проверяет условие выдачи значка и, если оно выполнено,
 * добавляет запись в user_badges.
 * Показывает toast.success только при первом получении значка.
 */
export async function checkAndAwardBadges(userId: string, type: BadgeType): Promise<void> {
  let badgeId: string | null = null
  let qualified = false

  // ── 1. PIONEER — первая карточка ────────────────────────────────────────
  if (type === 'first_card') {
    const { count, error } = await supabase
      .from('cards')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', userId)

    if (error) { console.error('[badges] first_card count error:', error); return }

    // >= 1: карточка уже создана, проверяем что это первая
    qualified = (count ?? 0) >= 1
    badgeId   = 'pioneer'
  }

  // ── 2. SENSEI — 100+ лайков на всех картах пользователя ─────────────────
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

    qualified = (count ?? 0) >= 100
    badgeId   = 'sensei'
  }

  // ── 3. CRITIC — 50+ комментариев от пользователя ────────────────────────
  if (type === 'comment') {
    const { count, error } = await supabase
      .from('comments')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', userId)

    if (error) { console.error('[badges] comment count error:', error); return }

    qualified = (count ?? 0) >= 50
    badgeId   = 'critic'
  }

  if (!qualified || !badgeId) return

  // ── Проверяем: значок уже есть? ─────────────────────────────────────────
  const { data: existing, error: checkErr } = await supabase
    .from('user_badges')
    .select('badge_id')
    .eq('user_id', userId)
    .eq('badge_id', badgeId)
    .maybeSingle()

  if (checkErr) { console.error('[badges] check error:', checkErr); return }

  // Значок уже выдан — ничего не делаем
  if (existing) return

  // ── Вставляем новый значок ───────────────────────────────────────────────
  const { error: insertErr } = await supabase
    .from('user_badges')
    .insert({ user_id: userId, badge_id: badgeId, awarded_at: new Date().toISOString() })

  if (insertErr) {
    // Дубль (race condition) — не показываем ошибку
    if (insertErr.code === '23505') return
    console.error('[badges] insert error:', insertErr)
    return
  }

  toast.success('🏆 Поздравляем! Вы получили новый значок!')
}
