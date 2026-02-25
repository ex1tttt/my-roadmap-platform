-- ═══════════════════════════════════════════════════════════════
-- Триггер: автоматический пересчёт average_rating и ratings_count
-- Таблица-источник: ratings
-- Таблица-цель:     cards  (в проекте roadmap-платформы она же "roadmaps")
--
-- Запустить один раз в Supabase → SQL Editor → Run
-- Безопасно запускать повторно (все операторы идемпотентны)
-- ═══════════════════════════════════════════════════════════════


-- ──────────────────────────────────────────────────────────────
-- 1. Добавить денормализованные колонки в cards (если нет)
-- ──────────────────────────────────────────────────────────────
alter table cards
  add column if not exists ratings_count  integer      not null default 0,
  add column if not exists average_rating numeric(3,2) not null default 0;


-- ──────────────────────────────────────────────────────────────
-- 2. Заполнить колонки по уже существующим данным (back-fill)
-- ──────────────────────────────────────────────────────────────
update cards c
set
  ratings_count  = coalesce(agg.cnt, 0),
  average_rating = coalesce(agg.avg, 0)
from (
  select
    roadmap_id,
    count(*)::integer               as cnt,
    round(avg(rate)::numeric, 2)    as avg
  from ratings
  group by roadmap_id
) agg
where c.id = agg.roadmap_id;


-- ──────────────────────────────────────────────────────────────
-- 3. Функция триггера update_roadmap_stats()
--    Вызывается AFTER INSERT | UPDATE | DELETE на таблице ratings.
--    security definer — выполняется с правами владельца,
--    обходит RLS на cards при апдейте статистики.
-- ──────────────────────────────────────────────────────────────
create or replace function update_roadmap_stats()
returns trigger
language plpgsql
security definer
as $$
declare
  target_id uuid;
begin
  -- При DELETE строка NEW равна null — берём OLD
  if TG_OP = 'DELETE' then
    target_id := OLD.roadmap_id;
  else
    target_id := NEW.roadmap_id;
  end if;

  -- Пересчитываем и сразу записываем в cards
  update cards
  set
    ratings_count  = coalesce(agg.cnt, 0),
    average_rating = coalesce(agg.avg_val, 0)
  from (
    select
      count(*)::integer            as cnt,
      round(avg(rate)::numeric, 2) as avg_val
    from ratings
    where roadmap_id = target_id
  ) agg
  where id = target_id;

  -- AFTER-триггер обязан вернуть строку
  if TG_OP = 'DELETE' then
    return OLD;
  end if;
  return NEW;
end;
$$;


-- ──────────────────────────────────────────────────────────────
-- 4. Удалить старый триггер (если есть) и создать новый
-- ──────────────────────────────────────────────────────────────

-- Удаляем предыдущие версии триггера с любым именем
drop trigger if exists trg_sync_roadmap_rating        on ratings;
drop trigger if exists trg_update_roadmap_stats       on ratings;

create trigger trg_update_roadmap_stats
  after insert or update or delete
  on ratings
  for each row
  execute function update_roadmap_stats();


-- ──────────────────────────────────────────────────────────────
-- 5. Проверка: посмотреть текущие значения после применения
-- ──────────────────────────────────────────────────────────────
-- select id, title, ratings_count, average_rating
-- from cards
-- order by ratings_count desc
-- limit 20;
