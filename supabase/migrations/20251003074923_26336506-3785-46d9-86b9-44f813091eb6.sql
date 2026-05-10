-- Fix infinite recursion in units and leases RLS policies
-- Creates security definer functions to break circular dependencies

-- Step 1: Drop ALL existing policies for units and leases
DROP POLICY IF EXISTS "Units - select v3" ON public.units;
DROP POLICY IF EXISTS "Units - insert v3" ON public.units;
DROP POLICY IF EXISTS "Units - update v3" ON public.units;
DROP POLICY IF EXISTS "Units - delete v3" ON public.units;
DROP POLICY IF EXISTS "Units - select v2" ON public.units;
DROP POLICY IF EXISTS "Units - insert v2" ON public.units;
DROP POLICY IF EXISTS "Units - update v2" ON public.units;
DROP POLICY IF EXISTS "Units - delete v2" ON public.units;
DROP POLICY IF EXISTS "Property stakeholders can manage units" ON public.units;
DROP POLICY IF EXISTS "Sub-users manage units with permission" ON public.units;
DROP POLICY IF EXISTS "Tenants can view their own units" ON public.units;

DROP POLICY IF EXISTS "leases_access_v3" ON public.leases;
DROP POLICY IF EXISTS "leases_access_v2" ON public.leases;

-- Step 2: Create helper security definer functions

-- Function to check if unit belongs to tenant user (active lease)
CREATE OR REPLACE FUNCTION public.unit_belongs_to_tenant_user(_unit_id uuid, _user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.leases l
    JOIN public.tenants t ON t.id = l.tenant_id
    WHERE l.unit_id = _unit_id
      AND t.user_id = _user_id
      AND COALESCE(l.status, 'active') = 'active'
  );
$$;

-- Function to check if lease is owned by tenant user
CREATE OR REPLACE FUNCTION public.is_lease_owned_by_tenant_user(_lease_id uuid, _user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.leases l
    JOIN public.tenants t ON t.id = l.tenant_id
    WHERE l.id = _lease_id
      AND t.user_id = _user_id
  );
$$;

-- Step 3: Create new simplified policies for units (no direct lease table access)
CREATE POLICY "Units - select v3" ON public.units
FOR SELECT
USING (
  public.has_role_safe(auth.uid(), 'Admin'::public.app_role)
  OR public.user_can_access_property(property_id, auth.uid())
  OR public.unit_belongs_to_tenant_user(id, auth.uid())
);

CREATE POLICY "Units - insert v3" ON public.units
FOR INSERT
WITH CHECK (
  public.has_role_safe(auth.uid(), 'Admin'::public.app_role)
  OR public.user_can_access_property(property_id, auth.uid())
);

CREATE POLICY "Units - update v3" ON public.units
FOR UPDATE
USING (
  public.has_role_safe(auth.uid(), 'Admin'::public.app_role)
  OR public.user_can_access_property(property_id, auth.uid())
)
WITH CHECK (
  public.has_role_safe(auth.uid(), 'Admin'::public.app_role)
  OR public.user_can_access_property(property_id, auth.uid())
);

CREATE POLICY "Units - delete v3" ON public.units
FOR DELETE
USING (
  public.has_role_safe(auth.uid(), 'Admin'::public.app_role)
  OR public.user_can_access_property(property_id, auth.uid())
);

-- Step 4: Create new simplified policy for leases (no direct units table access)
CREATE POLICY "leases_access_v3" ON public.leases
FOR ALL
USING (
  public.has_role_safe(auth.uid(), 'Admin'::public.app_role)
  OR public.user_can_access_lease(id, auth.uid())
  OR public.is_lease_owned_by_tenant_user(id, auth.uid())
);