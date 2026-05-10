-- Recreate the invoice_overview view without security_invoker setting
DROP VIEW IF EXISTS public.invoice_overview;

CREATE VIEW public.invoice_overview AS
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