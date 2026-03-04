-- Добавляем колонку image_url в support_messages
ALTER TABLE support_messages ADD COLUMN IF NOT EXISTS image_url TEXT;

-- Создаём / делаем публичным bucket support-images
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'support-images',
  'support-images',
  true,
  5242880,   -- 5 MB
  ARRAY['image/jpeg','image/png','image/gif','image/webp','image/svg+xml']
)
ON CONFLICT (id) DO UPDATE SET public = true;

-- Удаляем старые политики (если были)
DROP POLICY IF EXISTS "support-images public read" ON storage.objects;
DROP POLICY IF EXISTS "support-images allow upload" ON storage.objects;
DROP POLICY IF EXISTS "support-images allow delete" ON storage.objects;

-- Публичное чтение (SELECT) — доступно всем
CREATE POLICY "support-images public read"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'support-images');

-- Загрузка (INSERT) — доступна всем (авторизованным и гостям)
CREATE POLICY "support-images allow upload"
  ON storage.objects FOR INSERT
  WITH CHECK (bucket_id = 'support-images');

-- Удаление (DELETE) — доступно только авторизованным
CREATE POLICY "support-images allow delete"
  ON storage.objects FOR DELETE
  USING (bucket_id = 'support-images' AND auth.role() = 'authenticated');
