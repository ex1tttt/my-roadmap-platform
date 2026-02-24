-- Migration: create ratings table
create table if not exists ratings (
  id         uuid primary key default gen_random_uuid(),
  roadmap_id uuid not null references cards(id) on delete cascade,
  user_id    uuid not null references auth.users(id) on delete cascade,
  rate       smallint not null check (rate between 1 and 5),
  created_at timestamptz not null default now(),
  unique(roadmap_id, user_id)
);

create index if not exists ratings_roadmap_id_idx on ratings(roadmap_id);

alter table ratings enable row level security;

-- Anyone can read ratings
create policy "ratings_select" on ratings
  for select using (true);

-- Authenticated users can insert their own rating
create policy "ratings_insert" on ratings
  for insert with check (auth.uid() = user_id);

-- Users can update only their own rating
create policy "ratings_update" on ratings
  for update using (auth.uid() = user_id);
