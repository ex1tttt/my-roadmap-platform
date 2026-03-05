-- Таблица жалоб на карточки
CREATE TABLE IF NOT EXISTS card_reports (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  card_id uuid NOT NULL REFERENCES cards(id) ON DELETE CASCADE,
  reporter_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  reason text NOT NULL CHECK (reason IN ('spam', 'inappropriate', 'misinformation', 'copyright', 'other')),
  description text,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'reviewed', 'resolved')),
  created_at timestamptz NOT NULL DEFAULT now(),
  -- Один пользователь может пожаловаться на одну карточку только один раз
  UNIQUE(card_id, reporter_id)
);

-- Включаем RLS
ALTER TABLE card_reports ENABLE ROW LEVEL SECURITY;

-- Авторизованные пользователи могут создавать жалобы (только от своего имени)
DROP POLICY IF EXISTS "authenticated users can insert card reports" ON card_reports;
CREATE POLICY "authenticated users can insert card reports"
  ON card_reports FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = reporter_id);

-- Пользователи могут видеть только свои жалобы
DROP POLICY IF EXISTS "users can view own card reports" ON card_reports;
CREATE POLICY "users can view own card reports"
  ON card_reports FOR SELECT
  TO authenticated
  USING (auth.uid() = reporter_id);

-- Индекс для быстрой выборки жалоб по карточке
CREATE INDEX IF NOT EXISTS idx_card_reports_card_id ON card_reports(card_id);

-- Индекс для быстрой выборки жалоб по статусу (для admin-панели)
CREATE INDEX IF NOT EXISTS idx_card_reports_status ON card_reports(status);
