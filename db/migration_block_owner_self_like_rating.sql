-- Автор карточки не может ставить лайк своей карточке и оценивать её (RLS).
-- Выполните в Supabase → SQL Editor после проверки имён политик (если переименовывали — подправьте DROP).

-- ─── LIKES ─────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "Users can manage own likes" ON public.likes;

CREATE POLICY "likes_insert_not_own_card" ON public.likes
  FOR INSERT WITH CHECK (
    auth.uid() = user_id
    AND NOT EXISTS (
      SELECT 1 FROM public.cards c
      WHERE c.id = card_id AND c.user_id = auth.uid()
    )
  );

CREATE POLICY "likes_delete_own" ON public.likes
  FOR DELETE USING (auth.uid() = user_id);

-- ─── RATINGS ───────────────────────────────────────────────────────
DROP POLICY IF EXISTS "ratings_insert" ON public.ratings;
DROP POLICY IF EXISTS "ratings_update" ON public.ratings;
DROP POLICY IF EXISTS "ratings_delete" ON public.ratings;

CREATE POLICY "ratings_insert" ON public.ratings
  FOR INSERT WITH CHECK (
    auth.uid() = user_id
    AND NOT EXISTS (
      SELECT 1 FROM public.cards c
      WHERE c.id = roadmap_id AND c.user_id = auth.uid()
    )
  );

CREATE POLICY "ratings_update" ON public.ratings
  FOR UPDATE USING (auth.uid() = user_id)
  WITH CHECK (
    auth.uid() = user_id
    AND NOT EXISTS (
      SELECT 1 FROM public.cards c
      WHERE c.id = roadmap_id AND c.user_id = auth.uid()
    )
  );

CREATE POLICY "ratings_delete" ON public.ratings
  FOR DELETE USING (auth.uid() = user_id);
