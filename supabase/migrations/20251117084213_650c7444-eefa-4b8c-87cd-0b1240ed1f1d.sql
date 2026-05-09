-- Drop existing buggy function(s)
DROP FUNCTION IF EXISTS public.lookup_tenant_in_portfolio(text, text, text);
DROP FUNCTION IF EXISTS public.lookup_tenant_in_portfolio(text, text);

-- Create corrected function with proper joins
CREATE OR REPLACE FUNCTION public.lookup_tenant_in_portfolio(
  p_email text DEFAULT NULL,
  p_phone text DEFAULT NULL,
  p_national_id text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_current_user_id uuid;
  v_tenant_record record;
  v_unit_count int;
BEGIN
  v_current_user_id := auth.uid();
  
  IF v_current_user_id IS NULL THEN
    RETURN NULL;
  END IF;

  -- Find tenant in current landlord's portfolio with proper joins
  SELECT DISTINCT t.*
  INTO v_tenant_record
  FROM public.tenants t
  JOIN public.leases l ON l.tenant_id = t.id
  JOIN public.units u ON l.unit_id = u.id
  JOIN public.properties p ON u.property_id = p.id
  WHERE (p.owner_id = v_current_user_id OR p.manager_id = v_current_user_id)
    AND (
      (p_email IS NOT NULL AND LOWER(TRIM(t.email)) = LOWER(TRIM(p_email)))
      OR (p_phone IS NOT NULL AND TRIM(t.phone) = TRIM(p_phone))
      OR (p_national_id IS NOT NULL AND p_national_id != '' AND TRIM(UPPER(t.national_id)) = TRIM(UPPER(p_national_id)))
    )
  LIMIT 1;

  IF v_tenant_record IS NULL THEN
    RETURN NULL;
  END IF;

  -- Count current active units
  SELECT COUNT(DISTINCT l.unit_id)::int
  INTO v_unit_count
  FROM public.leases l
  JOIN public.units u ON l.unit_id = u.id
  JOIN public.properties p ON u.property_id = p.id
  WHERE l.tenant_id = v_tenant_record.id
    AND l.status = 'active'
    AND (p.owner_id = v_current_user_id OR p.manager_id = v_current_user_id);

  -- Return tenant info with national_id
  RETURN jsonb_build_object(
    'id', v_tenant_record.id,
    'first_name', v_tenant_record.first_name,
    'last_name', v_tenant_record.last_name,
    'email', v_tenant_record.email,
    'phone', v_tenant_record.phone,
    'national_id', v_tenant_record.national_id,
    'current_units', v_unit_count
  );
END;
$$;