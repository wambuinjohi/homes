-- Fix infinite recursion in tenants RLS policy
-- Remove the can_subuser_view_tenant function call that causes recursion

DROP POLICY IF EXISTS "Sub-users manage tenants with permission" ON public.tenants;

CREATE POLICY "Sub-users manage tenants with permission" 
ON public.tenants
FOR ALL
USING (
  has_role(auth.uid(), 'Admin'::public.app_role)
  OR (user_id = auth.uid())
  OR EXISTS (
    SELECT 1 FROM public.leases l
    JOIN public.units u ON l.unit_id = u.id
    JOIN public.properties p ON u.property_id = p.id
    WHERE l.tenant_id = tenants.id
    AND (
      p.owner_id = auth.uid() 
      OR p.manager_id = auth.uid()
      OR (
        (p.owner_id = get_sub_user_landlord(auth.uid()) OR p.manager_id = get_sub_user_landlord(auth.uid()))
        AND get_sub_user_permissions(auth.uid(), 'manage_tenants')
      )
    )
  )
);