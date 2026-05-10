-- Create a dedicated RPC for tenant contacts that's more reliable
CREATE OR REPLACE FUNCTION public.get_tenant_contacts(p_user_id uuid DEFAULT auth.uid())
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $function$
DECLARE
  v_result jsonb;
BEGIN
  WITH tenant_property AS (
    SELECT DISTINCT
      p.id as property_id,
      p.name as property_name,
      p.owner_id,
      p.manager_id
    FROM public.tenants t
    JOIN public.leases l ON l.tenant_id = t.id
    JOIN public.units u ON l.unit_id = u.id
    JOIN public.properties p ON u.property_id = p.id
    WHERE t.user_id = p_user_id
      AND COALESCE(l.status, 'active') = 'active'
    LIMIT 1
  ),
  owner_contact AS (
    SELECT jsonb_build_object(
      'name', CONCAT(COALESCE(pr.first_name, ''), ' ', COALESCE(pr.last_name, '')),
      'phone', COALESCE(pr.phone, 'N/A'),
      'email', COALESCE(pr.email, 'N/A'),
      'role', 'Landlord',
      'isPlatformSupport', false
    ) as contact
    FROM tenant_property tp
    JOIN public.profiles pr ON pr.id = tp.owner_id
    WHERE tp.owner_id IS NOT NULL
  ),
  manager_contact AS (
    SELECT jsonb_build_object(
      'name', CONCAT(COALESCE(pr.first_name, ''), ' ', COALESCE(pr.last_name, '')),
      'phone', COALESCE(pr.phone, 'N/A'),
      'email', COALESCE(pr.email, 'N/A'),
      'role', 'Property Manager',
      'isPlatformSupport', false
    ) as contact
    FROM tenant_property tp
    JOIN public.profiles pr ON pr.id = tp.manager_id
    WHERE tp.manager_id IS NOT NULL
  ),
  platform_support AS (
    SELECT jsonb_build_object(
      'name', 'Zira Homes Support',
      'phone', '+254 757 878 023',
      'email', 'support@ziratech.com',
      'role', 'Platform Support',
      'isPlatformSupport', true
    ) as contact
  )
  SELECT jsonb_build_object(
    'contacts', COALESCE(
      jsonb_agg(contact) FILTER (WHERE contact IS NOT NULL),
      jsonb_build_array()
    ) || jsonb_build_array((SELECT contact FROM platform_support)),
    'error', null
  )
  FROM (
    SELECT contact FROM owner_contact
    UNION ALL
    SELECT contact FROM manager_contact
  ) all_contacts
  INTO v_result;

  RETURN COALESCE(v_result, jsonb_build_object(
    'contacts', jsonb_build_array(jsonb_build_object(
      'name', 'Zira Homes Support',
      'phone', '+254 757 878 023',
      'email', 'support@ziratech.com',
      'role', 'Platform Support',
      'isPlatformSupport', true
    )),
    'error', 'No contacts found - showing platform support'
  ));
END;
$function$