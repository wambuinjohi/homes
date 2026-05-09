-- Update get_tenant_profile_data to support multiple leases per tenant
CREATE OR REPLACE FUNCTION public.get_tenant_profile_data(p_user_id uuid DEFAULT auth.uid())
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $function$
DECLARE
  v_tenant_id uuid;
  v_result jsonb;
BEGIN
  -- Get tenant ID from user_id or email match
  SELECT t.id INTO v_tenant_id
  FROM public.tenants t
  WHERE t.user_id = p_user_id
     OR lower(t.email) = lower(COALESCE(
         ((NULLIF(current_setting('request.jwt.claims', true), ''))::jsonb ->> 'email'),
         ''
       ))
  LIMIT 1;

  IF v_tenant_id IS NULL THEN
    RETURN jsonb_build_object(
      'tenant', null,
      'leases', '[]'::jsonb,
      'landlord', null,
      'error', 'No tenant found for user'
    );
  END IF;

  -- Get tenant info and all active leases with property details
  WITH tenant_info AS (
    SELECT 
      t.id, t.first_name, t.last_name, t.email, t.phone,
      t.emergency_contact_name, t.emergency_contact_phone,
      t.employment_status, t.employer_name, t.monthly_income,
      t.profession, t.national_id, t.previous_address, t.user_id
    FROM public.tenants t
    WHERE t.id = v_tenant_id
  ),
  lease_data AS (
    SELECT 
      l.id, l.lease_start_date, l.lease_end_date, l.monthly_rent,
      l.security_deposit, l.status, l.lease_terms,
      u.unit_number, u.floor, u.rent as unit_rent,
      p.name as property_name, p.address, p.city, p.state,
      p.amenities, p.description as property_description,
      -- Get landlord info from property owner
      pr.first_name as landlord_first_name,
      pr.last_name as landlord_last_name, 
      pr.email as landlord_email,
      pr.phone as landlord_phone
    FROM public.leases l
    JOIN public.units u ON l.unit_id = u.id  
    JOIN public.properties p ON u.property_id = p.id
    LEFT JOIN public.profiles pr ON p.owner_id = pr.id
    WHERE l.tenant_id = v_tenant_id
      AND COALESCE(l.status, 'active') != 'terminated'
    ORDER BY l.lease_start_date DESC
  ),
  -- Get landlord info from the most recent lease for backward compatibility
  primary_landlord AS (
    SELECT DISTINCT ON (1)
      landlord_first_name, landlord_last_name, 
      landlord_email, landlord_phone
    FROM lease_data
    ORDER BY 1, lease_start_date DESC
    LIMIT 1
  )
  SELECT jsonb_build_object(
    'tenant', (SELECT row_to_json(tenant_info) FROM tenant_info),
    'leases', COALESCE((
      SELECT jsonb_agg(row_to_json(lease_data))
      FROM lease_data
    ), '[]'::jsonb),
    'landlord', (SELECT row_to_json(primary_landlord) FROM primary_landlord),
    'error', null
  ) INTO v_result;

  RETURN v_result;
END;
$function$;

-- Create function to get all tenant leases (for the new hook)
CREATE OR REPLACE FUNCTION public.get_tenant_leases(p_user_id uuid DEFAULT auth.uid())
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $function$
DECLARE
  v_tenant_id uuid;
  v_result jsonb;
BEGIN
  -- Get tenant ID from user_id or email match
  SELECT t.id INTO v_tenant_id
  FROM public.tenants t
  WHERE t.user_id = p_user_id
     OR lower(t.email) = lower(COALESCE(
         ((NULLIF(current_setting('request.jwt.claims', true), ''))::jsonb ->> 'email'),
         ''
       ))
  LIMIT 1;

  IF v_tenant_id IS NULL THEN
    RETURN jsonb_build_object(
      'leases', '[]'::jsonb,
      'error', 'No tenant found for user'
    );
  END IF;

  -- Get all leases for the tenant with full property details
  WITH lease_data AS (
    SELECT 
      l.id, l.lease_start_date, l.lease_end_date, l.monthly_rent,
      l.security_deposit, l.status, l.lease_terms, l.tenant_id,
      u.id as unit_id, u.unit_number, u.floor, u.rent as unit_rent,
      u.bedrooms, u.bathrooms, u.square_feet,
      p.id as property_id, p.name as property_name, 
      p.address, p.city, p.state, p.amenities, 
      p.description as property_description,
      -- Get landlord info
      pr.first_name as landlord_first_name,
      pr.last_name as landlord_last_name,
      pr.email as landlord_email,
      pr.phone as landlord_phone
    FROM public.leases l
    JOIN public.units u ON l.unit_id = u.id  
    JOIN public.properties p ON u.property_id = p.id
    LEFT JOIN public.profiles pr ON p.owner_id = pr.id
    WHERE l.tenant_id = v_tenant_id
    ORDER BY 
      CASE WHEN COALESCE(l.status, 'active') = 'active' THEN 0 ELSE 1 END,
      l.lease_start_date DESC
  )
  SELECT jsonb_build_object(
    'leases', COALESCE((
      SELECT jsonb_agg(row_to_json(lease_data))
      FROM lease_data
    ), '[]'::jsonb),
    'error', null
  ) INTO v_result;

  RETURN v_result;
END;
$function$;