-- Проверка схемы и RLS для gantt_tasks (Supabase / PostgreSQL).
-- Запустите целиком в SQL Editor. Строки с status <> 'OK' требуют внимания.

-- ---------------------------------------------------------------------------
-- 1) Таблица существует
-- ---------------------------------------------------------------------------
select case
  when exists (
    select 1 from information_schema.tables
    where table_schema = 'public' and table_name = 'gantt_tasks'
  ) then 'OK'
  else 'FAIL'
end as check_name,
'public.gantt_tasks exists'::text as detail;

-- ---------------------------------------------------------------------------
-- 2) Нужные колонки (parent_id, is_done — для веток и «выполнено»)
-- ---------------------------------------------------------------------------
with expected as (
  select unnest(array['id', 'card_id', 'parent_id', 'order', 'title', 'is_done']) as column_name
)
select
  e.column_name,
  case
    when c.column_name is not null then 'OK'
    else 'FAIL'
  end as status,
  coalesce(c.data_type, 'missing') as data_type
from expected e
left join information_schema.columns c
  on c.table_schema = 'public'
 and c.table_name = 'gantt_tasks'
 and c.column_name = e.column_name
order by e.column_name;

-- ---------------------------------------------------------------------------
-- 3) RLS включён
-- ---------------------------------------------------------------------------
select
  c.relname as table_name,
  c.relrowsecurity as rls_enabled,
  c.relforcerowsecurity as rls_forced,
  case when c.relrowsecurity then 'OK' else 'FAIL' end as status
from pg_class c
join pg_namespace n on n.oid = c.relnamespace
where n.nspname = 'public' and c.relname = 'gantt_tasks' and c.relkind = 'r';

-- ---------------------------------------------------------------------------
-- 4) Политики RLS (ожидаемые имена из миграций)
-- ---------------------------------------------------------------------------
with expected_policies as (
  select unnest(array[
    'gantt_tasks_select_by_card_access',
    'gantt_tasks_insert_by_owner_or_editor',
    'gantt_tasks_update_by_owner_or_editor',
    'gantt_tasks_delete_by_owner_or_editor'
  ]) as policyname
)
select
  e.policyname,
  case when p.policyname is not null then 'OK' else 'FAIL' end as status,
  p.cmd
from expected_policies e
left join pg_policies p
  on p.schemaname = 'public'
 and p.tablename = 'gantt_tasks'
 and p.policyname = e.policyname
order by e.policyname;

-- ---------------------------------------------------------------------------
-- 5) Внешний ключ parent_id → gantt_tasks(id)
--    (имя может отличаться, если создавали вручную — смотрите pg_get_constraintdef)
-- ---------------------------------------------------------------------------
select
  con.conname as constraint_name,
  pg_get_constraintdef(con.oid) as definition,
  case
    when pg_get_constraintdef(con.oid) ilike '%foreign key (parent_id)%references%gantt_tasks%'
      then 'OK (check definition)'
    else 'REVIEW'
  end as hint
from pg_constraint con
join pg_class rel on rel.oid = con.conrelid
join pg_namespace nsp on nsp.oid = rel.relnamespace
where nsp.nspname = 'public'
  and rel.relname = 'gantt_tasks'
  and con.contype = 'f'
  and con.conkey is not null
  and exists (
    select 1
    from unnest(con.conkey) with ordinality as ck(attnum, ord)
    join pg_attribute a
      on a.attrelid = con.conrelid and a.attnum = ck.attnum
    where a.attname = 'parent_id'
  );

-- ---------------------------------------------------------------------------
-- 6) Индекс по (card_id, parent_id) — из migration_gantt_tasks_parent.sql
-- ---------------------------------------------------------------------------
select
  indexname,
  indexdef,
  case
    when indexdef ilike '%card_id%' and indexdef ilike '%parent_id%' then 'OK'
    else 'REVIEW'
  end as hint
from pg_indexes
where schemaname = 'public' and tablename = 'gantt_tasks';

-- ---------------------------------------------------------------------------
-- 7) Целостность данных: «висячий» parent_id (нет строки-родителя)
-- ---------------------------------------------------------------------------
select
  'orphan parent_id'::text as issue,
  gt.id,
  gt.card_id,
  left(coalesce(gt.title, ''), 80) as title,
  gt.parent_id
from public.gantt_tasks gt
left join public.gantt_tasks p on p.id = gt.parent_id
where gt.parent_id is not null
  and p.id is null;

-- ---------------------------------------------------------------------------
-- 8) parent_id указывает на сам шаг (должно быть пусто)
-- ---------------------------------------------------------------------------
select
  'self parent'::text as issue,
  id,
  card_id,
  left(coalesce(title, ''), 80) as title,
  parent_id
from public.gantt_tasks
where parent_id is not null
  and parent_id = id;

-- ---------------------------------------------------------------------------
-- 9) Краткая сводка по строкам (по ВСЕЙ таблице — все Gantt-карты вместе)
-- ---------------------------------------------------------------------------
select
  count(*) filter (where parent_id is null) as rows_root,
  count(*) filter (where parent_id is not null) as rows_with_parent,
  count(*) as rows_total
from public.gantt_tasks;

-- ---------------------------------------------------------------------------
-- 10) То же по каждой карточке (удобно понять «3 корня» — это 3 карты или одна)
-- ---------------------------------------------------------------------------
select
  card_id,
  count(*) filter (where parent_id is null) as roots_on_card,
  count(*) filter (where parent_id is not null) as with_parent_on_card,
  count(*) as tasks_on_card
from public.gantt_tasks
group by card_id
order by tasks_on_card desc, card_id;
