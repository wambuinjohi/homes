-- Add security logging for edge functions
CREATE OR REPLACE FUNCTION public.log_security_event(
  p_event_type TEXT,
  p_severity TEXT DEFAULT 'medium',
  p_details JSONB DEFAULT '{}',
  p_user_id UUID DEFAULT auth.uid(),
  p_ip_address INET DEFAULT NULL
) RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_event_id UUID;
BEGIN
  INSERT INTO public.security_events (
    event_type,
    severity,
    details,
    user_id,
    ip_address,
    created_at
  ) VALUES (
    p_event_type,
    p_severity,
    p_details,
    p_user_id,
    p_ip_address,
    now()
  )
  RETURNING id INTO v_event_id;
  
  RETURN v_event_id;
END;
$$;

-- Update mpesa_transactions to include better security tracking
ALTER TABLE public.mpesa_transactions ADD COLUMN IF NOT EXISTS initiated_by UUID;
ALTER TABLE public.mpesa_transactions ADD COLUMN IF NOT EXISTS authorized_by UUID;

-- Create index for security events performance  
CREATE INDEX IF NOT EXISTS idx_security_events_type_severity ON public.security_events(event_type, severity);
CREATE INDEX IF NOT EXISTS idx_security_events_user_created ON public.security_events(user_id, created_at);

-- Update RLS policy for mpesa_transactions to be more restrictive
DROP POLICY IF EXISTS "System can insert transactions" ON public.mpesa_transactions;
DROP POLICY IF EXISTS "System can update transactions" ON public.mpesa_transactions;
DROP POLICY IF EXISTS "Users can view their own transactions" ON public.mpesa_transactions;

CREATE POLICY "Authorized users can insert transactions" ON public.mpesa_transactions
FOR INSERT 
WITH CHECK (
  -- Allow system/service role operations
  auth.jwt() IS NULL
  OR 
  -- Allow if user is authorized for this transaction
  (
    initiated_by IS NOT NULL 
    AND initiated_by = auth.uid()
  )
);

CREATE POLICY "System can update transactions" ON public.mpesa_transactions
FOR UPDATE 
USING (
  -- Only system/callback can update transactions
  auth.jwt() IS NULL
);

CREATE POLICY "Users can view relevant transactions" ON public.mpesa_transactions
FOR SELECT 
USING (
  -- Admins can see all
  public.has_role(auth.uid(), 'Admin'::public.app_role)
  OR
  -- Users can see transactions they initiated
  initiated_by = auth.uid()
  OR
  -- Property owners can see transactions for their properties
  (
    invoice_id IS NOT NULL
    AND EXISTS (
      SELECT 1 
      FROM public.invoices inv
      JOIN public.leases l ON inv.lease_id = l.id
      JOIN public.units u ON l.unit_id = u.id
      JOIN public.properties p ON u.property_id = p.id
      WHERE inv.id = mpesa_transactions.invoice_id
        AND (p.owner_id = auth.uid() OR p.manager_id = auth.uid())
    )
  )
  OR
  -- Tenants can see their own payment transactions
  (
    invoice_id IS NOT NULL
    AND EXISTS (
      SELECT 1
      FROM public.invoices inv
      JOIN public.tenants t ON inv.tenant_id = t.id
      WHERE inv.id = mpesa_transactions.invoice_id
        AND t.user_id = auth.uid()
    )
  )
);