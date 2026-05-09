-- Drop and recreate the RPC function to include landlord profile information
DROP FUNCTION IF EXISTS public.get_tenant_payments_data(uuid, integer);

CREATE FUNCTION public.get_tenant_payments_data(p_user_id uuid, p_limit integer DEFAULT 50)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
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
      i.lease_id,
      u.unit_number,
      p.name as property_name,
      p.owner_id,
      -- Include landlord profile data for PDF generation
      prof.first_name as landlord_first_name,
      prof.last_name as landlord_last_name,
      prof.email as landlord_email,
      prof.phone as landlord_phone
    FROM public.invoices i
    JOIN public.leases l ON i.lease_id = l.id
    JOIN public.units u ON l.unit_id = u.id  
    JOIN public.properties p ON u.property_id = p.id
    LEFT JOIN public.profiles prof ON p.owner_id = prof.id
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