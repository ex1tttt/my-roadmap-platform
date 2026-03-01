-- =====================================================
-- Таблица: view_history
-- Хранит историю просмотров карточек пользователями
-- =====================================================

CREATE TABLE IF NOT EXISTS public.view_history (
  user_id  UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  card_id  UUID NOT NULL REFERENCES public.cards(id) ON DELETE CASCADE,
  viewed_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, card_id)
);

-- Индекс для быстрой выборки по пользователю + сортировки
CREATE INDEX IF NOT EXISTS idx_view_history_user_viewed
  ON public.view_history (user_id, viewed_at DESC);

-- =====================================================
-- Row Level Security
-- =====================================================

ALTER TABLE public.view_history ENABLE ROW LEVEL SECURITY;

-- SELECT: пользователь видит только свою историю
CREATE POLICY "view_history: select own"
  ON public.view_history
  FOR SELECT
  USING (auth.uid() = user_id);

-- INSERT: пользователь пишет только от своего имени
CREATE POLICY "view_history: insert own"
  ON public.view_history
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- UPDATE: пользователь обновляет только свои записи (для upsert)
CREATE POLICY "view_history: update own"
  ON public.view_history
  FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- DELETE: пользователь удаляет только свои записи (кнопка "Очистить")
CREATE POLICY "view_history: delete own"
  ON public.view_history
  FOR DELETE
  USING (auth.uid() = user_id);
