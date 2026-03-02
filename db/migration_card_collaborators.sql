-- Таблица соавторов карточки
create table if not exists card_collaborators (
  id uuid primary key default gen_random_uuid(),
  card_id uuid not null references cards(id) on delete cascade,
  user_email text not null,
  created_at timestamptz default now(),
  unique(card_id, user_email)
);

-- RLS
alter table card_collaborators enable row level security;

-- Читать может любой (сервер проверяет коллабораторов)
create policy "collab_select"
  on card_collaborators for select
  using (true);

-- Добавлять соавторов может только владелец карточки
create policy "collab_insert"
  on card_collaborators for insert
  with check (
    auth.uid() = (select user_id from cards where id = card_id)
  );

-- Удалять соавторов может только владелец карточки
create policy "collab_delete"
  on card_collaborators for delete
  using (
    auth.uid() = (select user_id from cards where id = card_id)
  );

-- Разрешить коллабораторам обновлять карточки
-- (добавляем отдельную политику к уже существующей owner-политике)
create policy "cards_update_by_collaborator"
  on cards for update
  using (
    exists (
      select 1 from card_collaborators
      where card_id = id
        and user_email = auth.email()
    )
  );
