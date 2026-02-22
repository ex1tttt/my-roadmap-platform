-- Supabase schema for Roadmaps platform
-- Enables UUID generation and creates required tables
create extension if not exists "pgcrypto";

-- Profiles table
create table if not exists profiles (
  id uuid primary key default gen_random_uuid(),
  username text not null unique,
  avatar text
);

-- Cards (roadmaps)
create table if not exists cards (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references profiles(id) on delete cascade,
  title text not null,
  category text,
  description text
);

-- Steps for each card
create table if not exists steps (
  id uuid primary key default gen_random_uuid(),
  card_id uuid not null references cards(id) on delete cascade,
  "order" integer not null,
  title text not null,
  content text,
  media_url text
);

-- Resources related to a card
create table if not exists resources (
  id uuid primary key default gen_random_uuid(),
  card_id uuid not null references cards(id) on delete cascade,
  label text,
  url text
);

-- Likes for cards
create table if not exists likes (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references auth.users on delete cascade not null,
  card_id uuid references cards(id) on delete cascade not null,
  unique(user_id, card_id)
);
