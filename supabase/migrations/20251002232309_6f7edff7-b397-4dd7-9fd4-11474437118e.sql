-- Fix RLS policies to support sub-users accessing landlord's properties/units/tenants/leases
-- Allow sub-users to see data when landlord is either owner or manager

-- Update properties RLS for sub-users
DROP POLICY IF EXISTS "Sub-users manage properties with permission" ON public.properties;
CREATE POLICY "Sub-users manage properties with permission" 
ON public.properties
FOR ALL
USING (
  has_role(auth.uid(), 'Admin'::public.app_role) 
  OR (owner_id = auth.uid() OR manager_id = auth.uid())
  OR (
    (owner_id = get_sub_user_landlord(auth.uid()) OR manager_id = get_sub_user_landlord(auth.uid()))
    AND get_sub_user_permissions(auth.uid(), 'manage_properties')
  )
);

-- Update units RLS for sub-users
DROP POLICY IF EXISTS "Sub-users manage units with permission" ON public.units;
CREATE POLICY "Sub-users manage units with permission" 
ON public.units
FOR ALL
USING (
  has_role(auth.uid(), 'Admin'::public.app_role) 
  OR EXISTS (
    SELECT 1 FROM public.properties p 
    WHERE p.id = units.property_id 
    AND (
      p.owner_id = auth.uid() 
      OR p.manager_id = auth.uid()
      OR (
        (p.owner_id = get_sub_user_landlord(auth.uid()) OR p.manager_id = get_sub_user_landlord(auth.uid()))
        AND get_sub_user_permissions(auth.uid(), 'manage_properties')
      )
    )
  )
);

-- Update tenants RLS for sub-users
DROP POLICY IF EXISTS "Sub-users manage tenants with permission" ON public.tenants;
CREATE POLICY "Sub-users manage tenants with permission" 
ON public.tenants
FOR ALL
USING (
  has_role(auth.uid(), 'Admin'::public.app_role)
  OR can_subuser_view_tenant(id, auth.uid())
  OR (
    EXISTS (
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
  )
  OR (user_id = auth.uid())
);

-- Update leases RLS for sub-users
DROP POLICY IF EXISTS "Sub-users manage leases with permission" ON public.leases;
CREATE POLICY "Sub-users manage leases with permission" 
ON public.leases
FOR ALL
USING (
  has_role(auth.uid(), 'Admin'::public.app_role) 
  OR EXISTS (
    SELECT 1 FROM public.units u
    JOIN public.properties p ON u.property_id = p.id
    WHERE u.id = leases.unit_id 
    AND (
      p.owner_id = auth.uid() 
      OR p.manager_id = auth.uid()
      OR (
        (p.owner_id = get_sub_user_landlord(auth.uid()) OR p.manager_id = get_sub_user_landlord(auth.uid()))
        AND get_sub_user_permissions(auth.uid(), 'manage_leases')
      )
    )
  )
  OR EXISTS (
    SELECT 1 FROM public.tenants t
    WHERE t.id = leases.tenant_id AND t.user_id = auth.uid()
  )
);