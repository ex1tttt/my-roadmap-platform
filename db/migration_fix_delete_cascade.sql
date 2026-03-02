-- Fix FK constraints blocking user deletion
-- Tables: user_badges, view_history

ALTER TABLE user_badges
  DROP CONSTRAINT user_badges_user_id_fkey;

ALTER TABLE user_badges
  ADD CONSTRAINT user_badges_user_id_fkey
  FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;

ALTER TABLE view_history
  DROP CONSTRAINT view_history_user_id_fkey;

ALTER TABLE view_history
  ADD CONSTRAINT view_history_user_id_fkey
  FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;
