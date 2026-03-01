-- Добавляем колонку is_pinned в таблицу cards
-- Только владелец профиля может закреплять свои карточки (логика на уровне приложения)

ALTER TABLE cards
  ADD COLUMN IF NOT EXISTS is_pinned BOOLEAN NOT NULL DEFAULT false;

-- Комментарий для документации
COMMENT ON COLUMN cards.is_pinned IS 'Закреплена ли карточка в профиле владельца';
