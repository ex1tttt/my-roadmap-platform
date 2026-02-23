-- =============================================================
-- МИГРАЦИЯ: Привязать profiles.id к auth.users.id
-- Запустить в Supabase SQL Editor (Project → SQL Editor → New query)
-- =============================================================

-- ШАГ 1: Убедимся, что у всех существующих профилей id совпадает с auth.users.id
-- Если таблица profiles только что создана и пустая — этот шаг можно пропустить.
-- Если данные есть — сначала выполните ШАГ 1, проверьте результат, затем ШАГ 2.

-- Показать профили, у которых id НЕ совпадает ни с одним auth.users.id (должно быть 0 строк):
-- SELECT p.id, p.username FROM profiles p
-- LEFT JOIN auth.users u ON u.id = p.id
-- WHERE u.id IS NULL;


-- ШАГ 2: Пересоздать таблицу profiles с правильным FK на auth.users
-- ВНИМАНИЕ: Если таблица не пустая, сначала убедитесь что все id совпадают (ШАГ 1).

-- 2а. Временно убрать FK из cards → profiles
ALTER TABLE cards DROP CONSTRAINT IF EXISTS cards_user_id_fkey;

-- 2б. Убрать старый PK (и default) из profiles
ALTER TABLE profiles
  ALTER COLUMN id DROP DEFAULT,
  DROP CONSTRAINT IF EXISTS profiles_pkey;

-- 2в. Добавить новый PK с FK на auth.users
ALTER TABLE profiles ADD PRIMARY KEY (id);
ALTER TABLE profiles
  ADD CONSTRAINT profiles_id_fkey
  FOREIGN KEY (id) REFERENCES auth.users(id) ON DELETE CASCADE;

-- 2г. Вернуть FK из cards → profiles
ALTER TABLE cards
  ADD CONSTRAINT cards_user_id_fkey
  FOREIGN KEY (user_id) REFERENCES profiles(id) ON DELETE CASCADE;


-- ШАГ 3: RLS-политики (если ещё не настроены)

-- Profiles
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY IF NOT EXISTS "Public profiles are viewable by everyone"
  ON profiles FOR SELECT USING (true);

CREATE POLICY IF NOT EXISTS "Users can insert own profile"
  ON profiles FOR INSERT WITH CHECK (auth.uid() = id);

CREATE POLICY IF NOT EXISTS "Users can update own profile"
  ON profiles FOR UPDATE USING (auth.uid() = id);

-- Likes
ALTER TABLE likes ENABLE ROW LEVEL SECURITY;

CREATE POLICY IF NOT EXISTS "Users can manage own likes"
  ON likes FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY IF NOT EXISTS "Likes are viewable by everyone"
  ON likes FOR SELECT USING (true);

-- Favorites
ALTER TABLE favorites ENABLE ROW LEVEL SECURITY;

CREATE POLICY IF NOT EXISTS "Users can manage own favorites"
  ON favorites FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);


-- ШАГ 4: Убедиться, что PostgREST видит связь (перезагрузить схему)
NOTIFY pgrst, 'reload schema';
