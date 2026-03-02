-- Разрешаем анонимным пользователям (и ботам, например Telegram) читать публичные карточки.
-- Это нужно для корректного OG-превью ссылок.

-- Включаем RLS на cards, если ещё не включён
alter table cards enable row level security;

-- Политика: все могут читать публичные карточки
create policy "cards_public_select"
  on cards
  for select
  using (is_private = false or is_private is null);

-- Политика: владелец может видеть свои приватные карточки
create policy "cards_owner_select_private"
  on cards
  for select
  using (auth.uid() = user_id);

-- Политика: владелец может вставлять карточки
create policy "cards_insert"
  on cards
  for insert
  with check (auth.uid() = user_id);

-- Политика: владелец может изменять свои карточки
create policy "cards_update"
  on cards
  for update
  using (auth.uid() = user_id);

-- Политика: владелец может удалять свои карточки
create policy "cards_delete"
  on cards
  for delete
  using (auth.uid() = user_id);
