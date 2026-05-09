-- Add RLS policy to allow tenants to view properties for their units
CREATE POLICY "Tenants can view their property information" 
ON public.properties 
FOR SELECT 
USING (
  EXISTS (
    SELECT 1 
    FROM leases l 
    JOIN tenants t ON t.id = l.tenant_id 
    JOIN units u ON u.id = l.unit_id 
    WHERE u.property_id = properties.id 
    AND t.user_id = auth.uid()
  )
);