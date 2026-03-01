-- Добавляем колонку notify_new_cards в таблицу follows
-- По умолчанию false — уведомления о новых карточках выключены

ALTER TABLE follows
  ADD COLUMN IF NOT EXISTS notify_new_cards BOOLEAN NOT NULL DEFAULT false;

-- Политика UPDATE (если ещё нет)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'follows' AND cmd = 'UPDATE'
  ) THEN
    EXECUTE $policy$
      CREATE POLICY "Пользователь обновляет свою подписку"
        ON follows FOR UPDATE
        USING (auth.uid() = follower_id)
        WITH CHECK (auth.uid() = follower_id)
    $policy$;
  END IF;
END;
$$;
