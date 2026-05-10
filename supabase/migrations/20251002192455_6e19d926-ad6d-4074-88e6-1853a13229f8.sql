-- Fix Sub-User Management System
-- Phase 1: Fix has_role ambiguity, add SubUser role, create permission enforcement

-- 1. Add SubUser to app_role enum if not exists
DO $$ BEGIN
  ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'SubUser';
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

-- 2. Create security definer function to get sub-user permissions
CREATE OR REPLACE FUNCTION public.get_sub_user_permissions(_user_id uuid, _permission text)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.sub_users
    WHERE user_id = _user_id
      AND status = 'active'
      AND (permissions->_permission)::boolean = true
  );
$$;

-- 3. Create function to check if user is a sub-user of a landlord
CREATE OR REPLACE FUNCTION public.is_sub_user_of_landlord(_user_id uuid, _landlord_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.sub_users
    WHERE user_id = _user_id
      AND landlord_id = _landlord_id
      AND status = 'active'
  );
$$;

-- 4. Create function to get sub-user's landlord
CREATE OR REPLACE FUNCTION public.get_sub_user_landlord(_user_id uuid)
RETURNS uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT landlord_id
  FROM public.sub_users
  WHERE user_id = _user_id
    AND status = 'active'
  LIMIT 1;
$$;

-- 5. Create view for admin to see sub-user relationships
CREATE OR REPLACE VIEW public.admin_sub_user_view AS
SELECT 
  su.id as sub_user_record_id,
  su.user_id,
  su.landlord_id,
  su.title,
  su.permissions,
  su.status,
  su.created_at,
  p.first_name as sub_user_first_name,
  p.last_name as sub_user_last_name,
  p.email as sub_user_email,
  lp.first_name as landlord_first_name,
  lp.last_name as landlord_last_name,
  lp.email as landlord_email
FROM public.sub_users su
LEFT JOIN public.profiles p ON su.user_id = p.id
LEFT JOIN public.profiles lp ON su.landlord_id = lp.id;

-- 6. Grant admin access to the view
GRANT SELECT ON public.admin_sub_user_view TO authenticated;

-- 7. Create RLS policy for admin_sub_user_view
CREATE POLICY "Admins can view all sub-user relationships"
ON public.sub_users
FOR SELECT
USING (has_role(auth.uid(), 'Admin'::app_role));

-- 8. Update properties RLS to allow sub-users with manage_properties permission
DROP POLICY IF EXISTS "Sub-users can view assigned properties" ON public.properties;
CREATE POLICY "Sub-users can view assigned properties"
ON public.properties
FOR SELECT
USING (
  owner_id = auth.uid() 
  OR manager_id = auth.uid() 
  OR has_role(auth.uid(), 'Admin'::app_role)
  OR (
    owner_id = get_sub_user_landlord(auth.uid())
    AND get_sub_user_permissions(auth.uid(), 'manage_properties')
  )
);

-- 9. Update tenants RLS for sub-users
DROP POLICY IF EXISTS "Sub-users can view tenants" ON public.tenants;
CREATE POLICY "Sub-users can view tenants"
ON public.tenants
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.leases l
    JOIN public.units u ON l.unit_id = u.id
    JOIN public.properties p ON u.property_id = p.id
    WHERE l.tenant_id = tenants.id
    AND (
      p.owner_id = auth.uid()
      OR p.manager_id = auth.uid()
      OR has_role(auth.uid(), 'Admin'::app_role)
      OR (
        p.owner_id = get_sub_user_landlord(auth.uid())
        AND get_sub_user_permissions(auth.uid(), 'manage_tenants')
      )
    )
  )
);

-- 10. Update leases RLS for sub-users
DROP POLICY IF EXISTS "Sub-users can view leases" ON public.leases;
CREATE POLICY "Sub-users can view leases"
ON public.leases
FOR SELECT
USING (
  EXISTS (
    SELECT 1
    FROM public.units u
    JOIN public.properties p ON u.property_id = p.id
    WHERE u.id = leases.unit_id
    AND (
      p.owner_id = auth.uid()
      OR p.manager_id = auth.uid()
      OR has_role(auth.uid(), 'Admin'::app_role)
      OR (
        p.owner_id = get_sub_user_landlord(auth.uid())
        AND get_sub_user_permissions(auth.uid(), 'manage_leases')
      )
    )
  )
);

-- 11. Update maintenance_requests RLS for sub-users
DROP POLICY IF EXISTS "Sub-users can view maintenance requests" ON public.maintenance_requests;
CREATE POLICY "Sub-users can view maintenance requests"
ON public.maintenance_requests
FOR SELECT
USING (
  EXISTS (
    SELECT 1
    FROM public.properties p
    WHERE p.id = maintenance_requests.property_id
    AND (
      p.owner_id = auth.uid()
      OR p.manager_id = auth.uid()
      OR has_role(auth.uid(), 'Admin'::app_role)
      OR (
        p.owner_id = get_sub_user_landlord(auth.uid())
        AND get_sub_user_permissions(auth.uid(), 'manage_maintenance')
      )
    )
  )
);

-- 12. Add index for performance
CREATE INDEX IF NOT EXISTS idx_sub_users_user_id_status ON public.sub_users(user_id, status);
CREATE INDEX IF NOT EXISTS idx_sub_users_landlord_id_status ON public.sub_users(landlord_id, status);

-- 13. Add comment documenting the permission model
COMMENT ON TABLE public.sub_users IS 'Stores sub-user relationships and permissions. Sub-users inherit access to their landlord''s properties based on granular permissions.';
COMMENT ON COLUMN public.sub_users.permissions IS 'JSONB object with boolean flags: manage_properties, manage_tenants, manage_leases, manage_maintenance, view_reports';