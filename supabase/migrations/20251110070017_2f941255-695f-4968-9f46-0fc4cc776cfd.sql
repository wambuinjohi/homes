-- Add RLS policy to allow tenants to view properties for M-Pesa availability checks
-- This allows tenants to read property information only for properties where they have active leases
-- This is required for the M-Pesa payment flow to determine the landlord's payment configuration

CREATE POLICY "tenants_can_view_property_for_mpesa_check" 
ON properties
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1
    FROM leases l
    JOIN units u ON l.unit_id = u.id
    JOIN tenants t ON l.tenant_id = t.id
    WHERE t.user_id = auth.uid()
      AND u.property_id = properties.id
      AND l.status = 'active'
  )
);