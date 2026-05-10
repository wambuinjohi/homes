-- Update role conflict logic to allow Landlord + Tenant combination
-- A user can be both a tenant (renting) and a landlord (owning properties)

CREATE OR REPLACE FUNCTION public.check_role_conflict(_user_id uuid, _new_role app_role)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  existing_roles app_role[];
BEGIN
  -- Get user's existing roles
  SELECT ARRAY_AGG(role) INTO existing_roles
  FROM user_roles
  WHERE user_id = _user_id;
  
  -- If no existing roles, no conflict
  IF existing_roles IS NULL THEN
    RETURN FALSE;
  END IF;
  
  -- Admin conflicts with all other roles (Admin is exclusive)
  IF _new_role = 'Admin' AND ARRAY_LENGTH(existing_roles, 1) > 0 THEN
    RETURN TRUE;
  END IF;
  
  IF 'Admin' = ANY(existing_roles) AND _new_role != 'Admin' THEN
    RETURN TRUE;
  END IF;
  
  -- REMOVED: Tenant + Landlord conflict (this is now ALLOWED)
  -- A user can be both a tenant (renting a unit) and a landlord (owning properties)
  
  -- SubUser conflicts with Landlord (can't be both sub-user and landlord)
  IF _new_role = 'SubUser' AND 'Landlord' = ANY(existing_roles) THEN
    RETURN TRUE;
  END IF;
  
  IF _new_role = 'Landlord' AND 'SubUser' = ANY(existing_roles) THEN
    RETURN TRUE;
  END IF;
  
  RETURN FALSE;
END;
$$;

COMMENT ON FUNCTION public.check_role_conflict IS 
'Checks for role conflicts. Admin is exclusive. Landlord + Tenant is allowed (user can rent and own). SubUser + Landlord is not allowed.';