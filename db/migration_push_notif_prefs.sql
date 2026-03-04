-- Добавляем колонку push_notif_prefs в таблицу profiles
-- Хранит настройки типов push-уведомлений для каждого пользователя
ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS push_notif_prefs jsonb
  DEFAULT '{"like":true,"comment":true,"comment_like":true,"follow":true,"mention":true,"new_card":true}'::jsonb;
