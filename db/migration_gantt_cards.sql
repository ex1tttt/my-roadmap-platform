alter table cards
  add column if not exists card_type text not null default 'list'
  check (card_type in ('list', 'gantt'));

create table if not exists gantt_tasks (
  id uuid primary key default gen_random_uuid(),
  card_id uuid not null references cards(id) on delete cascade,
  "order" integer not null,
  title text not null,
  description text,
  start_date date,
  end_date date,
  priority text not null default 'medium' check (priority in ('low', 'medium', 'high')),
  assignee text
);

create index if not exists idx_gantt_tasks_card_id on gantt_tasks(card_id);
create index if not exists idx_gantt_tasks_order on gantt_tasks(card_id, "order");
