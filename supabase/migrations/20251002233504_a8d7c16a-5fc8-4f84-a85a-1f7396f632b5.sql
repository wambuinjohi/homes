
-- Fix RLS policies for properties table
DROP POLICY IF EXISTS "Sub-users can view assigned properties" ON public.properties;
DROP POLICY IF EXISTS "Owners can manage their properties" ON public.properties;
DROP POLICY IF EXISTS "Managers can view assigned properties" ON public.properties;
DROP POLICY IF EXISTS "Admins can manage all properties" ON public.properties;
DROP POLICY IF EXISTS "Property stakeholders can manage properties" ON public.properties;
DROP POLICY IF EXISTS "Sub-users manage properties with permission" ON public.properties;

-- SELECT: Admin, owner, manager, or sub-user whose landlord owns/manages
CREATE POLICY "Properties - select access"
ON public.properties FOR SELECT
USING (
  has_role(auth.uid(), 'Admin'::app_role)
  OR owner_id = auth.uid()
  OR manager_id = auth.uid()
  OR (
    -- Sub-user whose landlord owns or manages this property
    (owner_id = get_sub_user_landlord(auth.uid()) OR manager_id = get_sub_user_landlord(auth.uid()))
    AND (
      -- Either landlord is on trial (full access) or sub-user has relevant permission
      get_landlord_trial_status(get_sub_user_landlord(auth.uid()))
      OR get_sub_user_permissions(auth.uid(), 'manage_properties')
      OR get_sub_user_permissions(auth.uid(), 'manage_tenants')
      OR get_sub_user_permissions(auth.uid(), 'manage_leases')
      OR get_sub_user_permissions(auth.uid(), 'manage_maintenance')
      OR get_sub_user_permissions(auth.uid(), 'view_reports')
    )
  )
);

-- INSERT/UPDATE/DELETE: Only owner, manager, admin, or sub-user with manage_properties
CREATE POLICY "Properties - insert access"
ON public.properties FOR INSERT
WITH CHECK (
  has_role(auth.uid(), 'Admin'::app_role)
  OR owner_id = auth.uid()
  OR manager_id = auth.uid()
  OR (
    (owner_id = get_sub_user_landlord(auth.uid()) OR manager_id = get_sub_user_landlord(auth.uid()))
    AND get_sub_user_permissions(auth.uid(), 'manage_properties')
  )
);

CREATE POLICY "Properties - update access"
ON public.properties FOR UPDATE
USING (
  has_role(auth.uid(), 'Admin'::app_role)
  OR owner_id = auth.uid()
  OR manager_id = auth.uid()
  OR (
    (owner_id = get_sub_user_landlord(auth.uid()) OR manager_id = get_sub_user_landlord(auth.uid()))
    AND get_sub_user_permissions(auth.uid(), 'manage_properties')
  )
)
WITH CHECK (
  has_role(auth.uid(), 'Admin'::app_role)
  OR owner_id = auth.uid()
  OR manager_id = auth.uid()
  OR (
    (owner_id = get_sub_user_landlord(auth.uid()) OR manager_id = get_sub_user_landlord(auth.uid()))
    AND get_sub_user_permissions(auth.uid(), 'manage_properties')
  )
);

CREATE POLICY "Properties - delete access"
ON public.properties FOR DELETE
USING (
  has_role(auth.uid(), 'Admin'::app_role)
  OR owner_id = auth.uid()
  OR manager_id = auth.uid()
  OR (
    (owner_id = get_sub_user_landlord(auth.uid()) OR manager_id = get_sub_user_landlord(auth.uid()))
    AND get_sub_user_permissions(auth.uid(), 'manage_properties')
  )
);

-- Fix RLS policies for units table
DROP POLICY IF EXISTS "Sub-users manage units with permission" ON public.units;
DROP POLICY IF EXISTS "Property stakeholders can manage units" ON public.units;
DROP POLICY IF EXISTS "Tenants can view their unit" ON public.units;

-- SELECT: Admin, property owner/manager, tenant, or sub-user with access
CREATE POLICY "Units - select access"
ON public.units FOR SELECT
USING (
  has_role(auth.uid(), 'Admin'::app_role)
  OR EXISTS (
    SELECT 1 FROM properties p
    WHERE p.id = units.property_id
    AND (
      p.owner_id = auth.uid()
      OR p.manager_id = auth.uid()
      OR (
        (p.owner_id = get_sub_user_landlord(auth.uid()) OR p.manager_id = get_sub_user_landlord(auth.uid()))
        AND (
          get_landlord_trial_status(get_sub_user_landlord(auth.uid()))
          OR get_sub_user_permissions(auth.uid(), 'manage_properties')
          OR get_sub_user_permissions(auth.uid(), 'manage_tenants')
          OR get_sub_user_permissions(auth.uid(), 'manage_leases')
        )
      )
    )
  )
  OR EXISTS (
    SELECT 1 FROM leases l
    JOIN tenants t ON t.id = l.tenant_id
    WHERE l.unit_id = units.id
    AND t.user_id = auth.uid()
  )
);

-- INSERT/UPDATE/DELETE: Only property owner/manager, admin, or sub-user with manage_properties
CREATE POLICY "Units - insert access"
ON public.units FOR INSERT
WITH CHECK (
  has_role(auth.uid(), 'Admin'::app_role)
  OR EXISTS (
    SELECT 1 FROM properties p
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

CREATE POLICY "Units - update access"
ON public.units FOR UPDATE
USING (
  has_role(auth.uid(), 'Admin'::app_role)
  OR EXISTS (
    SELECT 1 FROM properties p
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
)
WITH CHECK (
  has_role(auth.uid(), 'Admin'::app_role)
  OR EXISTS (
    SELECT 1 FROM properties p
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

CREATE POLICY "Units - delete access"
ON public.units FOR DELETE
USING (
  has_role(auth.uid(), 'Admin'::app_role)
  OR EXISTS (
    SELECT 1 FROM properties p
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
