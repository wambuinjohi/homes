-- Create role eligibility validation function
-- Validates whether a user should have a specific role based on database records

CREATE OR REPLACE FUNCTION public.validate_role_eligibility(
  p_user_id uuid,
  p_role app_role
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  CASE p_role
    WHEN 'Admin' THEN
      -- Admins are manually assigned, always valid if in user_roles
      RETURN EXISTS (
        SELECT 1 FROM public.user_roles
        WHERE user_id = p_user_id AND role = 'Admin'
      );
      
    WHEN 'Landlord' THEN
      -- Must have a landlord subscription
      RETURN EXISTS (
        SELECT 1 FROM public.landlord_subscriptions
        WHERE landlord_id = p_user_id
      );
      
    WHEN 'Tenant' THEN
      -- Must be explicitly linked in tenants table (not just email match)
      RETURN EXISTS (
        SELECT 1 FROM public.tenants
        WHERE user_id = p_user_id
      );
      
    WHEN 'Manager', 'Agent', 'SubUser' THEN
      -- Must be in sub_users table
      RETURN EXISTS (
        SELECT 1 FROM public.sub_users
        WHERE user_id = p_user_id AND status = 'active'
      );
      
    ELSE
      RETURN false;
  END CASE;
END;
$$;

COMMENT ON FUNCTION public.validate_role_eligibility IS 
'Validates whether a user should have a specific role based on database records. Returns true if user meets the requirements for the role.';

-- Grant execute to authenticated users
GRANT EXECUTE ON FUNCTION public.validate_role_eligibility(uuid, app_role) TO authenticated;