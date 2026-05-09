-- Fix Kamoni Wanjau's role from Agent to Tenant
UPDATE user_roles 
SET role = 'Tenant'
WHERE user_id = 'defe8caa-a1aa-4674-b6b0-3982d261b4f3'
AND role = 'Agent';

-- Update auth metadata to match
UPDATE auth.users
SET raw_user_meta_data = 
  jsonb_set(
    COALESCE(raw_user_meta_data, '{}'::jsonb),
    '{role}',
    '"Tenant"'
  )
WHERE id = 'defe8caa-a1aa-4674-b6b0-3982d261b4f3';

-- Function to ensure tenant role consistency
CREATE OR REPLACE FUNCTION public.ensure_tenant_role_consistency()
RETURNS TRIGGER
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- If a user has an active lease, ensure they have Tenant role
  IF EXISTS (
    SELECT 1 FROM public.leases l
    JOIN public.tenants t ON l.tenant_id = t.id
    WHERE t.user_id = NEW.user_id
    AND COALESCE(l.status, 'active') = 'active'
  ) THEN
    -- Insert Tenant role if it doesn't exist
    INSERT INTO public.user_roles (user_id, role)
    VALUES (NEW.user_id, 'Tenant')
    ON CONFLICT (user_id, role) DO NOTHING;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Add trigger to automatically add Tenant role when lease is created
CREATE TRIGGER ensure_tenant_role_on_lease
AFTER INSERT OR UPDATE ON public.leases
FOR EACH ROW
EXECUTE FUNCTION public.ensure_tenant_role_consistency();

-- Also ensure existing tenant role when user_roles are inserted/updated
CREATE OR REPLACE FUNCTION public.validate_tenant_role_on_role_change()
RETURNS TRIGGER
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- If user has an active lease and is losing Tenant role, prevent it
  IF TG_OP = 'DELETE' AND OLD.role = 'Tenant' THEN
    IF EXISTS (
      SELECT 1 FROM public.leases l
      JOIN public.tenants t ON l.tenant_id = t.id
      WHERE t.user_id = OLD.user_id
      AND COALESCE(l.status, 'active') = 'active'
    ) THEN
      RAISE EXCEPTION 'Cannot remove Tenant role from user with active lease';
    END IF;
  END IF;
  
  RETURN OLD;
END;
$$ LANGUAGE plpgsql;

-- Trigger to prevent removing Tenant role from users with active leases
CREATE TRIGGER prevent_tenant_role_removal
BEFORE DELETE ON public.user_roles
FOR EACH ROW
EXECUTE FUNCTION public.validate_tenant_role_on_role_change();