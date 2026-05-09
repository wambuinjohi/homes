-- Fix the infinite recursion in the "Property owners can manage their tenants" policy
-- The issue is the EXISTS subquery that references the tenants table from within the tenants table policy

-- First, drop the problematic policy
DROP POLICY IF EXISTS "Property owners can manage their tenants" ON public.tenants;

-- Create a security definer function to check if user can manage a specific tenant
CREATE OR REPLACE FUNCTION public.can_user_manage_tenant(_user_id uuid, _tenant_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.leases l
    JOIN public.units u ON l.unit_id = u.id
    JOIN public.properties p ON u.property_id = p.id
    WHERE l.tenant_id = _tenant_id 
      AND (p.owner_id = _user_id OR p.manager_id = _user_id)
  ) OR EXISTS (
    SELECT 1
    FROM public.user_roles ur
    WHERE ur.user_id = _user_id AND ur.role = 'Admin'
  );
$$;

-- Recreate the policy using the security definer function
CREATE POLICY "Property owners can manage their tenants" ON public.tenants
FOR ALL
USING (public.can_user_manage_tenant(auth.uid(), id));