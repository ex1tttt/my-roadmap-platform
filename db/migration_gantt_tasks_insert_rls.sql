-- Allow owner/editor to insert gantt tasks (edit page saves via delete + insert)
drop policy if exists "gantt_tasks_insert_by_owner_or_editor" on gantt_tasks;
create policy "gantt_tasks_insert_by_owner_or_editor"
  on gantt_tasks
  for insert
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
