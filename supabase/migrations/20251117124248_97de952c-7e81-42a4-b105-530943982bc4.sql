-- Fix user_roles table to allow multiple roles per user
-- The constraint should be on (user_id, role) not just user_id

BEGIN;

-- Drop the incorrect unique constraint on user_id alone
ALTER TABLE public.user_roles DROP CONSTRAINT IF EXISTS user_roles_user_id_unique;

-- Ensure the correct unique constraint on (user_id, role) exists
-- This was already in place according to the schema, but let's ensure it
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint 
    WHERE conname = 'user_roles_user_id_role_unique'
  ) THEN
    ALTER TABLE public.user_roles 
    ADD CONSTRAINT user_roles_user_id_role_unique UNIQUE (user_id, role);
  END IF;
END $$;

COMMIT;

COMMENT ON TABLE public.user_roles IS 
'User roles table. Users can have multiple roles (e.g., both Landlord and Tenant). Unique constraint on (user_id, role) prevents duplicate role assignments.';