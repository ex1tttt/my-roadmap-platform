-- Добавляем parent_id в таблицу comments для поддержки вложенных ответов
alter table comments
  add column if not exists parent_id uuid references comments(id) on delete cascade;

-- Индекс для быстрой выборки ответов по родительскому комментарию
create index if not exists idx_comments_parent_id on comments(parent_id);
