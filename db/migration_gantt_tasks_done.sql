-- Add global completion flag for gantt tasks
alter table gantt_tasks
  add column if not exists is_done boolean not null default false;

-- Allow owner/editor to update & delete tasks (e.g. mark done)
drop policy if exists "gantt_tasks_update_by_owner_or_editor" on gantt_tasks;
create policy "gantt_tasks_update_by_owner_or_editor"
  on gantt_tasks
  for update
  using (
    exists (
      select 1
      from cards c
      where c.id = gantt_tasks.card_id
        and (
          c.user_id = auth.uid()
          or exists (
            select 1
            from card_collaborators cc
            where cc.card_id = c.id
              and cc.role = 'editor'
              and cc.user_email = auth.email()
          )
        )
    )
  )
  with check (
    exists (
      select 1
      from cards c
      where c.id = gantt_tasks.card_id
        and (
          c.user_id = auth.uid()
          or exists (
            select 1
            from card_collaborators cc
            where cc.card_id = c.id
              and cc.role = 'editor'
              and cc.user_email = auth.email()
          )
        )
    )
  );

drop policy if exists "gantt_tasks_delete_by_owner_or_editor" on gantt_tasks;
create policy "gantt_tasks_delete_by_owner_or_editor"
  on gantt_tasks
  for delete
  using (
    exists (
      select 1
      from cards c
      where c.id = gantt_tasks.card_id
        and (
          c.user_id = auth.uid()
          or exists (
            select 1
            from card_collaborators cc
            where cc.card_id = c.id
              and cc.role = 'editor'
              and cc.user_email = auth.email()
          )
        )
    )
  );
