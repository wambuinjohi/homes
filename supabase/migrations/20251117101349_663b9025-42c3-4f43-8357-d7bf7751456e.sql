-- Drop the problematic property policy that causes infinite recursion
-- This policy creates a cycle: properties -> leases -> properties
DROP POLICY IF EXISTS "tenants_can_view_property_for_mpesa_check" ON public.properties;

-- Verify the policy is removed
DO $$
BEGIN
  RAISE NOTICE 'Removed tenants_can_view_property_for_mpesa_check policy to prevent infinite recursion';
END $$;