-- Migration: create user_badges table
create table if not exists user_badges (
  user_id    uuid not null references auth.users(id) on delete cascade,
  badge_id   text not null,                        -- 'pioneer' | 'sensei' | 'critic'
  awarded_at timestamptz not null default now(),
  primary key (user_id, badge_id)
);

-- Index for fast lookup by user
create index if not exists user_badges_user_id_idx on user_badges(user_id);

-- RLS
alter table user_badges enable row level security;

-- Anyone can read badges (needed for ProfileBadges component)
drop policy if exists "user_badges_select" on user_badges;
create policy "user_badges_select" on user_badges
  for select using (true);

-- Only the owner can insert their own badges
drop policy if exists "user_badges_insert" on user_badges;
create policy "user_badges_insert" on user_badges
  for insert with check (auth.uid() = user_id);
