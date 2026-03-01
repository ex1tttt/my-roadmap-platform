-- ═══════════════════════════════════════════════════════════════════
-- Fix: добавить ON DELETE CASCADE / SET NULL ко всем таблицам,
--      ссылающимся на cards(id), чтобы карточку можно было удалить.
--
-- Выполнить в: Supabase → SQL Editor → Run
-- ═══════════════════════════════════════════════════════════════════


-- ───────────────────────────────────────────────────────────────────
-- ШАГ 0: ДИАГНОСТИКА — все FK на cards(id) и их правило удаления
-- Запусти сначала, чтобы увидеть какие таблицы блокируют удаление
-- ───────────────────────────────────────────────────────────────────
SELECT
  tc.table_name,
  kcu.column_name,
  tc.constraint_name,
  rc.delete_rule
FROM information_schema.table_constraints tc
JOIN information_schema.key_column_usage kcu
  ON tc.constraint_name = kcu.constraint_name
JOIN information_schema.referential_constraints rc
  ON tc.constraint_name = rc.constraint_name
JOIN information_schema.key_column_usage kcu2
  ON rc.unique_constraint_name = kcu2.constraint_name
WHERE tc.constraint_type = 'FOREIGN KEY'
  AND kcu2.table_name = 'cards'
  AND kcu2.column_name = 'id'
ORDER BY tc.table_name;


-- ───────────────────────────────────────────────────────────────────
-- ШАГ 1: notifications.card_id → ON DELETE SET NULL
--         (уведомление сохраняется, card_id обнуляется)
-- ───────────────────────────────────────────────────────────────────
DO $$
DECLARE r RECORD;
BEGIN
  FOR r IN
    SELECT tc.constraint_name
    FROM information_schema.table_constraints tc
    JOIN information_schema.key_column_usage kcu
      ON tc.constraint_name = kcu.constraint_name
    WHERE tc.table_name = 'notifications'
      AND tc.constraint_type = 'FOREIGN KEY'
      AND kcu.column_name = 'card_id'
  LOOP
    EXECUTE 'ALTER TABLE notifications DROP CONSTRAINT ' || quote_ident(r.constraint_name);
  END LOOP;
END $$;

ALTER TABLE notifications
  ALTER COLUMN card_id DROP NOT NULL;

ALTER TABLE notifications
  ADD CONSTRAINT notifications_card_id_fkey
  FOREIGN KEY (card_id) REFERENCES cards(id) ON DELETE SET NULL;


-- ───────────────────────────────────────────────────────────────────
-- ШАГ 2: card_shared_access.card_id → ON DELETE CASCADE
--         (запись доступа удаляется вместе с карточкой)
-- ───────────────────────────────────────────────────────────────────
DO $$
DECLARE r RECORD;
BEGIN
  FOR r IN
    SELECT tc.constraint_name
    FROM information_schema.table_constraints tc
    JOIN information_schema.key_column_usage kcu
      ON tc.constraint_name = kcu.constraint_name
    WHERE tc.table_name = 'card_shared_access'
      AND tc.constraint_type = 'FOREIGN KEY'
      AND kcu.column_name = 'card_id'
  LOOP
    EXECUTE 'ALTER TABLE card_shared_access DROP CONSTRAINT ' || quote_ident(r.constraint_name);
  END LOOP;
END $$;

ALTER TABLE card_shared_access
  ADD CONSTRAINT card_shared_access_card_id_fkey
  FOREIGN KEY (card_id) REFERENCES cards(id) ON DELETE CASCADE;


-- ───────────────────────────────────────────────────────────────────
-- ШАГ 3: view_history.card_id → ON DELETE CASCADE  ← ЕДИНСТВЕННАЯ ПРОБЛЕМА
--         (история просмотра удаляется вместе с карточкой)
-- ───────────────────────────────────────────────────────────────────
ALTER TABLE view_history
  DROP CONSTRAINT IF EXISTS view_history_card_id_fkey;

ALTER TABLE view_history
  ADD CONSTRAINT view_history_card_id_fkey
  FOREIGN KEY (card_id) REFERENCES cards(id) ON DELETE CASCADE;
