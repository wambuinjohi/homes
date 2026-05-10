-- Final Security Migration: Comprehensive RLS Policies + Documentation

-- Create additional restrictive RLS policies for remaining ERRORs

-- 1. Enhanced tenants table policies (Customer Personal Information)  
DROP POLICY IF EXISTS "Enhanced tenant data protection" ON public.tenants;
CREATE POLICY "Enhanced tenant data protection" ON public.tenants
  FOR ALL TO authenticated
  USING (
    -- Admins can access all
    has_role(auth.uid(), 'Admin'::app_role) OR
    -- Tenants can only access their own record
    (auth.uid() = user_id) OR
    -- Property owners/managers can access tenants of their properties
    can_user_manage_tenant(auth.uid(), id)
  )
  WITH CHECK (
    has_role(auth.uid(), 'Admin'::app_role) OR
    can_user_manage_tenant(auth.uid(), id)
  );

-- 2. Enhanced mpesa_transactions policies (Financial Transaction Data)
DROP POLICY IF EXISTS "Enhanced transaction access control" ON public.mpesa_transactions;
CREATE POLICY "Enhanced transaction access control" ON public.mpesa_transactions
  FOR ALL TO authenticated
  USING (
    -- Admins can access all
    has_role(auth.uid(), 'Admin'::app_role) OR
    -- Transaction initiator can access
    (initiated_by = auth.uid()) OR
    -- Property owners can access transactions for their invoices
    (invoice_id IS NOT NULL AND EXISTS (
      SELECT 1 FROM public.invoices inv
      JOIN public.leases l ON inv.lease_id = l.id
      JOIN public.units u ON l.unit_id = u.id  
      JOIN public.properties p ON u.property_id = p.id
      WHERE inv.id = mpesa_transactions.invoice_id 
        AND (p.owner_id = auth.uid() OR p.manager_id = auth.uid())
    )) OR
    -- Tenants can access transactions for their invoices
    (invoice_id IS NOT NULL AND EXISTS (
      SELECT 1 FROM public.invoices inv
      JOIN public.tenants t ON inv.tenant_id = t.id
      WHERE inv.id = mpesa_transactions.invoice_id AND t.user_id = auth.uid()
    ))
  );

-- 3. Enhanced mpesa_credentials policies (Payment Gateway Credentials)
DROP POLICY IF EXISTS "Strict credential access control" ON public.mpesa_credentials;  
CREATE POLICY "Strict credential access control" ON public.mpesa_credentials
  FOR ALL TO authenticated
  USING (
    -- Only admins and credential owners
    has_role(auth.uid(), 'Admin'::app_role) OR
    (landlord_id = auth.uid())
  )
  WITH CHECK (
    has_role(auth.uid(), 'Admin'::app_role) OR  
    (landlord_id = auth.uid())
  );

-- 4. Enhanced sms_usage policies (Communication Records) 
DROP POLICY IF EXISTS "Restrict SMS usage access" ON public.sms_usage;
CREATE POLICY "Restrict SMS usage access" ON public.sms_usage
  FOR ALL TO authenticated
  USING (
    -- Only admins and SMS senders
    has_role(auth.uid(), 'Admin'::app_role) OR
    (landlord_id = auth.uid())
  )
  WITH CHECK (
    has_role(auth.uid(), 'Admin'::app_role) OR
    (landlord_id = auth.uid())
  );

-- 5. Create comprehensive invoice_overview access control
-- Since it's a view, we ensure the underlying RLS policies are sufficient
-- and create additional view-specific access restrictions

