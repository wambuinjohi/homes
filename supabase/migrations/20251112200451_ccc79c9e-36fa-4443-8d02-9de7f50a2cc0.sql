-- Enforce single role per user and email uniqueness
-- This migration prevents RLS confusion by ensuring one user = one role

-- Step 1: Check for existing multi-role users (will fail if any exist)
DO $$
DECLARE
  multi_role_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO multi_role_count
  FROM (
    SELECT user_id
    FROM public.user_roles
    GROUP BY user_id
    HAVING COUNT(*) > 1
  ) multi_roles;
  
  IF multi_role_count > 0 THEN
    RAISE EXCEPTION 'Migration blocked: % users have multiple roles. Clean up data first.', multi_role_count;
  END IF;
  
  RAISE NOTICE 'Pre-check passed: No users with multiple roles found';
END $$;

-- Step 2: Add unique constraint on user_id in user_roles table
-- This physically prevents a user from having multiple roles
ALTER TABLE public.user_roles
  DROP CONSTRAINT IF EXISTS user_roles_user_id_unique;

ALTER TABLE public.user_roles
  ADD CONSTRAINT user_roles_user_id_unique UNIQUE (user_id);

COMMENT ON CONSTRAINT user_roles_user_id_unique ON public.user_roles IS 
  'Enforces one role per user to prevent RLS confusion and maintain clear access control';

-- Step 3: Add unique constraint on email in profiles table
-- (Auth already enforces this, but good to have at DB level too)
ALTER TABLE public.profiles
  DROP CONSTRAINT IF EXISTS profiles_email_unique;

ALTER TABLE public.profiles
  ADD CONSTRAINT profiles_email_unique UNIQUE (email);

COMMENT ON CONSTRAINT profiles_email_unique ON public.profiles IS 
  'Ensures each email is used by only one user in the system';

-- Step 4: Add indexes for faster email lookups
CREATE INDEX IF NOT EXISTS idx_profiles_email ON public.profiles(email);
CREATE INDEX IF NOT EXISTS idx_user_roles_user_id ON public.user_roles(user_id);

-- Step 5: Log successful migration
DO $$
BEGIN
  RAISE NOTICE 'Migration completed successfully:';
  RAISE NOTICE '  - Added unique constraint on user_roles.user_id';
  RAISE NOTICE '  - Added unique constraint on profiles.email';
  RAISE NOTICE '  - Added performance indexes';
  RAISE NOTICE '  - System now enforces: 1 user = 1 role = 1 email';
END $$;