-- Phase 1: Optimize encryption triggers - only encrypt when data actually changes
CREATE OR REPLACE FUNCTION public.encrypt_tenant_sensitive_data()
RETURNS trigger 
LANGUAGE plpgsql 
SECURITY DEFINER 
SET search_path = public, pg_temp
AS $$
BEGIN
  -- Skip encryption if encrypted columns already populated (manual override)
  IF NEW.phone_encrypted IS NOT NULL 
     AND NEW.email_encrypted IS NOT NULL 
     AND (NEW.national_id IS NULL OR NEW.national_id_encrypted IS NOT NULL)
     AND (NEW.emergency_contact_phone IS NULL OR NEW.emergency_contact_phone_encrypted IS NOT NULL) THEN
    RETURN NEW;
  END IF;
  
  -- Only encrypt fields that changed or are new
  IF TG_OP = 'INSERT' OR (TG_OP = 'UPDATE' AND OLD.phone IS DISTINCT FROM NEW.phone) THEN
    IF NEW.phone IS NOT NULL AND NEW.phone_encrypted IS NULL THEN
      NEW.phone_encrypted := public.encrypt_sensitive_data(NEW.phone);
      NEW.phone_token := public.create_search_token(NEW.phone);
    END IF;
  END IF;
  
  IF TG_OP = 'INSERT' OR (TG_OP = 'UPDATE' AND OLD.email IS DISTINCT FROM NEW.email) THEN
    IF NEW.email IS NOT NULL AND NEW.email_encrypted IS NULL THEN
      NEW.email_encrypted := public.encrypt_sensitive_data(NEW.email);
      NEW.email_token := public.create_search_token(NEW.email);
    END IF;
  END IF;
  
  IF TG_OP = 'INSERT' OR (TG_OP = 'UPDATE' AND OLD.national_id IS DISTINCT FROM NEW.national_id) THEN
    IF NEW.national_id IS NOT NULL AND NEW.national_id_encrypted IS NULL THEN
      NEW.national_id_encrypted := public.encrypt_sensitive_data(NEW.national_id);
    END IF;
  END IF;
  
  IF TG_OP = 'INSERT' OR (TG_OP = 'UPDATE' AND OLD.emergency_contact_phone IS DISTINCT FROM NEW.emergency_contact_phone) THEN
    IF NEW.emergency_contact_phone IS NOT NULL AND NEW.emergency_contact_phone_encrypted IS NULL THEN
      NEW.emergency_contact_phone_encrypted := public.encrypt_sensitive_data(NEW.emergency_contact_phone);
    END IF;
  END IF;
  
  RETURN NEW;
END;
$$;

-- Recreate trigger with optimized function
DROP TRIGGER IF EXISTS encrypt_tenant_data_trigger ON public.tenants;
CREATE TRIGGER encrypt_tenant_data_trigger
  BEFORE INSERT OR UPDATE ON public.tenants
  FOR EACH ROW
  EXECUTE FUNCTION public.encrypt_tenant_sensitive_data();

-- Phase 4: Add database indexes for lookup speed
-- Index for email lookups (used frequently for duplicate checks)
CREATE INDEX IF NOT EXISTS idx_tenants_email_lower ON public.tenants (LOWER(email));

-- Index for phone lookups
CREATE INDEX IF NOT EXISTS idx_tenants_phone ON public.tenants (phone) WHERE phone IS NOT NULL;

-- Index for unit_id lookups in leases
CREATE INDEX IF NOT EXISTS idx_leases_unit_id_status ON public.leases (unit_id, status);

-- Index for tenant_id lookups
CREATE INDEX IF NOT EXISTS idx_leases_tenant_id ON public.leases (tenant_id);