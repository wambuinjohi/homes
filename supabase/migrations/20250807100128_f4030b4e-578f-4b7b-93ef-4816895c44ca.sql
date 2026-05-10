-- Add metadata column to user_roles table to store custom trial configurations
ALTER TABLE user_roles ADD COLUMN IF NOT EXISTS metadata jsonb;