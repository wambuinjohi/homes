-- Drop and recreate get_user_permissions function with proper security
DROP FUNCTION IF EXISTS public.get_user_permissions(uuid);

CREATE OR REPLACE FUNCTION public.get_user_permissions(_user_id uuid DEFAULT auth.uid())
RETURNS TABLE(permission_name text)
LANGUAGE sql
SECURITY DEFINER
SET search_path = 'public'
AS $$
  -- Force the user to only query their own permissions
  SELECT p.name as permission_name
  FROM public.user_roles ur
  JOIN public.role_permissions rp ON ur.role = rp.role
  JOIN public.permissions p ON rp.permission_id = p.id
  WHERE ur.user_id = COALESCE(_user_id, auth.uid())
    AND ur.user_id = auth.uid(); -- CRITICAL: Only allow querying own permissions
$$;