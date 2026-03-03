-- 1. Исправляем RLS: позволяем заблокированному пользователю видеть свою блокировку
--    чтобы страницы профиля и карточек могли проверить, заблокирован ли текущий пользователь
DROP POLICY IF EXISTS "user_blocks_select" ON user_blocks;

CREATE POLICY "user_blocks_select" ON user_blocks
  FOR SELECT USING (
    auth.uid() = blocker_id   -- сам заблокировавший видит свои блокировки
    OR
    auth.uid() = blocked_id   -- заблокированный видит, что его заблокировали
  );

-- 2. Триггер: при блокировке пользователя автоматически удаляем подписки в обе стороны
CREATE OR REPLACE FUNCTION delete_follows_on_block()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  -- Удаляем подписку blocker → blocked
  DELETE FROM follows
  WHERE follower_id = NEW.blocker_id AND following_id = NEW.blocked_id;

  -- Удаляем подписку blocked → blocker
  DELETE FROM follows
  WHERE follower_id = NEW.blocked_id AND following_id = NEW.blocker_id;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_delete_follows_on_block ON user_blocks;

CREATE TRIGGER trg_delete_follows_on_block
  AFTER INSERT ON user_blocks
  FOR EACH ROW EXECUTE FUNCTION delete_follows_on_block();
