-- Allow tenants to view payment preferences for their landlords
-- This enables tenants to check M-Pesa availability when making payments
CREATE POLICY "tenants_can_check_payment_preferences" 
ON landlord_payment_preferences
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1
    FROM leases l
    JOIN units u ON l.unit_id = u.id
    JOIN properties p ON u.property_id = p.id
    JOIN tenants t ON l.tenant_id = t.id
    WHERE t.user_id = auth.uid()
      AND p.owner_id = landlord_payment_preferences.landlord_id
      AND l.status = 'active'
  )
);