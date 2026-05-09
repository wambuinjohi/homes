-- Create invoice_overview view for efficient invoice data with payment tracking
-- (Simplified version without payment_allocations table)
CREATE OR REPLACE VIEW public.invoice_overview AS
SELECT 
  i.id,
  i.invoice_number,
  i.lease_id,
  i.tenant_id,
  i.invoice_date,
  i.due_date,
  i.amount,
  i.status,
  i.description,
  i.created_at,
  i.updated_at,
  -- Payment calculations (direct payments only for now)
  0::numeric as amount_paid_allocated,
  COALESCE(pd.amount_paid_direct, 0)::numeric as amount_paid_direct,
  COALESCE(pd.amount_paid_direct, 0)::numeric as amount_paid_total,
  GREATEST(i.amount - COALESCE(pd.amount_paid_direct, 0), 0)::numeric as outstanding_amount,
  -- Computed status
  CASE 
    WHEN COALESCE(pd.amount_paid_direct, 0) >= i.amount THEN 'paid'
    WHEN i.due_date < CURRENT_DATE THEN 'overdue'
    ELSE i.status
  END as computed_status,
  -- Related data
  t.first_name,
  t.last_name,
  t.email,
  t.phone,
  u.unit_number,
  p.id as property_id,
  p.name as property_name,
  p.owner_id as property_owner_id,
  p.manager_id as property_manager_id
FROM public.invoices i
LEFT JOIN public.tenants t ON i.tenant_id = t.id
LEFT JOIN public.leases l ON i.lease_id = l.id
LEFT JOIN public.units u ON l.unit_id = u.id
LEFT JOIN public.properties p ON u.property_id = p.id
-- Direct payments aggregation  
LEFT JOIN (
  SELECT 
    invoice_id,
    SUM(amount) as amount_paid_direct
  FROM public.payments
  WHERE status IN ('completed', 'paid', 'success')
    AND invoice_id IS NOT NULL
  GROUP BY invoice_id
) pd ON i.id = pd.invoice_id;

-- Add RLS policies for invoice_overview
ALTER VIEW public.invoice_overview SET (security_invoker = true);

-- Property owners can view their invoice overview
CREATE POLICY "Property owners can view their invoice overview" ON public.invoice_overview
FOR SELECT 
USING (
  property_owner_id = auth.uid() 
  OR property_manager_id = auth.uid() 
  OR has_role(auth.uid(), 'Admin'::public.app_role)
);

-- Tenants can view their own invoice overview via user_id
CREATE POLICY "Tenants can view their own invoice overview via user_id" ON public.invoice_overview
FOR SELECT 
USING (
  EXISTS (
    SELECT 1 FROM public.tenants 
    WHERE id = invoice_overview.tenant_id 
    AND user_id = auth.uid()
  )
);

-- Tenants can view their invoice overview via email match
CREATE POLICY "Tenants can view their invoice overview via email" ON public.invoice_overview
FOR SELECT 
USING (
  lower(email) = lower(COALESCE(
    ((NULLIF(current_setting('request.jwt.claims', true), ''))::jsonb ->> 'email'),
    ''
  ))
);

-- Create bulk invoice generation function
CREATE OR REPLACE FUNCTION public.generate_monthly_invoices_for_landlord(
  p_landlord_id uuid,
  p_invoice_month date DEFAULT date_trunc('month', now()),
  p_dry_run boolean DEFAULT false
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $function$
DECLARE
  v_lease_record record;
  v_invoice_id uuid;
  v_invoice_number text;
  v_created_count integer := 0;
  v_skipped_count integer := 0;
  v_results jsonb := '[]'::jsonb;
  v_due_date date;
BEGIN
  -- Set due date to end of invoice month
  v_due_date := (p_invoice_month + interval '1 month' - interval '1 day')::date;
  
  -- Get all active leases for this landlord's properties
  FOR v_lease_record IN
    SELECT 
      l.id as lease_id,
      l.tenant_id,
      l.monthly_rent,
      u.unit_number,
      p.name as property_name,
      t.first_name,
      t.last_name
    FROM public.leases l
    JOIN public.units u ON l.unit_id = u.id
    JOIN public.properties p ON u.property_id = p.id
    LEFT JOIN public.tenants t ON l.tenant_id = t.id
    WHERE (p.owner_id = p_landlord_id OR p.manager_id = p_landlord_id)
      AND l.lease_start_date <= v_due_date
      AND l.lease_end_date >= p_invoice_month
      AND COALESCE(l.status, 'active') = 'active'
      AND l.monthly_rent > 0
  LOOP
    -- Check if invoice already exists for this lease and month
    IF EXISTS (
      SELECT 1 FROM public.invoices
      WHERE lease_id = v_lease_record.lease_id
        AND date_trunc('month', invoice_date) = date_trunc('month', p_invoice_month)
    ) THEN
      v_skipped_count := v_skipped_count + 1;
      v_results := v_results || jsonb_build_object(
        'lease_id', v_lease_record.lease_id,
        'tenant_name', COALESCE(v_lease_record.first_name, '') || ' ' || COALESCE(v_lease_record.last_name, ''),
        'unit', v_lease_record.unit_number,
        'property', v_lease_record.property_name,
        'amount', v_lease_record.monthly_rent,
        'status', 'skipped',
        'reason', 'Invoice already exists for this month'
      );
      CONTINUE;
    END IF;
    
    IF NOT p_dry_run THEN
      -- Generate invoice number
      v_invoice_number := public.generate_invoice_number();
      
      -- Create the invoice
      INSERT INTO public.invoices (
        invoice_number,
        lease_id,
        tenant_id,
        invoice_date,
        due_date,
        amount,
        status,
        description
      ) VALUES (
        v_invoice_number,
        v_lease_record.lease_id,
        v_lease_record.tenant_id,
        p_invoice_month,
        v_due_date,
        v_lease_record.monthly_rent,
        'pending',
        'Monthly rent for ' || to_char(p_invoice_month, 'Month YYYY')
      ) RETURNING id INTO v_invoice_id;
      
      v_created_count := v_created_count + 1;
    ELSE
      v_created_count := v_created_count + 1;
      v_invoice_id := null;
    END IF;
    
    -- Add to results
    v_results := v_results || jsonb_build_object(
      'lease_id', v_lease_record.lease_id,
      'invoice_id', v_invoice_id,
      'invoice_number', CASE WHEN p_dry_run THEN 'DRY-RUN' ELSE v_invoice_number END,
      'tenant_name', COALESCE(v_lease_record.first_name, '') || ' ' || COALESCE(v_lease_record.last_name, ''),
      'unit', v_lease_record.unit_number,
      'property', v_lease_record.property_name,
      'amount', v_lease_record.monthly_rent,
      'status', 'created'
    );
  END LOOP;
  
  RETURN jsonb_build_object(
    'success', true,
    'dry_run', p_dry_run,
    'invoice_month', p_invoice_month,
    'due_date', v_due_date,
    'created_count', v_created_count,
    'skipped_count', v_skipped_count,
    'total_processed', v_created_count + v_skipped_count,
    'invoices', v_results
  );
  
EXCEPTION WHEN OTHERS THEN
  RETURN jsonb_build_object(
    'success', false,
    'error', SQLERRM,
    'created_count', v_created_count,
    'skipped_count', v_skipped_count
  );
END;
$function$;