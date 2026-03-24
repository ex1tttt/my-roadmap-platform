-- Migration: Add Privacy Policy acceptance fields to profiles
-- Created: 2026-03-24

ALTER TABLE profiles ADD COLUMN IF NOT EXISTS privacy_policy_agreed BOOLEAN DEFAULT FALSE;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS privacy_policy_agreed_at TIMESTAMP WITH TIME ZONE DEFAULT NULL;

-- Create index for quick filtering of users who accepted privacy policy
CREATE INDEX IF NOT EXISTS idx_profiles_privacy_agreed ON profiles(privacy_policy_agreed);
CREATE INDEX IF NOT EXISTS idx_profiles_privacy_agreed_at ON profiles(privacy_policy_agreed_at);

COMMENT ON COLUMN profiles.privacy_policy_agreed IS 'Whether the user has agreed to the Privacy Policy';
COMMENT ON COLUMN profiles.privacy_policy_agreed_at IS 'Timestamp when the user agreed to the Privacy Policy';
