-- Remove trial bypass for sub-users in RLS policies
-- Sub-users should ALWAYS be restricted to their assigned permissions

-- Update leases policy to remove trial bypass
DROP POLICY IF EXISTS "Sub-users can view and manage leases during landlord trial" ON leases;

CREATE POLICY "Sub-users can manage leases with permission"
ON leases
FOR ALL
USING (
  has_role(auth.uid(), 'Admin'::app_role)
  OR (
    EXISTS (
      SELECT 1 FROM units u
      JOIN properties p ON u.property_id = p.id
      WHERE u.id = leases.unit_id
        AND (
          p.owner_id = auth.uid()
          OR p.manager_id = auth.uid()
          OR (
            p.owner_id = get_sub_user_landlord(auth.uid())
            AND get_sub_user_permissions(auth.uid(), 'manage_leases')
          )
        )
    )
  )
  OR (
    EXISTS (
      SELECT 1 FROM tenants t
      WHERE t.id = leases.tenant_id
        AND t.user_id = auth.uid()
    )
  )
);

-- Update maintenance_requests policy to remove trial bypass
DROP POLICY IF EXISTS "Sub-users can view and manage maintenance during landlord trial" ON maintenance_requests;

CREATE POLICY "Sub-users can manage maintenance with permission"
ON maintenance_requests
FOR ALL
USING (
  has_role(auth.uid(), 'Admin'::app_role)
  OR (
    EXISTS (
      SELECT 1 FROM properties p
      WHERE p.id = maintenance_requests.property_id
        AND (
          p.owner_id = auth.uid()
          OR p.manager_id = auth.uid()
          OR (
            p.owner_id = get_sub_user_landlord(auth.uid())
            AND get_sub_user_permissions(auth.uid(), 'manage_maintenance')
          )
        )
    )
  )
  OR (
    EXISTS (
      SELECT 1 FROM tenants t
      WHERE t.id = maintenance_requests.tenant_id
        AND t.user_id = auth.uid()
    )
  )
);

-- Update expenses policy to remove trial bypass
DROP POLICY IF EXISTS "Property stakeholders and sub-users can manage expenses" ON expenses;

CREATE POLICY "Sub-users can manage expenses with permission"
ON expenses
FOR ALL
USING (
  has_role(auth.uid(), 'Admin'::app_role)
  OR (
    EXISTS (
      SELECT 1 FROM properties p
      WHERE p.id = expenses.property_id
        AND (
          p.owner_id = auth.uid()
          OR p.manager_id = auth.uid()
          OR (
            p.owner_id = get_sub_user_landlord(auth.uid())
            AND get_sub_user_permissions(auth.uid(), 'manage_expenses')
          )
        )
    )
  )
);