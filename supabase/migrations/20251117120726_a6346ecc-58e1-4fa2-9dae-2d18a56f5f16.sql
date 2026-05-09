-- Fix ensure_tenant_role_consistency function to correctly access user_id from tenants table
CREATE OR REPLACE FUNCTION public.ensure_tenant_role_consistency()
RETURNS TRIGGER
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id uuid;
BEGIN
  -- Get the user_id from the tenant record, not from NEW (which is a lease record)
  SELECT user_id INTO v_user_id
  FROM public.tenants
  WHERE id = NEW.tenant_id;
  
  -- Only proceed if the tenant has a linked auth user
  IF v_user_id IS NOT NULL THEN
    -- If the user has an active lease, ensure they have Tenant role
    IF EXISTS (
      SELECT 1 FROM public.leases l
      JOIN public.tenants t ON l.tenant_id = t.id
      WHERE t.user_id = v_user_id
      AND COALESCE(l.status, 'active') = 'active'
    ) THEN
      -- Insert Tenant role if it doesn't exist
      INSERT INTO public.user_roles (user_id, role)
      VALUES (v_user_id, 'Tenant')
      ON CONFLICT (user_id, role) DO NOTHING;
    END IF;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;