-- Добавляем поле role в card_collaborators
alter table card_collaborators
  add column if not exists role text not null default 'viewer'
  check (role in ('viewer', 'editor'));

-- Владелец может изменять роль соавторов
drop policy if exists "collab_update" on card_collaborators;
create policy "collab_update"
  on card_collaborators for update
  using (
    auth.uid() = (select user_id from cards where id = card_id)
  );
