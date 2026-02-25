-- ═══════════════════════════════════════════════════
-- HOTFIX: добавить колонки average_rating и ratings_count
-- в таблицу cards — их ожидает триггер update_roadmap_stats
--
-- Выполнить в: Supabase → SQL Editor → Run
-- ═══════════════════════════════════════════════════

-- 1. Добавляем недостающие колонки
alter table cards
  add column if not exists average_rating numeric(3,2) not null default 0,
  add column if not exists ratings_count  integer      not null default 0;

-- 2. Заполняем из существующих оценок
update cards c
set
  ratings_count  = coalesce(agg.cnt, 0),
  average_rating = coalesce(agg.avg_val, 0)
from (
  select
    roadmap_id,
    count(*)::integer            as cnt,
    round(avg(rate)::numeric, 2) as avg_val
  from ratings
  group by roadmap_id
) agg
where c.id = agg.roadmap_id;

-- 3. Проверка — убедимся что колонки появились и данные правильные
select id, title, average_rating, ratings_count
from cards
order by ratings_count desc
limit 10;
