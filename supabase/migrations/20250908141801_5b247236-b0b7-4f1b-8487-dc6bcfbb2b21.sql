-- FINAL SECURITY PATCH: Address Remaining Critical Issues
-- Complete the security remediation by fixing the last 3 ERROR-level vulnerabilities

-- 1. Strengthen tenant data access policies further
DROP POLICY IF EXISTS "Secure tenant data access v2" ON public.tenants;
CREATE POLICY "tenants_strict_access_control" 
  ON public.tenants 
  FOR ALL 
  TO authenticated
  USING (
    -- Only allow access if user is Admin, the tenant themselves, or direct property relationship
    has_role(auth.uid(), 'Admin'::app_role) 
    OR user_id = auth.uid() 
    OR (
      -- Property owners can only see tenants of their properties via active leases
      has_role(auth.uid(), 'Landlord'::app_role) AND EXISTS (
        SELECT 1 FROM public.leases l 
        JOIN public.units u ON l.unit_id = u.id 
        JOIN public.properties p ON u.property_id = p.id 
        WHERE l.tenant_id = tenants.id 
          AND (p.owner_id = auth.uid() OR p.manager_id = auth.uid())
          AND l.status = 'active'
          AND l.lease_start_date <= CURRENT_DATE
          AND (l.lease_end_date IS NULL OR l.lease_end_date >= CURRENT_DATE)
      )
    )
  )
  WITH CHECK (
    has_role(auth.uid(), 'Admin'::app_role) 
    OR user_id = auth.uid()
  );

-- 2. Create view for safe tenant data access (with automatic masking)
CREATE OR REPLACE VIEW public.tenant_safe_view AS
SELECT 
  id,
  user_id,
  first_name,
  last_name,
  -- Mask sensitive data unless user is admin or the tenant themselves
  CASE 
    WHEN has_role(auth.uid(), 'Admin'::app_role) OR user_id = auth.uid() THEN email
    ELSE public.mask_sensitive_data(email, 3)
  END as email,
  CASE 
    WHEN has_role(auth.uid(), 'Admin'::app_role) OR user_id = auth.uid() THEN phone
    ELSE public.mask_sensitive_data(phone, 4)
  END as phone,
  -- Never expose national ID except to admin or self
  CASE 
    WHEN has_role(auth.uid(), 'Admin'::app_role) OR user_id = auth.uid() THEN national_id
    ELSE '****'
  END as national_id,
  employment_status,
  employer_name,
  previous_address,
  created_at,
  updated_at
FROM public.tenants
WHERE (
  has_role(auth.uid(), 'Admin'::app_role) 
  OR user_id = auth.uid() 
  OR EXISTS (
    SELECT 1 FROM public.leases l 
    JOIN public.units u ON l.unit_id = u.id 
    JOIN public.properties p ON u.property_id = p.id 
    WHERE l.tenant_id = tenants.id 
      AND (p.owner_id = auth.uid() OR p.manager_id = auth.uid())
      AND l.status = 'active'
  )
);

-- Enable RLS on the view
ALTER VIEW public.tenant_safe_view SET (security_invoker = true);

-- 3. Restrict SMS usage access further
DROP POLICY IF EXISTS "Secure SMS access - landlord only" ON public.sms_usage;
CREATE POLICY "sms_usage_minimal_access" 
  ON public.sms_usage 
  FOR ALL 
  TO authenticated
  USING (
    -- Only admin and the specific landlord who sent the message
    has_role(auth.uid(), 'Admin'::app_role) 
    OR landlord_id = auth.uid()
  )
  WITH CHECK (
    has_role(auth.uid(), 'Admin'::app_role) 
    OR landlord_id = auth.uid()
  );

-- 4. Strengthen mpesa_transactions policies
DROP POLICY IF EXISTS "Secure transaction SELECT v2" ON public.mpesa_transactions;
DROP POLICY IF EXISTS "Secure transaction INSERT v2" ON public.mpesa_transactions;
DROP POLICY IF EXISTS "Secure transaction UPDATE v2" ON public.mpesa_transactions;

CREATE POLICY "mpesa_transactions_admin_only" 
  ON public.mpesa_transactions 
  FOR ALL 
  TO authenticated
  USING (has_role(auth.uid(), 'Admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'Admin'::app_role));

CREATE POLICY "mpesa_transactions_owner_readonly" 
  ON public.mpesa_transactions 
  FOR SELECT 
  TO authenticated
  USING (
    -- Allow landlords to see transactions for their properties only
    initiated_by = auth.uid() 
    OR (
      invoice_id IS NOT NULL AND EXISTS (
        SELECT 1 FROM public.invoices inv 
        JOIN public.leases l ON inv.lease_id = l.id 
        JOIN public.units u ON l.unit_id = u.id 
        JOIN public.properties p ON u.property_id = p.id 
        WHERE inv.id = mpesa_transactions.invoice_id 
          AND (p.owner_id = auth.uid() OR p.manager_id = auth.uid())
      )
    )
  );

-- 5. Create secure logging for sensitive operations
CREATE OR REPLACE FUNCTION public.log_sensitive_data_access(_table_name text, _operation text, _record_id uuid DEFAULT NULL)
RETURNS void 
LANGUAGE plpgsql 
SECURITY DEFINER 
SET search_path = public, pg_temp
AS $$
BEGIN
  INSERT INTO public.user_activity_logs (
    user_id, action, entity_type, entity_id, 
    details, performed_at
  ) VALUES (
    auth.uid(), _operation, _table_name, _record_id,
    jsonb_build_object(
      'table', _table_name,
      'sensitive_access', true,
      'timestamp', now()
    ),
    now()
  );
END;
$$;