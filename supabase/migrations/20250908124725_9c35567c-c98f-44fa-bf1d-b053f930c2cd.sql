-- Fix critical security vulnerability: Secure invoice_overview table
-- This table contains sensitive financial data and needs proper access controls

-- Enable RLS on invoice_overview
ALTER TABLE public.invoice_overview ENABLE ROW LEVEL SECURITY;

-- Policy 1: Admins can view all invoice data
CREATE POLICY "Admins can view all invoices" 
ON public.invoice_overview 
FOR SELECT 
USING (has_role(auth.uid(), 'Admin'::app_role));

-- Policy 2: Property owners can view invoices for their properties
CREATE POLICY "Property owners can view their property invoices" 
ON public.invoice_overview 
FOR SELECT 
USING (
  property_owner_id = auth.uid() 
  OR property_manager_id = auth.uid()
);

-- Policy 3: Tenants can view their own invoices
CREATE POLICY "Tenants can view their own invoices" 
ON public.invoice_overview 
FOR SELECT 
USING (
  EXISTS (
    SELECT 1 FROM public.tenants t 
    WHERE t.id = invoice_overview.tenant_id 
    AND t.user_id = auth.uid()
  )
);

-- Policy 4: Block all other access (implicit, but explicit for clarity)
-- No INSERT/UPDATE/DELETE policies needed as this appears to be a read-only view