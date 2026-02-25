-- =============================================================
-- МИГРАЦИЯ: Таблица user_progress (прогресс шагов дорожной карты)
-- Запустить в Supabase SQL Editor → New query
-- =============================================================

create table if not exists user_progress (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references auth.users(id) on delete cascade,
  card_id    uuid not null references cards(id) on delete cascade,
  step_id    uuid not null references steps(id) on delete cascade,
  created_at timestamptz not null default now(),
  unique(user_id, step_id)
);

-- Индексы для быстрой выборки по пользователю + карточке
create index if not exists user_progress_user_card_idx on user_progress(user_id, card_id);

-- RLS
alter table user_progress enable row level security;

create policy "Users can view own progress"
  on user_progress for select
  using (auth.uid() = user_id);

create policy "Users can insert own progress"
  on user_progress for insert
  with check (auth.uid() = user_id);

create policy "Users can delete own progress"
  on user_progress for delete
  using (auth.uid() = user_id);
