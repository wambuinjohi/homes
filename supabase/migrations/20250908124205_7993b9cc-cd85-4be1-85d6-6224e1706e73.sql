-- Final Comprehensive Security Fix: Direct RLS Policies Without Complex Dependencies

-- 1. Fix tenants table with direct, simple RLS policy
DROP POLICY IF EXISTS "Enhanced tenant data protection" ON public.tenants;
DROP POLICY IF EXISTS "Admins can manage all tenants" ON public.tenants;
DROP POLICY IF EXISTS "Property owners can manage their tenants" ON public.tenants;
DROP POLICY IF EXISTS "Tenants can update own record" ON public.tenants;
DROP POLICY IF EXISTS "Tenants can view own record" ON public.tenants;
DROP POLICY IF EXISTS "Tenants can view their own info" ON public.tenants;

-- Simple, direct tenant access policy
CREATE POLICY "Restrict tenant access" ON public.tenants
  FOR ALL TO authenticated
  USING (
    -- Admins can access all
    has_role(auth.uid(), 'Admin'::app_role) OR
    -- Users can only access their own tenant record
    (user_id = auth.uid()) OR
    -- Property owners can access tenants via direct property relationship
    EXISTS (
      SELECT 1 FROM public.leases l
      JOIN public.units u ON l.unit_id = u.id
      JOIN public.properties p ON u.property_id = p.id
      WHERE l.tenant_id = tenants.id 
        AND (p.owner_id = auth.uid() OR p.manager_id = auth.uid())
    )
  )
  WITH CHECK (
    has_role(auth.uid(), 'Admin'::app_role) OR
    EXISTS (
      SELECT 1 FROM public.leases l
      JOIN public.units u ON l.unit_id = u.id
      JOIN public.properties p ON u.property_id = p.id
      WHERE l.tenant_id = tenants.id 
        AND (p.owner_id = auth.uid() OR p.manager_id = auth.uid())
    )
  );

-- 2. Fix mpesa_credentials with simple ownership policy
DROP POLICY IF EXISTS "Strict credential access control" ON public.mpesa_credentials;
DROP POLICY IF EXISTS "Landlords manage mpesa credentials" ON public.mpesa_credentials;
DROP POLICY IF EXISTS "Landlords manage their M-Pesa credentials" ON public.mpesa_credentials;

CREATE POLICY "Credentials owner access only" ON public.mpesa_credentials
  FOR ALL TO authenticated
  USING (
    has_role(auth.uid(), 'Admin'::app_role) OR
    (landlord_id = auth.uid())
  )
  WITH CHECK (
    has_role(auth.uid(), 'Admin'::app_role) OR
    (landlord_id = auth.uid())
  );

-- 3. Fix landlord_payment_preferences if it exists
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'landlord_payment_preferences') THEN
    -- Drop any existing policies
    EXECUTE 'DROP POLICY IF EXISTS "Landlord payment preferences access" ON public.landlord_payment_preferences';
    
    -- Create simple ownership policy
    EXECUTE 'CREATE POLICY "Landlord payment preferences access" ON public.landlord_payment_preferences
      FOR ALL TO authenticated
      USING (
        has_role(auth.uid(), ''Admin''::app_role) OR
        (landlord_id = auth.uid())
      )
      WITH CHECK (
        has_role(auth.uid(), ''Admin''::app_role) OR
        (landlord_id = auth.uid())
      )';
  END IF;
END $$;

-- 4. Fix sms_usage with simple policy
DROP POLICY IF EXISTS "Restrict SMS usage access" ON public.sms_usage;
DROP POLICY IF EXISTS "Admins can view SMS usage with masked data" ON public.sms_usage;
DROP POLICY IF EXISTS "Landlords can insert their own SMS usage" ON public.sms_usage;
DROP POLICY IF EXISTS "Landlords can view their own SMS usage" ON public.sms_usage;
DROP POLICY IF EXISTS "Prevent unauthorized SMS usage deletes" ON public.sms_usage;
DROP POLICY IF EXISTS "Prevent unauthorized SMS usage updates" ON public.sms_usage;
DROP POLICY IF EXISTS "System can insert SMS usage records" ON public.sms_usage;

CREATE POLICY "SMS usage access control" ON public.sms_usage
  FOR ALL TO authenticated
  USING (
    has_role(auth.uid(), 'Admin'::app_role) OR
    (landlord_id = auth.uid())
  )
  WITH CHECK (
    has_role(auth.uid(), 'Admin'::app_role) OR
    (landlord_id = auth.uid())
  );

-- 5. Fix mpesa_transactions with direct relationship checks
DROP POLICY IF EXISTS "Enhanced transaction access control" ON public.mpesa_transactions;
DROP POLICY IF EXISTS "Authorized users can insert transactions" ON public.mpesa_transactions;
DROP POLICY IF EXISTS "System can update transactions" ON public.mpesa_transactions;
DROP POLICY IF EXISTS "Users can view relevant transactions" ON public.mpesa_transactions;

