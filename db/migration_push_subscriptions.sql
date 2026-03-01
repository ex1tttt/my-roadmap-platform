-- Таблица Push-подписок пользователей
CREATE TABLE IF NOT EXISTS user_subscriptions (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  endpoint    TEXT NOT NULL,
  p256dh      TEXT NOT NULL,
  auth        TEXT NOT NULL,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),

  -- Один пользователь может иметь несколько устройств,
  -- но endpoint у каждого устройства уникален
  UNIQUE (user_id, endpoint)
);

-- Индекс для быстрой выборки по user_id (при отправке уведомлений)
CREATE INDEX IF NOT EXISTS idx_user_subscriptions_user_id
  ON user_subscriptions (user_id);

-- RLS: читать и удалять может только владелец строки
ALTER TABLE user_subscriptions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Владелец читает свои подписки"
  ON user_subscriptions FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Владелец добавляет подписки"
  ON user_subscriptions FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Владелец удаляет свои подписки"
  ON user_subscriptions FOR DELETE
  USING (auth.uid() = user_id);

-- Серверный роут (service_role) должен уметь читать все подписки для рассылки:
-- Выдайте service_role обход RLS через SECURITY DEFINER функцию или
-- отдельную политику для service_role при необходимости.
