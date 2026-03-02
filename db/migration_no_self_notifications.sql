-- Migration: prevent self-notifications (actor_id = receiver_id)
-- Гарантируем на уровне БД: пользователь не получает уведомление за свои действия

-- 1. Удаляем уже существующие само-уведомления
DELETE FROM notifications
WHERE actor_id IS NOT NULL AND actor_id = receiver_id;

-- 2. CHECK-ограничение: блокирует INSERT/UPDATE, где actor = receiver
ALTER TABLE notifications
  ADD CONSTRAINT notifications_no_self_notify
  CHECK (actor_id IS NULL OR actor_id <> receiver_id);
