-- Для корректной работы Supabase Realtime DELETE-событий все поля
-- должны передаваться в payload.old — это требует REPLICA IDENTITY FULL.
--
-- Без этого при DELETE в payload.old доступен только PRIMARY KEY,
-- поэтому фильтрация по user_id, card_id и т.д. не работает.
--
-- Запустить один раз в Supabase SQL Editor:

ALTER TABLE user_progress    REPLICA IDENTITY FULL;
ALTER TABLE comments         REPLICA IDENTITY FULL;
ALTER TABLE comment_likes    REPLICA IDENTITY FULL;
ALTER TABLE comment_dislikes REPLICA IDENTITY FULL;
ALTER TABLE likes            REPLICA IDENTITY FULL;
ALTER TABLE ratings          REPLICA IDENTITY FULL;
ALTER TABLE notifications    REPLICA IDENTITY FULL;
ALTER TABLE follows          REPLICA IDENTITY FULL;
