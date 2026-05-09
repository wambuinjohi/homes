-- Fix infinite recursion by completely rebuilding RLS policies

-- 1. Drop ALL existing policies for problematic tables
DROP POLICY IF EXISTS "Tenants can view own record" ON public.tenants;
DROP POLICY IF EXISTS "Tenants can update own record" ON public.tenants;
DROP POLICY IF EXISTS "Property stakeholders can manage tenants" ON public.tenants;
DROP POLICY IF EXISTS "Admins can manage all tenants" ON public.tenants;

DROP POLICY IF EXISTS "Property owners can manage their leases" ON public.leases;
DROP POLICY IF EXISTS "Tenants can view their own leases" ON public.leases;
DROP POLICY IF EXISTS "Tenants can view own leases" ON public.leases;
DROP POLICY IF EXISTS "Property stakeholders can manage leases" ON public.leases;

DROP POLICY IF EXISTS "Property stakeholders can manage units" ON public.units;
DROP POLICY IF EXISTS "Property owners can manage their properties" ON public.properties;

-- 2. Create a security definer function to safely check property ownership
CREATE OR REPLACE FUNCTION public.user_owns_property(_property_id UUID, _user_id UUID)
RETURNS BOOLEAN
LANGUAGE SQL
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.properties p
    WHERE p.id = _property_id 
      AND (p.owner_id = _user_id OR p.manager_id = _user_id)
  );
$$;

-- 3. Create simple, non-recursive policies for tenants table
CREATE POLICY "Tenants can view own record" ON public.tenants
  FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Tenants can update own record" ON public.tenants
  FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Admins can manage all tenants" ON public.tenants
  FOR ALL
  USING (has_role(auth.uid(), 'Admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'Admin'::app_role));

-- 4. Create simple policies for leases table that avoid recursion
CREATE POLICY "Tenants can view own leases" ON public.leases
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.tenants t
      WHERE t.id = leases.tenant_id 
        AND t.user_id = auth.uid()
    )
  );

CREATE POLICY "Admins can manage all leases" ON public.leases
  FOR ALL
  USING (has_role(auth.uid(), 'Admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'Admin'::app_role));

-- 5. Simplified property and unit policies
CREATE POLICY "Property owners can manage their properties" ON public.properties
  FOR ALL
  USING (
    has_role(auth.uid(), 'Admin'::app_role) OR
    owner_id = auth.uid() OR 
    manager_id = auth.uid()
  );

CREATE POLICY "Property stakeholders can manage units" ON public.units
  FOR ALL
  USING (
    has_role(auth.uid(), 'Admin'::app_role) OR
    public.user_owns_property(units.property_id, auth.uid())
  );