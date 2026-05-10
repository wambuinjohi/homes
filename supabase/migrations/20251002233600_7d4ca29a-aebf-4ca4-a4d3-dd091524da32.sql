
-- Drop ALL existing policies on properties table
DROP POLICY IF EXISTS "Properties - delete access" ON public.properties;
DROP POLICY IF EXISTS "Properties - insert access" ON public.properties;
DROP POLICY IF EXISTS "Properties - select access" ON public.properties;
DROP POLICY IF EXISTS "Properties - update access" ON public.properties;
DROP POLICY IF EXISTS "Property managers can manage assigned properties" ON public.properties;
DROP POLICY IF EXISTS "Property owners can manage their own properties" ON public.properties;
DROP POLICY IF EXISTS "Property owners can manage their properties" ON public.properties;
DROP POLICY IF EXISTS "Property stakeholders and sub-users can manage properties" ON public.properties;
DROP POLICY IF EXISTS "tenants_can_view_their_properties" ON public.properties;
DROP POLICY IF EXISTS "Sub-users can view assigned properties" ON public.properties;
DROP POLICY IF EXISTS "Owners can manage their properties" ON public.properties;
DROP POLICY IF EXISTS "Managers can view assigned properties" ON public.properties;
DROP POLICY IF EXISTS "Admins can manage all properties" ON public.properties;
DROP POLICY IF EXISTS "Property stakeholders can manage properties" ON public.properties;
DROP POLICY IF EXISTS "Sub-users manage properties with permission" ON public.properties;

-- Drop ALL existing policies on units table
DROP POLICY IF EXISTS "Property stakeholders and sub-users can manage units" ON public.units;
DROP POLICY IF EXISTS "Property stakeholders can manage their units" ON public.units;
DROP POLICY IF EXISTS "Tenants can view their own units" ON public.units;
DROP POLICY IF EXISTS "Units - delete access" ON public.units;
DROP POLICY IF EXISTS "Units - insert access" ON public.units;
DROP POLICY IF EXISTS "Units - select access" ON public.units;
DROP POLICY IF EXISTS "Units - update access" ON public.units;
DROP POLICY IF EXISTS "Sub-users manage units with permission" ON public.units;
DROP POLICY IF EXISTS "Property stakeholders can manage units" ON public.units;
DROP POLICY IF EXISTS "Tenants can view their unit" ON public.units;

-- CREATE NEW POLICIES FOR PROPERTIES

-- SELECT: Admin, owner, manager, or sub-user whose landlord owns/manages
CREATE POLICY "Properties - select access"
ON public.properties FOR SELECT
USING (
  has_role(auth.uid(), 'Admin'::app_role)
  OR owner_id = auth.uid()
  OR manager_id = auth.uid()
  OR (
    (owner_id = get_sub_user_landlord(auth.uid()) OR manager_id = get_sub_user_landlord(auth.uid()))
    AND (
      get_landlord_trial_status(get_sub_user_landlord(auth.uid()))
      OR get_sub_user_permissions(auth.uid(), 'manage_properties')
      OR get_sub_user_permissions(auth.uid(), 'manage_tenants')
      OR get_sub_user_permissions(auth.uid(), 'manage_leases')
      OR get_sub_user_permissions(auth.uid(), 'manage_maintenance')
      OR get_sub_user_permissions(auth.uid(), 'view_reports')
    )
  )
);

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

-- CREATE NEW POLICIES FOR UNITS

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
