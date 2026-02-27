-- Миграция: добавление поля is_private в таблицу cards
alter table cards
  add column if not exists is_private boolean not null default false;
