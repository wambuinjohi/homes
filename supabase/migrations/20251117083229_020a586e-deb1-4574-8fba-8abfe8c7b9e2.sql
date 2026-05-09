-- Update lookup_tenant_in_portfolio to include national_id check
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
  v_result jsonb;
BEGIN
  -- Get current user
  v_current_user_id := auth.uid();
  
  IF v_current_user_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  -- Look for existing tenant in user's portfolio (properties they own or manage)
  SELECT jsonb_build_object(
    'id', t.id,
    'first_name', t.first_name,
    'last_name', t.last_name,
    'email', t.email,
    'phone', t.phone,
    'national_id', t.national_id,
    'has_active_lease', EXISTS(
      SELECT 1 FROM leases l 
      WHERE l.tenant_id = t.id 
      AND l.status = 'active'
    )
  ) INTO v_result
  FROM tenants t
  JOIN units u ON t.id = ANY(
    SELECT tenant_id FROM leases WHERE unit_id = u.id
  )
  JOIN properties p ON u.property_id = p.id
  WHERE (p.owner_id = v_current_user_id OR p.manager_id = v_current_user_id)
    AND (
      (p_email IS NOT NULL AND LOWER(TRIM(t.email)) = LOWER(TRIM(p_email)))
      OR (p_phone IS NOT NULL AND TRIM(t.phone) = TRIM(p_phone))
      OR (p_national_id IS NOT NULL AND p_national_id != '' AND TRIM(UPPER(t.national_id)) = TRIM(UPPER(p_national_id)))
    )
  LIMIT 1;

  RETURN v_result;
END;
$$;