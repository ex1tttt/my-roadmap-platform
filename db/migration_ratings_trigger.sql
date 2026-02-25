-- Migration: auto-sync average_rating & ratings_count on cards
-- when rows are inserted, updated or deleted in ratings.
--
-- Run once in Supabase SQL editor (or via supabase db push).

-- ──────────────────────────────────────────────
-- 1. Add denormalised columns to cards (if not already present)
-- ──────────────────────────────────────────────
alter table cards
  add column if not exists average_rating numeric(3,2) not null default 0,
  add column if not exists ratings_count  integer      not null default 0;

-- ──────────────────────────────────────────────
-- 2. Back-fill existing data so the columns are accurate from day one
-- ──────────────────────────────────────────────
update cards c
set
  ratings_count  = agg.cnt,
  average_rating = agg.avg
from (
  select
    roadmap_id,
    count(*)       as cnt,
    avg(rate)      as avg
  from ratings
  group by roadmap_id
) agg
where c.id = agg.roadmap_id;

-- ──────────────────────────────────────────────
-- 3. Trigger function
--    Works for INSERT, UPDATE and DELETE.
--    After any change it re-aggregates ratings for the affected roadmap.
-- ──────────────────────────────────────────────
create or replace function sync_roadmap_rating()
returns trigger
language plpgsql
security definer          -- runs with owner rights, bypasses RLS on cards
as $$
declare
  target_roadmap_id uuid;
begin
  -- Determine which roadmap was affected.
  -- On DELETE NEW is null, so we fall back to OLD.
  if TG_OP = 'DELETE' then
    target_roadmap_id := OLD.roadmap_id;
  else
    target_roadmap_id := NEW.roadmap_id;
  end if;

  -- Re-aggregate and write back in a single statement.
  update cards
  set
    ratings_count  = coalesce(agg.cnt, 0),
    average_rating = coalesce(agg.avg, 0)
  from (
    select
      count(*)::integer      as cnt,
      round(avg(rate)::numeric, 2) as avg
    from ratings
    where roadmap_id = target_roadmap_id
  ) agg
  where id = target_roadmap_id;

  -- Trigger functions must return the row (or null for AFTER triggers).
  if TG_OP = 'DELETE' then
    return OLD;
  end if;
  return NEW;
end;
$$;

-- ──────────────────────────────────────────────
-- 4. Attach trigger to ratings table
--    AFTER INSERT OR UPDATE OR DELETE — covers all write paths
-- ──────────────────────────────────────────────
drop trigger if exists trg_sync_roadmap_rating on ratings;

create trigger trg_sync_roadmap_rating
  after insert or update or delete
  on ratings
  for each row
  execute function sync_roadmap_rating();
