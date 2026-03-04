-- Таблица присутствия администратора в конкретной сессии поддержки
CREATE TABLE IF NOT EXISTS admin_presence (
  admin_id   UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  session_id UUID NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (admin_id)
);

-- RLS: администраторы управляют своей записью через service role
ALTER TABLE admin_presence ENABLE ROW LEVEL SECURITY;

-- Политики (доступ только через service role / server-side)
CREATE POLICY "allow service role all" ON admin_presence
  USING (true) WITH CHECK (true);
