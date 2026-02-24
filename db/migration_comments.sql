-- Migration: create comments table
create table if not exists comments (
  id          uuid primary key default gen_random_uuid(),
  roadmap_id  uuid not null references cards(id) on delete cascade,
  user_id     uuid not null references auth.users(id) on delete cascade,
  text        text not null,
  created_at  timestamptz not null default now()
);

-- Index for fast lookup by roadmap
create index if not exists comments_roadmap_id_idx on comments(roadmap_id);

-- RLS
alter table comments enable row level security;

-- Anyone can read comments
create policy "comments_select" on comments
  for select using (true);

-- Authenticated users can insert their own comments
create policy "comments_insert" on comments
  for insert with check (auth.uid() = user_id);

-- Users can delete only their own comments
create policy "comments_delete" on comments
  for delete using (auth.uid() = user_id);
