-- Tree branches: multiple successors from one step (siblings share parent_id).
alter table gantt_tasks
  add column if not exists parent_id uuid;

-- FK after column exists (existing rows: parent_id null).
alter table gantt_tasks
  drop constraint if exists gantt_tasks_parent_id_fkey;

alter table gantt_tasks
  add constraint gantt_tasks_parent_id_fkey
  foreign key (parent_id) references gantt_tasks (id) on delete cascade;

create index if not exists idx_gantt_tasks_parent on gantt_tasks (card_id, parent_id);
