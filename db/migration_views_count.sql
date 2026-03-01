-- ═══════════════════════════════════════════════════════════════════
-- Migration: добавить счётчик просмотров для карточек
-- Выполнить в: Supabase → SQL Editor → Run
-- ═══════════════════════════════════════════════════════════════════

-- 1. Колонка views_count в таблице cards
ALTER TABLE cards
  ADD COLUMN IF NOT EXISTS views_count INTEGER NOT NULL DEFAULT 0;

-- 2. RPC-функция для атомарного инкремента
CREATE OR REPLACE FUNCTION increment_views(target_card_id UUID)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  UPDATE cards
  SET views_count = views_count + 1
  WHERE id = target_card_id;
END;
$$;
