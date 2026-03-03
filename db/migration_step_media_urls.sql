-- Добавляем поддержку нескольких фото к шагу
ALTER TABLE steps ADD COLUMN IF NOT EXISTS media_urls text[] DEFAULT '{}';

-- Переносим существующие media_url в media_urls
UPDATE steps
SET media_urls = ARRAY[media_url]
WHERE media_url IS NOT NULL AND (media_urls IS NULL OR array_length(media_urls, 1) IS NULL);
