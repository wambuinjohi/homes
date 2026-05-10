-- Drop old recursive policies on leases table that cause infinite recursion
DROP POLICY IF EXISTS "leases_select_policy" ON public.leases;
DROP POLICY IF EXISTS "leases_insert_policy" ON public.leases;
DROP POLICY IF EXISTS "leases_update_policy" ON public.leases;
DROP POLICY IF EXISTS "leases_delete_policy" ON public.leases;

-- Add dedicated tenant access policy for leases (non-recursive)
CREATE POLICY "Tenants can view their own leases"
ON public.leases
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1
    FROM public.tenants t
    WHERE t.id = leases.tenant_id
      AND t.user_id = auth.uid()
  )
);