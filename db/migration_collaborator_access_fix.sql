-- ===================================================================
-- Исправление: коллабораторы не видели приватные карточки
-- + ограничение UPDATE только для роли 'editor'
-- ===================================================================

-- 1) Разрешаем коллабораторам SELECT приватных карточек
--    (без этого приватная карточка возвращала null до проверки роли)
create policy "cards_collaborator_select"
  on cards
  for select
  using (
    exists (
      select 1 from card_collaborators
      where card_id = id
        and user_email = auth.email()
    )
  );

-- 2) Ограничиваем UPDATE только роль 'editor'
--    (старая политика давала UPDATE любому коллаборатору, включая viewer)
drop policy if exists "cards_update_by_collaborator" on cards;

create policy "cards_update_by_collaborator"
  on cards for update
  using (
    exists (
      select 1 from card_collaborators
      where card_id = id
        and user_email = auth.email()
        and role = 'editor'
    )
  );
