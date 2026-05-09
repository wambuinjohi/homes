-- Fix infinite recursion in tenants table RLS policies
-- Drop all existing overlapping policies
DROP POLICY IF EXISTS "tenants_unified_access" ON public.tenants;
DROP POLICY IF EXISTS "Sub-users can view and manage tenants during landlord trial" ON public.tenants;
DROP POLICY IF EXISTS "tenants_insert_auth" ON public.tenants;

-- Create single unified policy using security definer functions to break recursion
CREATE POLICY "tenants_all_access"
ON public.tenants
FOR ALL
USING (
  -- Admins see everything
  public.has_role_safe(auth.uid(), 'Admin'::public.app_role)
  
  -- Tenants see their own record
  OR user_id = auth.uid()
  
  -- Landlords see tenants in their properties (using security definer function)
  OR public.can_access_tenant_as_landlord(id, auth.uid())
  
  -- Sub-users see tenants based on landlord trial or permissions (using security definer function)
  OR public.can_subuser_view_tenant(id, auth.uid())
)
WITH CHECK (
  -- Only admins, landlords, and tenants themselves can modify
  public.has_role_safe(auth.uid(), 'Admin'::public.app_role)
  OR user_id = auth.uid()
  OR public.can_access_tenant_as_landlord(id, auth.uid())
  OR public.can_subuser_view_tenant(id, auth.uid())
);