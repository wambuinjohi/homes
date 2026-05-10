-- Fix infinite recursion in leases and tenants RLS policies
-- Creates security definer functions to break circular dependencies

-- Step 1: Drop ALL existing policies on tenants and leases first
DROP POLICY IF EXISTS "Owners/managers can view tenants" ON public.tenants;
DROP POLICY IF EXISTS "Property owners can manage their tenants" ON public.tenants;
DROP POLICY IF EXISTS "Sub-users manage tenants with permission" ON public.tenants;
DROP POLICY IF EXISTS "Tenants can view their own info" ON public.tenants;
DROP POLICY IF EXISTS "tenants_insert_auth" ON public.tenants;
DROP POLICY IF EXISTS "tenants_select_auth" ON public.tenants;
DROP POLICY IF EXISTS "tenants_safe_access" ON public.tenants;
DROP POLICY IF EXISTS "tenants_all_access" ON public.tenants;
DROP POLICY IF EXISTS "tenants_access_v2" ON public.tenants;

DROP POLICY IF EXISTS "Owners/managers can view leases" ON public.leases;
DROP POLICY IF EXISTS "Owners/managers can insert leases" ON public.leases;
DROP POLICY IF EXISTS "Owners/managers can update leases" ON public.leases;
DROP POLICY IF EXISTS "Owners/managers can delete leases" ON public.leases;
DROP POLICY IF EXISTS "Sub-users manage leases with permission" ON public.leases;
DROP POLICY IF EXISTS "Tenants can view own leases" ON public.leases;
DROP POLICY IF EXISTS "leases_insert_auth" ON public.leases;
DROP POLICY IF EXISTS "leases_select_auth" ON public.leases;
DROP POLICY IF EXISTS "leases_safe_access" ON public.leases;
DROP POLICY IF EXISTS "Admins can manage all leases" ON public.leases;
DROP POLICY IF EXISTS "leases_access_v2" ON public.leases;

-- Step 2: Now drop and recreate functions
DROP FUNCTION IF EXISTS public.can_subuser_view_tenant(uuid, uuid);
DROP FUNCTION IF EXISTS public.tenant_belongs_to_user(uuid, uuid);
DROP FUNCTION IF EXISTS public.user_can_access_property(uuid, uuid);
DROP FUNCTION IF EXISTS public.get_tenant_property_ids(uuid);

-- Step 3: Create helper security definer functions

-- Function to get property IDs where tenant has active leases
CREATE FUNCTION public.get_tenant_property_ids(_tenant_id uuid)
RETURNS uuid[]
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT ARRAY_AGG(DISTINCT u.property_id)
  FROM public.leases l
  JOIN public.units u ON u.id = l.unit_id
  WHERE l.tenant_id = _tenant_id
    AND COALESCE(l.status, 'active') = 'active';
$$;

-- Function to check if user can access a property
CREATE FUNCTION public.user_can_access_property(_property_id uuid, _user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.properties p
    WHERE p.id = _property_id
      AND (
        p.owner_id = _user_id
        OR p.manager_id = _user_id
        OR (
          (p.owner_id = public.get_sub_user_landlord(_user_id) OR p.manager_id = public.get_sub_user_landlord(_user_id))
          AND public.get_sub_user_permissions(_user_id, 'manage_properties')
        )
      )
  );
$$;

-- Function to check if tenant belongs to user (via properties)
CREATE FUNCTION public.tenant_belongs_to_user(_tenant_id uuid, _user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM unnest(public.get_tenant_property_ids(_tenant_id)) AS property_id
    WHERE public.user_can_access_property(property_id, _user_id)
  );
$$;

-- Function to check if sub-user can view tenant
CREATE FUNCTION public.can_subuser_view_tenant(_tenant_id uuid, _user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE(
    bool_or(public.user_can_access_property(property_id, _user_id)),
    false
  )
  FROM unnest(public.get_tenant_property_ids(_tenant_id)) AS property_id;
$$;

-- Step 4: Create new simplified policies for tenants
CREATE POLICY "tenants_access_v2" ON public.tenants
FOR ALL
USING (
  public.has_role_safe(auth.uid(), 'Admin'::public.app_role)
  OR user_id = auth.uid()
  OR public.tenant_belongs_to_user(id, auth.uid())
);

-- Step 5: Create new simplified policies for leases
CREATE POLICY "leases_access_v2" ON public.leases
FOR ALL
USING (
  public.has_role_safe(auth.uid(), 'Admin'::public.app_role)
  OR EXISTS (
    SELECT 1 FROM public.units u
    WHERE u.id = leases.unit_id
    AND public.user_can_access_property(u.property_id, auth.uid())
  )
  OR EXISTS (
    SELECT 1 FROM public.tenants t
    WHERE t.id = leases.tenant_id
    AND t.user_id = auth.uid()
  )
);