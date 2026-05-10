-- Fix the get_tenant_profile_data RPC function by removing non-existent u.floor column
CREATE OR REPLACE FUNCTION public.get_tenant_profile_data(p_user_id uuid DEFAULT auth.uid())
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_result jsonb;
BEGIN
  WITH tenant_info AS (
    SELECT 
      t.id, t.first_name, t.last_name, t.email, t.phone,
      t.emergency_contact_name, t.emergency_contact_phone,
      t.employment_status, t.employer_name, t.monthly_income,
      t.profession, t.national_id, t.previous_address
    FROM public.tenants t
    WHERE t.user_id = p_user_id
    LIMIT 1
  ),
  lease_info AS (
    SELECT 
      l.id, l.lease_start_date, l.lease_end_date, l.monthly_rent,
      l.security_deposit, l.status, l.lease_terms,
      u.unit_number, u.rent_amount as unit_rent,
      p.name as property_name, p.address, p.city, p.state,
      p.amenities, p.description as property_description
    FROM public.leases l
    JOIN public.tenants t ON l.tenant_id = t.id  
    JOIN public.units u ON l.unit_id = u.id
    JOIN public.properties p ON u.property_id = p.id
    WHERE t.user_id = p_user_id
      AND COALESCE(l.status, 'active') = 'active'
    ORDER BY l.lease_start_date DESC
    LIMIT 1
  ),
  landlord_info AS (
    SELECT 
      pr.first_name as landlord_first_name,
      pr.last_name as landlord_last_name,
      pr.email as landlord_email,
      pr.phone as landlord_phone
    FROM public.leases l
    JOIN public.tenants t ON l.tenant_id = t.id
    JOIN public.units u ON l.unit_id = u.id  
    JOIN public.properties p ON u.property_id = p.id
    JOIN public.profiles pr ON p.owner_id = pr.id
    WHERE t.user_id = p_user_id
      AND COALESCE(l.status, 'active') = 'active'
    LIMIT 1
  )
  SELECT jsonb_build_object(
    'tenant', COALESCE((SELECT row_to_json(tenant_info) FROM tenant_info), null),
    'lease', COALESCE((SELECT row_to_json(lease_info) FROM lease_info), null),
    'landlord', COALESCE((SELECT row_to_json(landlord_info) FROM landlord_info), null)
  ) INTO v_result;

  RETURN v_result;
END;
$function$