CREATE POLICY "Transaction access control" ON public.mpesa_transactions
  FOR SELECT TO authenticated
  USING (
    has_role(auth.uid(), 'Admin'::app_role) OR
    (initiated_by = auth.uid()) OR
    -- Property owners can see transactions for their property invoices
    (invoice_id IS NOT NULL AND EXISTS (
      SELECT 1 FROM public.invoices inv
      JOIN public.leases l ON inv.lease_id = l.id
      JOIN public.units u ON l.unit_id = u.id
      JOIN public.properties p ON u.property_id = p.id
      WHERE inv.id = mpesa_transactions.invoice_id 
        AND (p.owner_id = auth.uid() OR p.manager_id = auth.uid())
    )) OR
    -- Tenants can see transactions for their invoices
    (invoice_id IS NOT NULL AND EXISTS (
      SELECT 1 FROM public.invoices inv
      JOIN public.tenants t ON inv.tenant_id = t.id
      WHERE inv.id = mpesa_transactions.invoice_id AND t.user_id = auth.uid()
    ))
  );

-- Allow system to insert/update transactions (for callbacks)
CREATE POLICY "System transaction operations" ON public.mpesa_transactions
  FOR INSERT TO authenticated
  WITH CHECK (true);

CREATE POLICY "System transaction updates" ON public.mpesa_transactions
  FOR UPDATE TO authenticated
  USING (true);

-- 6. Create a completely new, ultra-secure invoice_overview
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
  -- Only show tenant names to authorized users, NULL otherwise
  CASE 
    WHEN has_role(auth.uid(), 'Admin'::app_role) OR 
         t.user_id = auth.uid() OR
         EXISTS (SELECT 1 FROM public.properties p 
                JOIN public.units u2 ON p.id = u2.property_id
                JOIN public.leases l2 ON u2.id = l2.unit_id
                WHERE l2.id = i.lease_id AND (p.owner_id = auth.uid() OR p.manager_id = auth.uid()))
    THEN t.first_name
    ELSE NULL
  END as first_name,
  CASE 
    WHEN has_role(auth.uid(), 'Admin'::app_role) OR 
         t.user_id = auth.uid() OR
         EXISTS (SELECT 1 FROM public.properties p 
                JOIN public.units u2 ON p.id = u2.property_id
                JOIN public.leases l2 ON u2.id = l2.unit_id
                WHERE l2.id = i.lease_id AND (p.owner_id = auth.uid() OR p.manager_id = auth.uid()))
    THEN t.last_name
    ELSE NULL
  END as last_name,
  -- Mask email and phone for unauthorized users
  CASE 
    WHEN has_role(auth.uid(), 'Admin'::app_role) OR 
         t.user_id = auth.uid() OR
         EXISTS (SELECT 1 FROM public.properties p 
                JOIN public.units u2 ON p.id = u2.property_id
                JOIN public.leases l2 ON u2.id = l2.unit_id
                WHERE l2.id = i.lease_id AND (p.owner_id = auth.uid() OR p.manager_id = auth.uid()))
    THEN t.email
    ELSE NULL
  END as email,
  CASE 
    WHEN has_role(auth.uid(), 'Admin'::app_role) OR 
         t.user_id = auth.uid() OR
         EXISTS (SELECT 1 FROM public.properties p 
                JOIN public.units u2 ON p.id = u2.property_id
                JOIN public.leases l2 ON u2.id = l2.unit_id
                WHERE l2.id = i.lease_id AND (p.owner_id = auth.uid() OR p.manager_id = auth.uid()))
    THEN t.phone
    ELSE NULL
  END as phone,
  -- Property info
  u.unit_number,
  p.id as property_id,
  p.name as property_name,
  p.owner_id as property_owner_id,
  p.manager_id as property_manager_id,
  -- Simplified payment calculations (no complex subqueries in CASE statements)
  COALESCE((SELECT SUM(pa.amount) FROM public.payment_allocations pa WHERE pa.invoice_id = i.id), 0) as amount_paid_allocated,
  COALESCE((SELECT SUM(py.amount) FROM public.payments py WHERE py.invoice_id = i.id AND py.status IN ('completed', 'paid', 'success')), 0) as amount_paid_direct,
  COALESCE((SELECT SUM(pa.amount) FROM public.payment_allocations pa WHERE pa.invoice_id = i.id), 0) + 
  COALESCE((SELECT SUM(py.amount) FROM public.payments py WHERE py.invoice_id = i.id AND py.status IN ('completed', 'paid', 'success')), 0) as amount_paid_total,
  i.amount - (
    COALESCE((SELECT SUM(pa.amount) FROM public.payment_allocations pa WHERE pa.invoice_id = i.id), 0) + 
    COALESCE((SELECT SUM(py.amount) FROM public.payments py WHERE py.invoice_id = i.id AND py.status IN ('completed', 'paid', 'success')), 0)
  ) as outstanding_amount,
  -- Computed status
  CASE 
    WHEN i.amount <= (
      COALESCE((SELECT SUM(pa.amount) FROM public.payment_allocations pa WHERE pa.invoice_id = i.id), 0) + 
      COALESCE((SELECT SUM(py.amount) FROM public.payments py WHERE py.invoice_id = i.id AND py.status IN ('completed', 'paid', 'success')), 0)
    ) THEN 'paid'
    WHEN i.due_date < CURRENT_DATE THEN 'overdue'
    ELSE i.status
  END as computed_status
FROM public.invoices i
JOIN public.tenants t ON i.tenant_id = t.id
JOIN public.leases l ON i.lease_id = l.id
JOIN public.units u ON l.unit_id = u.id
JOIN public.properties p ON u.property_id = p.id;

-- Secure invoice_overview access
REVOKE ALL ON public.invoice_overview FROM PUBLIC;
REVOKE ALL ON public.invoice_overview FROM anon;
GRANT SELECT ON public.invoice_overview TO authenticated;