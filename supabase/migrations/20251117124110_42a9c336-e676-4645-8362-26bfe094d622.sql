-- Add tenant email conflict prevention trigger
-- Warns when tenant record email matches auth user without explicit user_id link

CREATE OR REPLACE FUNCTION public.prevent_tenant_email_conflict()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
  v_auth_user_id uuid;
BEGIN
  -- If creating/updating a tenant without user_id but with an email
  IF NEW.user_id IS NULL AND NEW.email IS NOT NULL THEN
    -- Check if an auth user exists with this email
    SELECT id INTO v_auth_user_id
    FROM auth.users 
    WHERE LOWER(email) = LOWER(NEW.email)
    LIMIT 1;
    
    IF v_auth_user_id IS NOT NULL THEN
      -- Check if this auth user has a role other than Tenant
      IF EXISTS (
        SELECT 1 FROM public.user_roles
        WHERE user_id = v_auth_user_id 
          AND role IN ('Admin', 'Landlord', 'Manager', 'Agent')
      ) THEN
        RAISE EXCEPTION 
          'Cannot create tenant record: email % matches auth user % with elevated role. Use user_id link instead of email-only match.',
          NEW.email, v_auth_user_id;
      END IF;
      
      -- Just warn if auth user exists (could be future tenant signup)
      RAISE WARNING 
        'Tenant email % matches existing auth user %. Consider linking via user_id = % for proper role resolution.',
        NEW.email, v_auth_user_id, v_auth_user_id;
    END IF;
  END IF;
  
  RETURN NEW;
END;
$$;

-- Create trigger on tenants table
DROP TRIGGER IF EXISTS check_tenant_email_conflict ON public.tenants;
CREATE TRIGGER check_tenant_email_conflict
  BEFORE INSERT OR UPDATE ON public.tenants
  FOR EACH ROW
  EXECUTE FUNCTION public.prevent_tenant_email_conflict();

COMMENT ON FUNCTION public.prevent_tenant_email_conflict IS 
'Prevents tenant records from being created with emails matching auth users with elevated roles. Warns if email matches any auth user without explicit user_id link.';