-- Drop and recreate invoice_overview with even stricter column selection
DROP VIEW IF EXISTS public.invoice_overview;
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
  -- Only include minimal tenant info needed for invoicing
  CASE 
    WHEN has_role(auth.uid(), 'Admin'::app_role) OR
         EXISTS (SELECT 1 FROM public.properties p 
                 JOIN public.units u ON p.id = u.property_id
                 JOIN public.leases l ON u.id = l.unit_id
                 WHERE l.id = i.lease_id AND (p.owner_id = auth.uid() OR p.manager_id = auth.uid()))
    THEN t.first_name
    ELSE NULL
  END as first_name,
  CASE 
    WHEN has_role(auth.uid(), 'Admin'::app_role) OR
         EXISTS (SELECT 1 FROM public.properties p 
                 JOIN public.units u ON p.id = u.property_id
                 JOIN public.leases l ON u.id = l.unit_id
                 WHERE l.id = i.lease_id AND (p.owner_id = auth.uid() OR p.manager_id = auth.uid()))
    THEN t.last_name
    ELSE NULL
  END as last_name,
  -- Mask sensitive contact info unless authorized
  CASE 
    WHEN has_role(auth.uid(), 'Admin'::app_role) OR t.user_id = auth.uid() OR
         EXISTS (SELECT 1 FROM public.properties p 
                 JOIN public.units u ON p.id = u.property_id
                 JOIN public.leases l ON u.id = l.unit_id
                 WHERE l.id = i.lease_id AND (p.owner_id = auth.uid() OR p.manager_id = auth.uid()))
    THEN t.email
    ELSE NULL
  END as email,
  CASE 
    WHEN has_role(auth.uid(), 'Admin'::app_role) OR t.user_id = auth.uid() OR
         EXISTS (SELECT 1 FROM public.properties p 
                 JOIN public.units u ON p.id = u.property_id
                 JOIN public.leases l ON u.id = l.unit_id
                 WHERE l.id = i.lease_id AND (p.owner_id = auth.uid() OR p.manager_id = auth.uid()))
    THEN t.phone
    ELSE NULL
  END as phone,
  -- Property/Unit info (authorized users only)
  u.unit_number,
  p.id as property_id,
  p.name as property_name,
  p.owner_id as property_owner_id,
  p.manager_id as property_manager_id,
  -- Financial calculations (authorized users only)
  CASE
    WHEN has_role(auth.uid(), 'Admin'::app_role) OR t.user_id = auth.uid() OR
         EXISTS (SELECT 1 FROM public.properties p2
                 JOIN public.units u2 ON p2.id = u2.property_id
                 JOIN public.leases l2 ON u2.id = l2.unit_id
                 WHERE l2.id = i.lease_id AND (p2.owner_id = auth.uid() OR p2.manager_id = auth.uid()))
    THEN COALESCE((SELECT SUM(pa.amount) FROM public.payment_allocations pa WHERE pa.invoice_id = i.id), 0)
    ELSE NULL
  END as amount_paid_allocated,
  CASE
    WHEN has_role(auth.uid(), 'Admin'::app_role) OR t.user_id = auth.uid() OR
         EXISTS (SELECT 1 FROM public.properties p2
                 JOIN public.units u2 ON p2.id = u2.property_id
                 JOIN public.leases l2 ON u2.id = l2.unit_id
                 WHERE l2.id = i.lease_id AND (p2.owner_id = auth.uid() OR p2.manager_id = auth.uid()))
    THEN COALESCE((SELECT SUM(py.amount) FROM public.payments py WHERE py.invoice_id = i.id AND py.status IN ('completed', 'paid', 'success')), 0)
    ELSE NULL
  END as amount_paid_direct,
  -- Continue pattern for other financial fields...
  CASE
    WHEN has_role(auth.uid(), 'Admin'::app_role) OR t.user_id = auth.uid() OR
         EXISTS (SELECT 1 FROM public.properties p2
                 JOIN public.units u2 ON p2.id = u2.property_id
                 JOIN public.leases l2 ON u2.id = l2.unit_id
                 WHERE l2.id = i.lease_id AND (p2.owner_id = auth.uid() OR p2.manager_id = auth.uid()))
    THEN (
      COALESCE((SELECT SUM(pa.amount) FROM public.payment_allocations pa WHERE pa.invoice_id = i.id), 0) + 
      COALESCE((SELECT SUM(py.amount) FROM public.payments py WHERE py.invoice_id = i.id AND py.status IN ('completed', 'paid', 'success')), 0)
    )
    ELSE NULL
  END as amount_paid_total,
  CASE
    WHEN has_role(auth.uid(), 'Admin'::app_role) OR t.user_id = auth.uid() OR
         EXISTS (SELECT 1 FROM public.properties p2
                 JOIN public.units u2 ON p2.id = u2.property_id
                 JOIN public.leases l2 ON u2.id = l2.unit_id
                 WHERE l2.id = i.lease_id AND (p2.owner_id = auth.uid() OR p2.manager_id = auth.uid()))
    THEN i.amount - (
      COALESCE((SELECT SUM(pa.amount) FROM public.payment_allocations pa WHERE pa.invoice_id = i.id), 0) + 
      COALESCE((SELECT SUM(py.amount) FROM public.payments py WHERE py.invoice_id = i.id AND py.status IN ('completed', 'paid', 'success')), 0)
    )
    ELSE NULL
  END as outstanding_amount,
  -- Computed status
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

-- Ensure proper access to invoice_overview
REVOKE ALL ON public.invoice_overview FROM PUBLIC;
REVOKE ALL ON public.invoice_overview FROM anon;
GRANT SELECT ON public.invoice_overview TO authenticated;