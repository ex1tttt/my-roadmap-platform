-- Таблица дизлайков комментариев (аналог comment_likes)
create table if not exists comment_dislikes (
  comment_id uuid references comments(id) on delete cascade not null,
  user_id    uuid                                              not null,
  primary key (comment_id, user_id)
);

-- RLS
alter table comment_dislikes enable row level security;

create policy "Любой аутентифицированный может смотреть дизлайки"
  on comment_dislikes for select using (true);

create policy "Пользователь ставит дизлайк сам"
  on comment_dislikes for insert
  with check (auth.uid() = user_id);

create policy "Пользователь убирает свой дизлайк"
  on comment_dislikes for delete
  using (auth.uid() = user_id);

-- Индексы
create index if not exists idx_comment_dislikes_comment_id on comment_dislikes(comment_id);
create index if not exists idx_comment_dislikes_user_id    on comment_dislikes(user_id);
