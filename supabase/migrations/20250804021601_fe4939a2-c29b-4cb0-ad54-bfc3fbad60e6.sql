-- Remove the problematic policies that cause infinite recursion
DROP POLICY IF EXISTS "Tenants can view their own units" ON public.units;
DROP POLICY IF EXISTS "Tenants can view their property information" ON public.properties;

-- Create security definer functions to avoid recursion
CREATE OR REPLACE FUNCTION public.get_tenant_unit_ids(_user_id uuid)
RETURNS uuid[]
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT array_agg(DISTINCT l.unit_id)
  FROM public.leases l
  JOIN public.tenants t ON t.id = l.tenant_id
  WHERE t.user_id = _user_id;
$$;

CREATE OR REPLACE FUNCTION public.get_tenant_property_ids(_user_id uuid)
RETURNS uuid[]
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT array_agg(DISTINCT u.property_id)
  FROM public.units u
  JOIN public.leases l ON l.unit_id = u.id
  JOIN public.tenants t ON t.id = l.tenant_id
  WHERE t.user_id = _user_id;
$$;

-- Create new policies using the security definer functions
CREATE POLICY "Tenants can view their own units" 
ON public.units 
FOR SELECT 
USING (id = ANY(public.get_tenant_unit_ids(auth.uid())));

CREATE POLICY "Tenants can view their property information" 
ON public.properties 
FOR SELECT 
USING (id = ANY(public.get_tenant_property_ids(auth.uid())));