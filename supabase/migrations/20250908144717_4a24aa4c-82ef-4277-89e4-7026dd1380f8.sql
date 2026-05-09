-- Create helper functions to break RLS recursion
CREATE OR REPLACE FUNCTION public.has_role_safe(_user_id uuid, _role public.app_role)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id AND role = _role
  );
$$;

CREATE OR REPLACE FUNCTION public.can_access_tenant_as_landlord(_tenant_id uuid, _user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT EXISTS (
    SELECT 1 
    FROM public.leases l
    JOIN public.units u ON l.unit_id = u.id
    JOIN public.properties p ON u.property_id = p.id
    WHERE l.tenant_id = _tenant_id
      AND (p.owner_id = _user_id OR p.manager_id = _user_id)
      AND COALESCE(l.status, 'active') = 'active'
      AND l.lease_start_date <= CURRENT_DATE
      AND (l.lease_end_date IS NULL OR l.lease_end_date >= CURRENT_DATE)
  );
$$;

CREATE OR REPLACE FUNCTION public.user_can_access_lease(_lease_id uuid, _user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT EXISTS (
    SELECT 1 
    FROM public.leases l
    JOIN public.units u ON l.unit_id = u.id
    JOIN public.properties p ON u.property_id = p.id
    WHERE l.id = _lease_id
      AND (p.owner_id = _user_id OR p.manager_id = _user_id)
  );
$$;

CREATE OR REPLACE FUNCTION public.tenant_has_lease_on_property(_property_id uuid, _user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.tenants t
    JOIN public.leases l ON l.tenant_id = t.id
    JOIN public.units u ON u.id = l.unit_id
    WHERE u.property_id = _property_id
      AND t.user_id = _user_id
  );
$$;

-- Drop existing problematic policies
DROP POLICY IF EXISTS "tenants_strict_access_control" ON public.tenants;
DROP POLICY IF EXISTS "leases_user_access" ON public.leases;
DROP POLICY IF EXISTS "Tenants can view their property information" ON public.properties;

-- Create new safe policies for tenants
CREATE POLICY "tenants_safe_access" ON public.tenants
FOR ALL
USING (
  public.has_role_safe(auth.uid(), 'Admin'::public.app_role)
  OR user_id = auth.uid()
  OR public.can_access_tenant_as_landlord(id, auth.uid())
)
WITH CHECK (
  public.has_role_safe(auth.uid(), 'Admin'::public.app_role)
  OR user_id = auth.uid()
);

-- Create new safe policies for leases
CREATE POLICY "leases_safe_access" ON public.leases
FOR ALL
USING (
  public.has_role_safe(auth.uid(), 'Admin'::public.app_role)
  OR public.user_can_access_lease(id, auth.uid())
  OR EXISTS (
    SELECT 1 FROM public.tenants t 
    WHERE t.id = tenant_id AND t.user_id = auth.uid()
  )
)
WITH CHECK (
  public.has_role_safe(auth.uid(), 'Admin'::public.app_role)
  OR public.user_can_access_lease(id, auth.uid())
);

-- Update properties policy to use safe function
CREATE POLICY "tenants_can_view_their_properties" ON public.properties
FOR SELECT
USING (
  public.tenant_has_lease_on_property(id, auth.uid())
);