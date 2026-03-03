-- Таблица блокировок пользователей
CREATE TABLE IF NOT EXISTS user_blocks (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  blocker_id  uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  blocked_id  uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at  timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT no_self_block CHECK (blocker_id <> blocked_id),
  CONSTRAINT unique_block UNIQUE (blocker_id, blocked_id)
);

CREATE INDEX IF NOT EXISTS user_blocks_blocker_idx ON user_blocks(blocker_id);
CREATE INDEX IF NOT EXISTS user_blocks_blocked_idx ON user_blocks(blocked_id);

-- RLS
ALTER TABLE user_blocks ENABLE ROW LEVEL SECURITY;

-- Пользователь видит только свои блокировки
CREATE POLICY "user_blocks_select" ON user_blocks
  FOR SELECT USING (auth.uid() = blocker_id);

-- Только сам пользователь может добавлять блокировки
CREATE POLICY "user_blocks_insert" ON user_blocks
  FOR INSERT WITH CHECK (auth.uid() = blocker_id);

-- Только сам пользователь может удалять свои блокировки
CREATE POLICY "user_blocks_delete" ON user_blocks
  FOR DELETE USING (auth.uid() = blocker_id);
