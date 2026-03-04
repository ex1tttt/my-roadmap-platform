-- ══════════════════════════════════════════════════
-- Чат технической поддержки
-- Выполнить в: Supabase → SQL Editor → Run
-- ══════════════════════════════════════════════════

create table if not exists support_messages (
  id            uuid primary key default gen_random_uuid(),
  session_id    uuid not null,
  user_id       uuid references profiles(id) on delete set null,
  username      text,
  content       text not null,
  is_from_support boolean not null default false,
  created_at    timestamptz not null default now()
);

-- Индексы для быстрой выборки по сессии
create index if not exists support_messages_session_idx on support_messages(session_id);
create index if not exists support_messages_created_idx on support_messages(created_at desc);

-- RLS
alter table support_messages enable row level security;

-- Все могут читать сообщения по session_id (UUID является достаточным секретом)
create policy "read by session"
  on support_messages for select
  using (true);

-- Пользователи могут вставлять только свои сообщения (не от поддержки)
create policy "insert as user"
  on support_messages for insert
  with check (is_from_support = false);

-- realtime
alter publication supabase_realtime add table support_messages;
