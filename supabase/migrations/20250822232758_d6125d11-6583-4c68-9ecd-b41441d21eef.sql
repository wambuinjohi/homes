-- Fix the get_landlord_tenants_summary function
CREATE OR REPLACE FUNCTION public.get_landlord_tenants_summary(
  p_user_id uuid DEFAULT auth.uid(), 
  p_search text DEFAULT ''::text, 
  p_employment_filter text DEFAULT 'all'::text, 
  p_property_filter text DEFAULT 'all'::text, 
  p_limit integer DEFAULT 100, 
  p_offset integer DEFAULT 0
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $$
DECLARE
  v_result jsonb;
  v_total_count integer;
BEGIN
  -- Check if user has permission (landlord/admin)
  IF NOT (
    public.has_role(p_user_id, 'Admin'::public.app_role) OR
    public.has_role(p_user_id, 'Landlord'::public.app_role) OR
    EXISTS (
      SELECT 1 FROM public.properties pr 
      WHERE pr.owner_id = p_user_id OR pr.manager_id = p_user_id
    )
  ) THEN
    RETURN jsonb_build_object(
      'tenants', '[]'::jsonb,
      'total_count', 0,
      'error', 'Insufficient permissions'
    );
  END IF;

  -- Get filtered tenant data with property info and pagination in one query
  WITH filtered_tenants AS (
    SELECT 
      t.id, t.first_name, t.last_name, t.email, t.phone,
      t.employment_status, t.employer_name, t.monthly_income,
      t.emergency_contact_name, t.emergency_contact_phone,
      t.previous_address, t.created_at,
      p.name as property_name,
      u.unit_number,
      l.monthly_rent as rent_amount
    FROM public.tenants t
    LEFT JOIN public.leases l ON l.tenant_id = t.id AND COALESCE(l.status, 'active') <> 'terminated'
    LEFT JOIN public.units u ON l.unit_id = u.id
    LEFT JOIN public.properties p ON u.property_id = p.id
    WHERE (
      -- Permission check
      public.has_role(p_user_id, 'Admin'::public.app_role) OR
      p.owner_id = p_user_id OR p.manager_id = p_user_id
    )
    AND (
      -- Search filter
      p_search = '' OR
      lower(t.first_name || ' ' || t.last_name) LIKE lower('%' || p_search || '%') OR
      lower(t.email) LIKE lower('%' || p_search || '%')
    )
    AND (
      -- Employment filter
      p_employment_filter = 'all' OR t.employment_status = p_employment_filter
    )
    AND (
      -- Property filter  
      p_property_filter = 'all' OR p.name = p_property_filter
    )
    ORDER BY t.created_at DESC
  ),
  paginated_tenants AS (
    SELECT * FROM filtered_tenants
    LIMIT p_limit OFFSET p_offset
  ),
  total_count AS (
    SELECT COUNT(*) as count FROM filtered_tenants
  )
  SELECT jsonb_build_object(
    'tenants', COALESCE((
      SELECT jsonb_agg(row_to_json(paginated_tenants))
      FROM paginated_tenants
    ), '[]'::jsonb),
    'total_count', (SELECT count FROM total_count),
    'error', null
  ) INTO v_result;

  RETURN v_result;
END;
$$;