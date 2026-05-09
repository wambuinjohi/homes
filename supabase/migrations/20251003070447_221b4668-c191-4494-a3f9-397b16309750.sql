-- Create secure RPC to fetch sub-user permissions
-- This bypasses RLS issues and provides a secure way for sub-users to get their own permissions
CREATE OR REPLACE FUNCTION public.get_my_sub_user_permissions()
RETURNS jsonb
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_result jsonb;
BEGIN
  -- Fetch permissions and landlord_id for the authenticated user
  SELECT jsonb_build_object(
    'permissions', su.permissions,
    'landlord_id', su.landlord_id,
    'status', su.status
  )
  INTO v_result
  FROM public.sub_users su
  WHERE su.user_id = auth.uid()
    AND su.status = 'active'
  LIMIT 1;
  
  -- Return null if no sub-user record found or inactive
  RETURN v_result;
END;
$$;