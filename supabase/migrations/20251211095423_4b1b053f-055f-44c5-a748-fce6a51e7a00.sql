-- Update RPC function to include tenant phone in the result
DROP FUNCTION IF EXISTS public.get_tenant_payments_data(UUID, INT);

CREATE OR REPLACE FUNCTION public.get_tenant_payments_data(
  p_user_id UUID,
  p_limit INT DEFAULT 50
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_tenant_id UUID;
  v_result JSON;
BEGIN
  -- Get tenant ID for the user
  SELECT id INTO v_tenant_id
  FROM public.tenants
  WHERE user_id = p_user_id
  LIMIT 1;

  IF v_tenant_id IS NULL THEN
    RETURN json_build_object('error', 'Tenant not found for user');
  END IF;

  -- Build the complete result
  WITH tenant_info AS (
    SELECT 
      t.id,
      t.first_name,
      t.last_name,
      t.email,
      t.phone,
      t.user_id
    FROM public.tenants t
    WHERE t.id = v_tenant_id
  ),
  invoice_data AS (
    SELECT 
      i.id,
      i.invoice_number,
      i.amount,
      i.status,
      i.invoice_date,
      i.due_date,
      i.description,
      i.tenant_id,
      i.lease_id,
      u.unit_number,
      p.name as property_name,
      p.owner_id,
      -- Include landlord profile data for PDF generation (bypasses RLS)
      prof.first_name as landlord_first_name,
      prof.last_name as landlord_last_name,
      prof.email as landlord_email,
      prof.phone as landlord_phone,
      -- Include tenant profile data for PDF generation
      ti.first_name as tenant_first_name,
      ti.last_name as tenant_last_name,
      ti.email as tenant_email,
      ti.phone as tenant_phone
    FROM public.invoices i
    JOIN public.leases l ON i.lease_id = l.id
    JOIN public.units u ON l.unit_id = u.id
    JOIN public.properties p ON u.property_id = p.id
    LEFT JOIN public.profiles prof ON p.owner_id = prof.id
    LEFT JOIN public.tenants ti ON i.tenant_id = ti.id
    WHERE i.tenant_id = v_tenant_id
    ORDER BY i.invoice_date DESC
    LIMIT p_limit
  ),
  payment_data AS (
    SELECT 
      pay.id,
      pay.amount,
      pay.payment_date,
      pay.payment_method,
      pay.status,
      pay.transaction_id,
      pay.payment_reference,
      pay.invoice_id,
      pay.lease_id
    FROM public.payments pay
    WHERE pay.tenant_id = v_tenant_id
    ORDER BY pay.payment_date DESC
    LIMIT p_limit
  )
  SELECT json_build_object(
    'tenant', (SELECT row_to_json(tenant_info) FROM tenant_info),
    'invoices', COALESCE((SELECT json_agg(invoice_data) FROM invoice_data), '[]'::json),
    'payments', COALESCE((SELECT json_agg(payment_data) FROM payment_data), '[]'::json)
  ) INTO v_result;

  RETURN v_result;
END;
$$;