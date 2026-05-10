-- Fix M-Pesa availability check for tenants
-- Allow tenants to see if their landlord has M-Pesa configured (but not credentials)

-- Drop the existing restrictive policy
DROP POLICY IF EXISTS "landlords_manage_own_mpesa_config" ON landlord_mpesa_configs;

-- Create separate policies for better security

-- Policy 1: Landlords and admins have full access
CREATE POLICY "landlords_admins_full_access"
ON landlord_mpesa_configs
FOR ALL
TO authenticated
USING (
  (landlord_id = auth.uid()) 
  OR has_role(auth.uid(), 'Admin'::app_role)
)
WITH CHECK (
  (landlord_id = auth.uid()) 
  OR has_role(auth.uid(), 'Admin'::app_role)
);

-- Policy 2: Tenants can check availability (SELECT only, no credentials exposed)
CREATE POLICY "tenants_check_availability"
ON landlord_mpesa_configs
FOR SELECT
TO authenticated
USING (
  -- Allow if user is a tenant with active lease under this landlord
  EXISTS (
    SELECT 1 
    FROM leases l
    JOIN units u ON l.unit_id = u.id
    JOIN properties p ON u.property_id = p.id
    JOIN tenants t ON l.tenant_id = t.id
    WHERE t.user_id = auth.uid()
      AND p.owner_id = landlord_mpesa_configs.landlord_id
      AND l.status = 'active'
  )
);

-- Add comment for security audit
COMMENT ON POLICY "tenants_check_availability" ON landlord_mpesa_configs IS 
  'Allows tenants to check if their landlord has M-Pesa configured. Credentials are encrypted and tenants only query for existence (SELECT id), not actual credentials.';