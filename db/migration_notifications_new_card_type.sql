-- Migration: add 'new_card' to notifications type check constraint
-- Drop old constraint and recreate with the new allowed value

ALTER TABLE notifications
  DROP CONSTRAINT IF EXISTS notifications_type_check;

ALTER TABLE notifications
  ADD CONSTRAINT notifications_type_check
    CHECK (type IN ('follow', 'like', 'comment', 'comment_like', 'new_card'));
