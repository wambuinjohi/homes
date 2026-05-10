-- Drop and recreate get_tenant_payments_data to include outstanding_amount, amount_paid, and credits
DROP FUNCTION IF EXISTS public.get_tenant_payments_data(uuid, integer);

CREATE FUNCTION public.get_tenant_payments_data(
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
      'credits', '[]'::jsonb,
      'total_credit_balance', 0,
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
      i.lease_id, i.tenant_id,
      u.unit_number,
      p.name as property_name,
      p.owner_id,
      -- Calculate amount_paid from payment_allocations
      COALESCE((
        SELECT SUM(pa.amount) 
        FROM public.payment_allocations pa 
        WHERE pa.invoice_id = i.id
      ), 0) as amount_paid,
      -- Calculate outstanding_amount
      i.amount - COALESCE((
        SELECT SUM(pa.amount) 
        FROM public.payment_allocations pa 
        WHERE pa.invoice_id = i.id
      ), 0) as outstanding_amount,
      -- Get landlord info for PDF generation
      lp.first_name as landlord_first_name,
      lp.last_name as landlord_last_name,
      lp.email as landlord_email,
      lp.phone as landlord_phone,
      -- Get tenant info for PDF
      t.first_name as tenant_first_name,
      t.last_name as tenant_last_name,
      t.email as tenant_email,
      t.phone as tenant_phone
    FROM public.invoices i
    JOIN public.leases l ON i.lease_id = l.id
    JOIN public.units u ON l.unit_id = u.id  
    JOIN public.properties p ON u.property_id = p.id
    JOIN public.tenants t ON i.tenant_id = t.id
    LEFT JOIN public.profiles lp ON p.owner_id = lp.id
    WHERE i.tenant_id = v_tenant_id
    ORDER BY i.invoice_date DESC
    LIMIT p_limit
  ),
  payment_data AS (
    SELECT 
      py.id, py.amount, py.payment_date, py.payment_method,
      py.payment_reference, py.transaction_id, py.status, 
      py.invoice_id, py.notes, py.lease_id
    FROM public.payments py
    WHERE py.tenant_id = v_tenant_id
      AND py.status = 'completed'
    ORDER BY py.payment_date DESC  
    LIMIT p_limit
  ),
  credit_data AS (
    SELECT 
      tc.id, tc.amount, tc.balance, tc.description, 
      tc.source_type, tc.created_at, tc.expires_at
    FROM public.tenant_credits tc
    WHERE tc.tenant_id = v_tenant_id
      AND tc.balance > 0
      AND (tc.expires_at IS NULL OR tc.expires_at > now())
    ORDER BY tc.created_at DESC
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
    'credits', COALESCE((
      SELECT jsonb_agg(row_to_json(credit_data))
      FROM credit_data
    ), '[]'::jsonb),
    'total_credit_balance', COALESCE((
      SELECT SUM(tc.balance) 
      FROM public.tenant_credits tc
      WHERE tc.tenant_id = v_tenant_id
        AND tc.balance > 0
        AND (tc.expires_at IS NULL OR tc.expires_at > now())
    ), 0),
    'error', null
  ) INTO v_result;

  RETURN v_result;
END;
$$;