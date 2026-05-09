-- Recreate the missing trigger to prevent future issues
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = ''
AS $$
BEGIN
  -- Insert into profiles table with required phone
  INSERT INTO public.profiles (id, first_name, last_name, phone, email)
  VALUES (
    NEW.id, 
    NEW.raw_user_meta_data ->> 'first_name', 
    NEW.raw_user_meta_data ->> 'last_name',
    COALESCE(NEW.raw_user_meta_data ->> 'phone', NEW.phone, '+254700000000'),
    NEW.email
  );
  
  -- Assign role based on user metadata, default to 'Agent' if not specified
  INSERT INTO public.user_roles (user_id, role)
  VALUES (
    NEW.id, 
    COALESCE(
      (NEW.raw_user_meta_data ->> 'role')::public.app_role,
      'Agent'::public.app_role
    )
  );
  
  RETURN NEW;
END;
$$;

-- Create the trigger (drop first if it exists)
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Fix orphaned user data by finding users in auth.users who don't have profiles
INSERT INTO public.profiles (id, first_name, last_name, phone, email)
SELECT 
  au.id,
  au.raw_user_meta_data->>'first_name' as first_name,
  au.raw_user_meta_data->>'last_name' as last_name,
  COALESCE(au.raw_user_meta_data->>'phone', au.phone, '+254700000000') as phone,
  au.email
FROM auth.users au
LEFT JOIN public.profiles p ON au.id = p.id
WHERE p.id IS NULL;

-- Insert missing user roles for orphaned users
INSERT INTO public.user_roles (user_id, role)
SELECT 
  au.id,
  COALESCE(au.raw_user_meta_data->>'role', 'Agent')::public.app_role as role
FROM auth.users au
LEFT JOIN public.user_roles ur ON au.id = ur.user_id
WHERE ur.user_id IS NULL;

-- Create landlord subscriptions for users with 'Landlord' or 'Manager' roles who don't have them
INSERT INTO public.landlord_subscriptions (
  landlord_id,
  billing_plan_id,
  status,
  trial_start_date,
  trial_end_date,
  sms_credits_balance,
  auto_renewal
)
SELECT 
  ur.user_id,
  (SELECT id FROM public.billing_plans WHERE is_active = true ORDER BY created_at ASC LIMIT 1),
  'trial',
  now(),
  now() + interval '30 days',
  100,
  true
FROM public.user_roles ur
LEFT JOIN public.landlord_subscriptions ls ON ur.user_id = ls.landlord_id
WHERE ur.role IN ('Landlord', 'Manager') 
  AND ls.landlord_id IS NULL;