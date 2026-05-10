-- Fix handle_new_user function with proper security and error handling
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_phone text;
  v_role app_role;
BEGIN
  -- Validate and extract phone number
  v_phone := COALESCE(
    NEW.raw_user_meta_data ->> 'phone',
    NEW.phone,
    '+254700000000'
  );
  
  -- Validate phone format (international format: +[1-9][0-9]{7,14})
  IF v_phone !~ '^\+[1-9][0-9]{7,14}$' THEN
    RAISE WARNING 'Invalid phone format for user %: %', NEW.email, v_phone;
    v_phone := '+254700000000'; -- Fallback
  END IF;
  
  -- Extract role with fallback
  BEGIN
    v_role := COALESCE(
      (NEW.raw_user_meta_data ->> 'role')::app_role,
      'Landlord'::app_role
    );
  EXCEPTION WHEN OTHERS THEN
    v_role := 'Landlord'::app_role;
    RAISE WARNING 'Invalid role for user %, defaulting to Landlord: %', NEW.email, SQLERRM;
  END;
  
  -- Insert profile with error handling
  BEGIN
    INSERT INTO public.profiles (id, first_name, last_name, phone, email)
    VALUES (
      NEW.id,
      COALESCE(TRIM(NEW.raw_user_meta_data ->> 'first_name'), ''),
      COALESCE(TRIM(NEW.raw_user_meta_data ->> 'last_name'), ''),
      v_phone,
      NEW.email
    );
    RAISE NOTICE 'Created profile for user: %', NEW.email;
  EXCEPTION WHEN OTHERS THEN
    RAISE EXCEPTION 'Failed to create profile for user %: %', NEW.email, SQLERRM;
  END;
  
  -- Insert user role with error handling
  BEGIN
    INSERT INTO public.user_roles (user_id, role)
    VALUES (NEW.id, v_role);
    RAISE NOTICE 'Assigned role % to user: %', v_role, NEW.email;
  EXCEPTION WHEN OTHERS THEN
    RAISE EXCEPTION 'Failed to assign role to user %: %', NEW.email, SQLERRM;
  END;
  
  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  -- Log the full error for debugging
  RAISE EXCEPTION 'handle_new_user failed for %: %', NEW.email, SQLERRM;
END;
$$;

-- Ensure trigger is properly set up
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_user();

COMMENT ON FUNCTION public.handle_new_user() IS 'Trigger function to create profile and assign role when new user signs up. Runs with SECURITY DEFINER to bypass RLS.';
COMMENT ON TABLE public.profiles IS 'User profile data. RLS enabled. Trigger function handle_new_user() uses SECURITY DEFINER to bypass RLS during user creation.';

-- Fix orphaned users by creating their profiles and roles
DO $$
DECLARE
  orphan RECORD;
BEGIN
  FOR orphan IN 
    SELECT 
      au.id,
      au.email,
      au.raw_user_meta_data->>'first_name' as first_name,
      au.raw_user_meta_data->>'last_name' as last_name,
      au.raw_user_meta_data->>'phone' as phone,
      au.raw_user_meta_data->>'role' as role
    FROM auth.users au
    LEFT JOIN public.profiles p ON au.id = p.id
    WHERE p.id IS NULL
  LOOP
    -- Create profile
    BEGIN
      INSERT INTO public.profiles (id, first_name, last_name, phone, email)
      VALUES (
        orphan.id,
        COALESCE(TRIM(orphan.first_name), ''),
        COALESCE(TRIM(orphan.last_name), ''),
        COALESCE(orphan.phone, '+254700000000'),
        orphan.email
      );
      RAISE NOTICE 'Created profile for orphaned user: %', orphan.email;
    EXCEPTION WHEN OTHERS THEN
      RAISE WARNING 'Failed to create profile for %: %', orphan.email, SQLERRM;
    END;
    
    -- Create role
    BEGIN
      INSERT INTO public.user_roles (user_id, role)
      VALUES (
        orphan.id,
        COALESCE(orphan.role::app_role, 'Landlord'::app_role)
      )
      ON CONFLICT (user_id) DO NOTHING;
      RAISE NOTICE 'Created role for orphaned user: %', orphan.email;
    EXCEPTION WHEN OTHERS THEN
      RAISE WARNING 'Failed to create role for %: %', orphan.email, SQLERRM;
    END;
  END LOOP;
END $$;

-- Create a view to monitor orphaned users
CREATE OR REPLACE VIEW public.orphaned_users_monitor AS
SELECT 
  au.id,
  au.email,
  au.created_at,
  au.raw_user_meta_data->>'first_name' as first_name,
  au.raw_user_meta_data->>'last_name' as last_name,
  CASE 
    WHEN p.id IS NULL THEN 'Missing Profile'
    WHEN ur.user_id IS NULL THEN 'Missing Role'
    ELSE 'OK'
  END as status
FROM auth.users au
LEFT JOIN public.profiles p ON au.id = p.id
LEFT JOIN public.user_roles ur ON au.id = ur.user_id
WHERE p.id IS NULL OR ur.user_id IS NULL
ORDER BY au.created_at DESC;

COMMENT ON VIEW public.orphaned_users_monitor IS 'Monitor for users in auth.users missing profiles or roles';