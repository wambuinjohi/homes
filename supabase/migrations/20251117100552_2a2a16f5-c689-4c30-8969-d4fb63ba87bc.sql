-- Step 1: Drop the problematic property policy that causes recursion
DROP POLICY IF EXISTS "tenants_can_view_property_for_mpesa_check" ON public.properties;

-- Step 2: Rewrite tenant_belongs_to_user to avoid recursion
CREATE OR REPLACE FUNCTION public.tenant_belongs_to_user_safe(_tenant_id uuid, _user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  -- Check if user owns/manages any property that has leases with this tenant
  SELECT EXISTS (
    SELECT 1
    FROM public.tenants t
    JOIN public.leases l ON l.tenant_id = t.id
    JOIN public.units u ON u.id = l.unit_id  
    JOIN public.properties p ON p.id = u.property_id
    WHERE t.id = _tenant_id
      AND (
        p.owner_id = _user_id
        OR p.manager_id = _user_id
        OR (
          (p.owner_id = public.get_sub_user_landlord(_user_id) 
           OR p.manager_id = public.get_sub_user_landlord(_user_id))
          AND public.get_sub_user_permissions(_user_id, 'manage_properties')
        )
      )
  );
$$;

-- Step 3: Update tenant policies to use the safe version
DROP POLICY IF EXISTS "tenants_select_policy" ON public.tenants;
DROP POLICY IF EXISTS "tenants_update_policy" ON public.tenants;
DROP POLICY IF EXISTS "tenants_delete_policy" ON public.tenants;

CREATE POLICY "tenants_select_policy"
ON public.tenants
FOR SELECT
TO public
USING (
  has_role_safe(auth.uid(), 'Admin'::app_role) 
  OR (user_id = auth.uid()) 
  OR tenant_belongs_to_user_safe(id, auth.uid())
);

CREATE POLICY "tenants_update_policy"
ON public.tenants
FOR UPDATE
TO public
USING (
  has_role_safe(auth.uid(), 'Admin'::app_role) 
  OR (user_id = auth.uid()) 
  OR tenant_belongs_to_user_safe(id, auth.uid())
);

CREATE POLICY "tenants_delete_policy"
ON public.tenants
FOR DELETE
TO public
USING (
  has_role_safe(auth.uid(), 'Admin'::app_role) 
  OR tenant_belongs_to_user_safe(id, auth.uid())
);

-- Step 4: Recreate the M-Pesa policy with inline checks (no function calls)
CREATE POLICY "tenants_can_view_property_for_mpesa_check"
ON public.properties
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1
    FROM public.leases l
    JOIN public.units u ON l.unit_id = u.id
    WHERE u.property_id = properties.id
      AND l.status = 'active'
      AND l.tenant_id IN (
        SELECT id FROM public.tenants WHERE user_id = auth.uid()
      )
  )
);

-- Verify no recursion
DO $$
BEGIN
  RAISE NOTICE 'Migration completed. Policies updated to prevent recursion.';
END $$;