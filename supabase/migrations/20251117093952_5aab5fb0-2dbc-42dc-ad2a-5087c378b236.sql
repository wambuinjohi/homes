-- Drop the old version of create_tenant_and_optional_lease that has deprecated parameters
DROP FUNCTION IF EXISTS public.create_tenant_and_optional_lease(
  p_first_name text,
  p_last_name text,
  p_email text,
  p_phone text,
  p_national_id text,
  p_employment_status text,
  p_profession text,
  p_employer_name text,
  p_monthly_income numeric,
  p_emergency_contact_name text,
  p_emergency_contact_phone text,
  p_previous_address text,
  p_property_id uuid,
  p_unit_id uuid,
  p_lease_start_date date,
  p_lease_end_date date,
  p_monthly_rent numeric,
  p_security_deposit numeric
);

-- Verify only one version remains
DO $$
DECLARE
  func_count integer;
BEGIN
  SELECT COUNT(*) INTO func_count
  FROM pg_proc p
  JOIN pg_namespace n ON p.pronamespace = n.oid
  WHERE n.nspname = 'public'
    AND p.proname = 'create_tenant_and_optional_lease';
  
  IF func_count != 1 THEN
    RAISE EXCEPTION 'Expected exactly 1 version of create_tenant_and_optional_lease, found %', func_count;
  END IF;
  
  RAISE NOTICE 'Successfully verified: Only 1 version of create_tenant_and_optional_lease exists';
END $$;