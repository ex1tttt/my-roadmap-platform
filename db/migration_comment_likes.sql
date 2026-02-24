-- Таблица лайков к комментариям
create table if not exists comment_likes (
  comment_id uuid references comments(id) on delete cascade not null,
  user_id    uuid not null,
  created_at timestamptz default now(),
  primary key (comment_id, user_id)
);

-- RLS
alter table comment_likes enable row level security;

create policy "Anyone can read comment likes"
  on comment_likes for select using (true);

create policy "Authenticated users can insert own likes"
  on comment_likes for insert
  with check (auth.uid() = user_id);

create policy "Users can delete own likes"
  on comment_likes for delete
  using (auth.uid() = user_id);
