alter table gantt_tasks enable row level security;

drop policy if exists "gantt_tasks_select_by_card_access" on gantt_tasks;
create policy "gantt_tasks_select_by_card_access"
  on gantt_tasks
  for select
  using (
    exists (
      select 1
      from cards c
      where c.id = gantt_tasks.card_id
        and (
          c.is_private = false
          or c.user_id = auth.uid()
          or exists (
            select 1
            from card_collaborators cc
            where cc.card_id = c.id
              and cc.user_email = auth.email()
          )
        )
    )
  );
