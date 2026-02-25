-- Добавляет колонку language в таблицу profiles
-- Допустимые значения: 'en' | 'uk' | 'pl' | 'ru'
-- Запускать вручную в Supabase SQL Editor

ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS language text NOT NULL DEFAULT 'en';

-- Опционально: ограничение допустимых значений
ALTER TABLE profiles
  ADD CONSTRAINT profiles_language_check
  CHECK (language IN ('en', 'uk', 'pl', 'ru'));
