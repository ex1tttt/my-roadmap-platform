-- Добавить колонку last_seen в profiles
-- Выполнить в: Supabase → SQL Editor → Run

alter table profiles
  add column if not exists last_seen timestamptz default now();
