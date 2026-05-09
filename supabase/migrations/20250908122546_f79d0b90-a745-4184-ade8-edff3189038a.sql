-- Phase 1: Fix Security Definer View and secure invoice_overview

-- Step 1: Revoke public access from invoice_overview
REVOKE ALL ON public.invoice_overview FROM PUBLIC;
REVOKE ALL ON public.invoice_overview FROM anon;

-- Step 2: Drop and recreate invoice_overview as SECURITY INVOKER with minimal columns
DROP VIEW IF EXISTS public.invoice_overview;

-- Step 3: Recreate with SECURITY INVOKER (uses caller's permissions)
CREATE VIEW public.invoice_overview WITH (security_invoker=true) AS
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
  -- Tenant info (minimal needed for UI)
  t.first_name,
  t.last_name,
  t.email,
  t.phone,
  -- Property/Unit info (minimal needed for UI)
  u.unit_number,
  p.id as property_id,
  p.name as property_name,
  p.owner_id as property_owner_id,
  p.manager_id as property_manager_id,
  -- Payment calculations (computed safely)
  COALESCE(
    (SELECT SUM(pa.amount) 
     FROM public.payment_allocations pa 
     WHERE pa.invoice_id = i.id), 0
  ) as amount_paid_allocated,
  COALESCE(
    (SELECT SUM(py.amount) 
     FROM public.payments py 
     WHERE py.invoice_id = i.id AND py.status IN ('completed', 'paid', 'success')), 0
  ) as amount_paid_direct,
  -- Total paid calculation
  COALESCE(
    (SELECT SUM(pa.amount) FROM public.payment_allocations pa WHERE pa.invoice_id = i.id), 0
  ) + COALESCE(
    (SELECT SUM(py.amount) FROM public.payments py WHERE py.invoice_id = i.id AND py.status IN ('completed', 'paid', 'success')), 0
  ) as amount_paid_total,
  -- Outstanding amount
  i.amount - (
    COALESCE((SELECT SUM(pa.amount) FROM public.payment_allocations pa WHERE pa.invoice_id = i.id), 0) + 
    COALESCE((SELECT SUM(py.amount) FROM public.payments py WHERE py.invoice_id = i.id AND py.status IN ('completed', 'paid', 'success')), 0)
  ) as outstanding_amount,
  -- Computed status based on payments
  CASE 
    WHEN i.amount <= (
      COALESCE((SELECT SUM(pa.amount) FROM public.payment_allocations pa WHERE pa.invoice_id = i.id), 0) + 
      COALESCE((SELECT SUM(py.amount) FROM public.payments py WHERE py.invoice_id = i.id AND py.status IN ('completed', 'paid', 'success')), 0)
    ) THEN 'paid'
    WHEN i.due_date < CURRENT_DATE AND i.amount > (
      COALESCE((SELECT SUM(pa.amount) FROM public.payment_allocations pa WHERE pa.invoice_id = i.id), 0) + 
      COALESCE((SELECT SUM(py.amount) FROM public.payments py WHERE py.invoice_id = i.id AND py.status IN ('completed', 'paid', 'success')), 0)
    ) THEN 'overdue'
    ELSE i.status
  END as computed_status
FROM public.invoices i
JOIN public.tenants t ON i.tenant_id = t.id
JOIN public.leases l ON i.lease_id = l.id
JOIN public.units u ON l.unit_id = u.id
JOIN public.properties p ON u.property_id = p.id;

-- Step 4: Grant proper access to authenticated users only
GRANT SELECT ON public.invoice_overview TO authenticated;
GRANT SELECT ON public.invoice_overview TO service_role;

-- Step 5: Ensure no public access
REVOKE ALL ON public.invoice_overview FROM PUBLIC;
REVOKE ALL ON public.invoice_overview FROM anon;