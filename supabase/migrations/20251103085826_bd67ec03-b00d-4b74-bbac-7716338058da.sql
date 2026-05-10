-- P0: Clean up Simon's roles - Remove Landlord and Tenant roles, keep only Admin
DELETE FROM user_roles 
WHERE user_id = '23054b29-a494-42f2-bb35-d1bdf9cfdfcb' 
AND role IN ('Landlord', 'Tenant');

-- Remove Simon's subscription entry
DELETE FROM landlord_subscriptions 
WHERE landlord_id = '23054b29-a494-42f2-bb35-d1bdf9cfdfcb';

-- P0: Sync billing plan prices with fixed_amount_per_unit
UPDATE billing_plans 
SET price = fixed_amount_per_unit 
WHERE billing_model = 'fixed_per_unit' 
AND fixed_amount_per_unit IS NOT NULL;

-- P1: Create RPC function to check role conflicts
CREATE OR REPLACE FUNCTION public.check_role_conflict(
  _user_id UUID,
  _new_role app_role
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
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
  
  -- Admin conflicts with all other roles
  IF _new_role = 'Admin' AND ARRAY_LENGTH(existing_roles, 1) > 0 THEN
    RETURN TRUE;
  END IF;
  
  IF 'Admin' = ANY(existing_roles) AND _new_role != 'Admin' THEN
    RETURN TRUE;
  END IF;
  
  -- Tenant conflicts with all management roles
  IF _new_role = 'Tenant' AND (
    'Landlord' = ANY(existing_roles) OR
    'Manager' = ANY(existing_roles) OR
    'Agent' = ANY(existing_roles)
  ) THEN
    RETURN TRUE;
  END IF;
  
  -- Management roles conflict with Tenant
  IF (_new_role IN ('Landlord', 'Manager', 'Agent')) AND 'Tenant' = ANY(existing_roles) THEN
    RETURN TRUE;
  END IF;
  
  -- Landlord conflicts with Admin
  IF _new_role = 'Landlord' AND 'Admin' = ANY(existing_roles) THEN
    RETURN TRUE;
  END IF;
  
  RETURN FALSE;
END;
$$;

-- P1: Create trigger function to prevent role conflicts
CREATE OR REPLACE FUNCTION public.prevent_role_conflicts()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  -- Check if the new role conflicts with existing roles
  IF check_role_conflict(NEW.user_id, NEW.role) THEN
    RAISE EXCEPTION 'Role conflict: % role conflicts with existing roles for user %', NEW.role, NEW.user_id;
  END IF;
  
  RETURN NEW;
END;
$$;

-- P1: Create trigger to enforce role conflicts on insert
DROP TRIGGER IF EXISTS enforce_role_conflicts ON user_roles;
CREATE TRIGGER enforce_role_conflicts
  BEFORE INSERT ON user_roles
  FOR EACH ROW
  EXECUTE FUNCTION prevent_role_conflicts();