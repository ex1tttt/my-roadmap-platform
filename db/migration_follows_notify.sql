-- Добавляем колонку "уведомлять о новых карточках" в таблицу подписок
ALTER TABLE follows
  ADD COLUMN IF NOT EXISTS notify_new_cards BOOLEAN NOT NULL DEFAULT FALSE;
