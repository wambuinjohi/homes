-- Add RLS policy to allow tenants to view their own units
CREATE POLICY "Tenants can view their own units" 
ON public.units 
FOR SELECT 
USING (
  EXISTS (
    SELECT 1 
    FROM leases l 
    JOIN tenants t ON t.id = l.tenant_id 
    WHERE l.unit_id = units.id 
    AND t.user_id = auth.uid()
  )
);