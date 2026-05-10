-- Final Security Fix: Clean RLS Policy Recreation with Unique Names

-- 1. Clean up all existing tenant policies and create new one with unique name
DO $$
DECLARE
    policy_name TEXT;
BEGIN
    -- Drop all existing policies on tenants table
    FOR policy_name IN 
        SELECT policyname FROM pg_policies WHERE tablename = 'tenants' AND schemaname = 'public'
    LOOP
        EXECUTE format('DROP POLICY IF EXISTS %I ON public.tenants', policy_name);
    END LOOP;
END $$;

-- Create comprehensive tenant access policy
CREATE POLICY "Secure tenant data access v2" ON public.tenants
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
    (user_id = auth.uid()) OR
    EXISTS (
      SELECT 1 FROM public.leases l
      JOIN public.units u ON l.unit_id = u.id
      JOIN public.properties p ON u.property_id = p.id
      WHERE l.tenant_id = tenants.id 
        AND (p.owner_id = auth.uid() OR p.manager_id = auth.uid())
    )
  );

-- 2. Clean up mpesa_credentials policies
DO $$
DECLARE
    policy_name TEXT;
BEGIN
    FOR policy_name IN 
        SELECT policyname FROM pg_policies WHERE tablename = 'mpesa_credentials' AND schemaname = 'public'
    LOOP
        EXECUTE format('DROP POLICY IF EXISTS %I ON public.mpesa_credentials', policy_name);
    END LOOP;
END $$;

CREATE POLICY "Secure credentials access v2" ON public.mpesa_credentials
  FOR ALL TO authenticated
  USING (
    has_role(auth.uid(), 'Admin'::app_role) OR
    (landlord_id = auth.uid())
  )
  WITH CHECK (
    has_role(auth.uid(), 'Admin'::app_role) OR
    (landlord_id = auth.uid())
  );

-- 3. Clean up sms_usage policies
DO $$
DECLARE
    policy_name TEXT;
BEGIN
    FOR policy_name IN 
        SELECT policyname FROM pg_policies WHERE tablename = 'sms_usage' AND schemaname = 'public'
    LOOP
        EXECUTE format('DROP POLICY IF EXISTS %I ON public.sms_usage', policy_name);
    END LOOP;
END $$;

CREATE POLICY "Secure SMS access v2" ON public.sms_usage
  FOR ALL TO authenticated
  USING (
    has_role(auth.uid(), 'Admin'::app_role) OR
    (landlord_id = auth.uid())
  )
  WITH CHECK (
    has_role(auth.uid(), 'Admin'::app_role) OR
    (landlord_id = auth.uid())
  );

-- 4. Clean up mpesa_transactions policies  
DO $$
DECLARE
    policy_name TEXT;
BEGIN
    FOR policy_name IN 
        SELECT policyname FROM pg_policies WHERE tablename = 'mpesa_transactions' AND schemaname = 'public'
    LOOP
        EXECUTE format('DROP POLICY IF EXISTS %I ON public.mpesa_transactions', policy_name);
    END LOOP;
END $$;

-- Create separate policies for different operations
CREATE POLICY "Secure transaction SELECT v2" ON public.mpesa_transactions
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

CREATE POLICY "Secure transaction INSERT v2" ON public.mpesa_transactions
  FOR INSERT TO authenticated
  WITH CHECK (
    has_role(auth.uid(), 'Admin'::app_role) OR
    (initiated_by = auth.uid()) OR
    (initiated_by IS NULL) -- Allow system inserts
  );

CREATE POLICY "Secure transaction UPDATE v2" ON public.mpesa_transactions
  FOR UPDATE TO authenticated
  USING (
    has_role(auth.uid(), 'Admin'::app_role) OR
    (initiated_by = auth.uid()) OR
    (initiated_by IS NULL) -- Allow system updates
  );

-- 5. Secure landlord_payment_preferences if it exists
DO $$
DECLARE
    policy_name TEXT;
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'landlord_payment_preferences') THEN
    -- Drop existing policies
    FOR policy_name IN 
        SELECT policyname FROM pg_policies WHERE tablename = 'landlord_payment_preferences' AND schemaname = 'public'
    LOOP
        EXECUTE format('DROP POLICY IF EXISTS %I ON public.landlord_payment_preferences', policy_name);
    END LOOP;
    
    -- Create secure policy
    EXECUTE 'CREATE POLICY "Secure payment preferences v2" ON public.landlord_payment_preferences
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