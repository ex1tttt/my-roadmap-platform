-- Migration: add featured_badge column to profiles
-- Stores the badge_id the user chose to showcase on their profile

alter table profiles
  add column if not exists featured_badge text default null;
