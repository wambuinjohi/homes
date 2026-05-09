-- Phase 1: Fix Tenants Recursion (CRITICAL)

-- 1. Create security definer function for sub-user tenant viewing
CREATE OR REPLACE FUNCTION public.can_subuser_view_tenant(_tenant_id uuid, _user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.leases l
    JOIN public.units u ON l.unit_id = u.id
    JOIN public.properties p ON u.property_id = p.id
    WHERE l.tenant_id = _tenant_id
      AND (p.owner_id = _user_id 
           OR p.manager_id = _user_id
           OR (p.owner_id = public.get_sub_user_landlord(_user_id) 
               AND public.get_sub_user_permissions(_user_id, 'manage_tenants')))
  );
$$;

-- 2. Drop problematic recursive policies on tenants
DROP POLICY IF EXISTS "Sub-users can view tenants" ON public.tenants;
DROP POLICY IF EXISTS "tenants_select_auth" ON public.tenants;
DROP POLICY IF EXISTS "tenants_safe_access" ON public.tenants;

-- 3. Create unified non-recursive policy for tenants
CREATE POLICY "tenants_unified_access" ON public.tenants
FOR ALL USING (
  public.has_role_safe(auth.uid(), 'Admin'::public.app_role)
  OR user_id = auth.uid()
  OR public.can_access_tenant_as_landlord(id, auth.uid())
  OR public.can_subuser_view_tenant(id, auth.uid())
);

-- Phase 2: Clean Up Profiles Policies

-- Drop existing policies to recreate them cleanly
DROP POLICY IF EXISTS "profiles_select_own_or_related" ON public.profiles;

-- Keep admin policy as-is, recreate simplified landlord policy
CREATE POLICY "profiles_select_own_or_related" ON public.profiles
FOR SELECT USING (
  id = auth.uid()
  OR (
    public.has_role_safe(auth.uid(), 'Landlord'::public.app_role)
    AND EXISTS (
      SELECT 1 FROM public.tenants t
      JOIN public.leases l ON l.tenant_id = t.id
      JOIN public.units u ON l.unit_id = u.id
      JOIN public.properties p ON u.property_id = p.id
      WHERE t.user_id = public.profiles.id
        AND (p.owner_id = auth.uid() OR p.manager_id = auth.uid())
    )
  )
);

-- Phase 3: Standardize user_roles Policies

-- Drop all existing user_roles policies
DROP POLICY IF EXISTS "Admins can manage all user roles" ON public.user_roles;
DROP POLICY IF EXISTS "Users can view their own roles" ON public.user_roles;
DROP POLICY IF EXISTS "user_roles_admin_all" ON public.user_roles;
DROP POLICY IF EXISTS "user_roles_select_own" ON public.user_roles;

-- Create clean, standardized policies using has_role_safe
CREATE POLICY "user_roles_admin_manages_all" ON public.user_roles
FOR ALL USING (
  public.has_role_safe(auth.uid(), 'Admin'::public.app_role)
);

CREATE POLICY "user_roles_users_view_own" ON public.user_roles
FOR SELECT USING (
  user_id = auth.uid()
);