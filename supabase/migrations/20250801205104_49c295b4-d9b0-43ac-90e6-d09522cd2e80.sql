-- First, check if the user exists and get their user_id
-- Then assign them the Admin role

-- Find the user by email and assign Admin role
INSERT INTO public.user_roles (user_id, role)
SELECT p.id, 'Admin'::public.app_role
FROM public.profiles p
WHERE p.email = 'dmwangui@gmail.com'
AND NOT EXISTS (
  SELECT 1 FROM public.user_roles ur 
  WHERE ur.user_id = p.id AND ur.role = 'Admin'::public.app_role
);

-- If the above didn't insert anything, it means either:
-- 1. The user doesn't exist in profiles table
-- 2. They already have Admin role
-- Let's also remove any other roles they might have to ensure they only have Admin
DELETE FROM public.user_roles 
WHERE user_id IN (
  SELECT p.id FROM public.profiles p WHERE p.email = 'dmwangui@gmail.com'
) 
AND role != 'Admin'::public.app_role;