-- Create optimized RPC function for tenant payments data
CREATE OR REPLACE FUNCTION public.get_tenant_payments_data(
  p_user_id uuid DEFAULT auth.uid(),
  p_limit integer DEFAULT 100
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $$
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
      'invoices', '[]'::jsonb,
      'payments', '[]'::jsonb,
      'error', 'No tenant found for user'
    );
  END IF;

  -- Get tenant info and payment data in one optimized query
  WITH tenant_info AS (
    SELECT 
      t.id, t.first_name, t.last_name, t.email, t.user_id
    FROM public.tenants t
    WHERE t.id = v_tenant_id
  ),
  invoice_data AS (
    SELECT 
      i.id, i.invoice_number, i.amount, i.status, 
      i.invoice_date, i.due_date, i.description,
      u.unit_number,
      p.name as property_name
    FROM public.invoices i
    JOIN public.leases l ON i.lease_id = l.id
    JOIN public.units u ON l.unit_id = u.id  
    JOIN public.properties p ON u.property_id = p.id
    WHERE i.tenant_id = v_tenant_id
    ORDER BY i.invoice_date DESC
    LIMIT p_limit
  ),
  payment_data AS (
    SELECT 
      py.id, py.amount, py.payment_date, py.payment_method,
      py.payment_reference, py.transaction_id, py.status, 
      py.invoice_id, py.notes
    FROM public.payments py
    WHERE py.tenant_id = v_tenant_id
      AND py.status = 'completed'
    ORDER BY py.payment_date DESC  
    LIMIT p_limit
  )
  SELECT jsonb_build_object(
    'tenant', (SELECT row_to_json(tenant_info) FROM tenant_info),
    'invoices', COALESCE((
      SELECT jsonb_agg(row_to_json(invoice_data))
      FROM invoice_data
    ), '[]'::jsonb),
    'payments', COALESCE((
      SELECT jsonb_agg(row_to_json(payment_data))  
      FROM payment_data
    ), '[]'::jsonb),
    'error', null
  ) INTO v_result;

  RETURN v_result;
END;
$$;

-- Create optimized RPC function for landlord tenants summary  
CREATE OR REPLACE FUNCTION public.get_landlord_tenants_summary(
  p_user_id uuid DEFAULT auth.uid(),
  p_search text DEFAULT '',
  p_employment_filter text DEFAULT 'all',
  p_property_filter text DEFAULT 'all',
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

  -- Get filtered tenant data with property info
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
  )
  SELECT 
    COUNT(*) INTO v_total_count
  FROM filtered_tenants;

  SELECT jsonb_build_object(
    'tenants', COALESCE((
      SELECT jsonb_agg(row_to_json(paginated_tenants))
      FROM paginated_tenants
    ), '[]'::jsonb),
    'total_count', v_total_count,
    'error', null
  ) INTO v_result;

  RETURN v_result;
END;
$$;

-- Add performance indexes
CREATE INDEX IF NOT EXISTS idx_tenants_user_id ON public.tenants(user_id);
CREATE INDEX IF NOT EXISTS idx_tenants_email_lower ON public.tenants(lower(email));
CREATE INDEX IF NOT EXISTS idx_invoices_tenant_id_date ON public.invoices(tenant_id, invoice_date DESC);
CREATE INDEX IF NOT EXISTS idx_payments_tenant_id_date ON public.payments(tenant_id, payment_date DESC) WHERE status = 'completed';
CREATE INDEX IF NOT EXISTS idx_leases_tenant_status ON public.leases(tenant_id, status);
CREATE INDEX IF NOT EXISTS idx_properties_owner_manager ON public.properties(owner_id, manager_id);

-- Grant execute permissions
GRANT EXECUTE ON FUNCTION public.get_tenant_payments_data(uuid, integer) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_landlord_tenants_summary(uuid, text, text, text, integer, integer) TO authenticated;