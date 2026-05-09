-- Remove duplicate INSERT policy on tenants table
DROP POLICY IF EXISTS "Landlords can insert tenants" ON public.tenants;

-- Verify only one INSERT policy remains
DO $$
DECLARE
  policy_count integer;
BEGIN
  SELECT COUNT(*) INTO policy_count
  FROM pg_policies
  WHERE tablename = 'tenants'
    AND cmd = 'INSERT';
  
  IF policy_count = 1 THEN
    RAISE NOTICE 'Successfully cleaned up duplicate INSERT policy. Only 1 INSERT policy remains.';
  ELSE
    RAISE WARNING 'Expected 1 INSERT policy but found %', policy_count;
  END IF;
END $$;