-- Добавляем колонку notify_enabled в таблицу follows
-- По умолчанию false — уведомления выключены

ALTER TABLE follows
  ADD COLUMN IF NOT EXISTS notify_enabled BOOLEAN NOT NULL DEFAULT false;

-- Комментарий для документации
COMMENT ON COLUMN follows.notify_enabled IS 'Получать push/realtime-уведомления о событиях автора';
