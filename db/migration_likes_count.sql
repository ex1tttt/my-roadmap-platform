-- ═══════════════════════════════════════════════════════════════════
-- Migration: добавить счётчик лайков для карточек
-- Выполнить в: Supabase → SQL Editor → Run
-- ═══════════════════════════════════════════════════════════════════

-- 1. Колонка likes_count в таблице cards
ALTER TABLE cards
  ADD COLUMN IF NOT EXISTS likes_count INTEGER NOT NULL DEFAULT 0;

-- 2. Триггер для инкремента при добавлении лайка
CREATE OR REPLACE FUNCTION on_like_insert()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE cards
  SET likes_count = likes_count + 1
  WHERE id = NEW.card_id;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_like_insert_trigger ON likes;
CREATE TRIGGER on_like_insert_trigger
AFTER INSERT ON likes
FOR EACH ROW
EXECUTE FUNCTION on_like_insert();

-- 3. Триггер для декремента при удалении лайка
CREATE OR REPLACE FUNCTION on_like_delete()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE cards
  SET likes_count = likes_count - 1
  WHERE id = OLD.card_id;
  RETURN OLD;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_like_delete_trigger ON likes;
CREATE TRIGGER on_like_delete_trigger
AFTER DELETE ON likes
FOR EACH ROW
EXECUTE FUNCTION on_like_delete();

-- 4. Пересчет существующих лайков (одноразово)
UPDATE cards c
SET likes_count = (
  SELECT COUNT(*) FROM likes WHERE card_id = c.id
)
WHERE likes_count = 0;
