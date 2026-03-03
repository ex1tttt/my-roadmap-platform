-- Migration: fix notifications RLS to allow inserting mention notifications for other users
-- and ensure 'mention' type is in the check constraint

-- 1. Обновляем CHECK constraint (добавляем 'mention' если ещё нет)
ALTER TABLE notifications
  DROP CONSTRAINT IF EXISTS notifications_type_check;

ALTER TABLE notifications
  ADD CONSTRAINT notifications_type_check
    CHECK (type IN ('follow', 'like', 'comment', 'comment_like', 'new_card', 'mention'));

-- 2. Смотрим текущие RLS политики (для справки)
-- SELECT policyname, cmd, qual, with_check FROM pg_policies WHERE tablename = 'notifications';

-- 3. Добавляем политику INSERT для упоминаний:
--    авторизованный пользователь может вставить уведомление типа 'mention',
--    где actor_id = его собственный id (он сам кого-то упомянул)
DROP POLICY IF EXISTS "allow_insert_mention_notifications" ON notifications;

CREATE POLICY "allow_insert_mention_notifications"
  ON notifications
  FOR INSERT
  TO authenticated
  WITH CHECK (
    type = 'mention'
    AND actor_id = auth.uid()
    AND actor_id <> receiver_id
  );
