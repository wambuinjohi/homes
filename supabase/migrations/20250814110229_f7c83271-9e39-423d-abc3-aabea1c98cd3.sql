-- Fix infinite recursion in RLS policies by simplifying them

-- 1. Drop the problematic policies that are causing infinite recursion
DROP POLICY IF EXISTS "Property stakeholders can manage tenants" ON public.tenants;
DROP POLICY IF EXISTS "Property owners can manage their leases" ON public.leases;
DROP POLICY IF EXISTS "Tenants can view their own leases" ON public.leases;

-- 2. Create simpler, non-recursive policies for tenants table
-- Tenants can only view and update their own record (simple user_id check)
CREATE POLICY "Tenants can view own record" ON public.tenants
  FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Tenants can update own record" ON public.tenants
  FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Only admins can insert/delete tenant records (to prevent unauthorized tenant creation)
CREATE POLICY "Admins can manage all tenants" ON public.tenants
  FOR ALL
  USING (has_role(auth.uid(), 'Admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'Admin'::app_role));

-- 3. Create simpler policies for leases table
-- Tenants can view their own leases (direct tenant_id check only)
CREATE POLICY "Tenants can view own leases" ON public.leases
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.tenants t
      WHERE t.id = leases.tenant_id 
        AND t.user_id = auth.uid()
    )
  );

-- Property stakeholders can manage leases through a security definer function
-- First, create a security definer function to check property ownership
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

-- Now create the lease policy using the function
CREATE POLICY "Property stakeholders can manage leases" ON public.leases
  FOR ALL
  USING (
    has_role(auth.uid(), 'Admin'::app_role) OR
    public.user_owns_property(
      (SELECT u.property_id FROM public.units u WHERE u.id = leases.unit_id),
      auth.uid()
    )
  );

-- 4. Ensure units table has proper policies
ALTER TABLE public.units ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Property stakeholders can manage units" ON public.units;

CREATE POLICY "Property stakeholders can manage units" ON public.units
  FOR ALL
  USING (
    has_role(auth.uid(), 'Admin'::app_role) OR
    public.user_owns_property(units.property_id, auth.uid())
  );

-- 5. Ensure properties table has proper policies
ALTER TABLE public.properties ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Property stakeholders can manage properties" ON public.properties;

CREATE POLICY "Property owners can manage their properties" ON public.properties
  FOR ALL
  USING (
    has_role(auth.uid(), 'Admin'::app_role) OR
    owner_id = auth.uid() OR 
    manager_id = auth.uid()
  );

-- 6. Add comments explaining the security approach
COMMENT ON POLICY "Tenants can view own record" ON public.tenants IS 
'Security: Direct user_id check prevents infinite recursion while ensuring tenants only see their own data';

COMMENT ON POLICY "Tenants can view own leases" ON public.leases IS 
'Security: Uses EXISTS subquery to check tenant ownership without complex joins that cause recursion';

COMMENT ON FUNCTION public.user_owns_property(UUID, UUID) IS 
'Security: Security definer function to safely check property ownership without causing RLS recursion';