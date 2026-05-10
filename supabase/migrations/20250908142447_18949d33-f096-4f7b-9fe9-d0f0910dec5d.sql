-- Fix infinite recursion in RLS policies by creating security definer functions
-- and updating the problematic policies

-- First, create a security definer function to get user role without recursion
CREATE OR REPLACE FUNCTION public.get_user_role_safe(user_id uuid DEFAULT auth.uid())
RETURNS public.app_role
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = ''
AS $$
  SELECT ur.role
  FROM public.user_roles ur
  WHERE ur.user_id = $1
  LIMIT 1;
$$;

-- Create a security definer function to check if user has a specific role
CREATE OR REPLACE FUNCTION public.has_role_safe(user_id uuid, required_role public.app_role)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = ''
AS $$
  SELECT EXISTS (
    SELECT 1 
    FROM public.user_roles ur 
    WHERE ur.user_id = $1 AND ur.role = $2
  );
$$;

-- Create security definer function to get tenant property access
CREATE OR REPLACE FUNCTION public.can_access_tenant_as_landlord(tenant_id uuid, landlord_id uuid DEFAULT auth.uid())
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = ''
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.leases l
    JOIN public.units u ON l.unit_id = u.id
    JOIN public.properties p ON u.property_id = p.id
    WHERE l.tenant_id = $1
      AND (p.owner_id = $2 OR p.manager_id = $2)
      AND l.status = 'active'
      AND l.lease_start_date <= CURRENT_DATE
      AND (l.lease_end_date IS NULL OR l.lease_end_date >= CURRENT_DATE)
  );
$$;

-- Drop and recreate the problematic tenants RLS policy
DROP POLICY IF EXISTS "tenants_strict_access_control" ON public.tenants;

CREATE POLICY "tenants_safe_access_control" 
ON public.tenants
FOR ALL
TO authenticated
USING (
  public.has_role_safe(auth.uid(), 'Admin'::public.app_role) OR
  (user_id = auth.uid()) OR
  (public.has_role_safe(auth.uid(), 'Landlord'::public.app_role) AND 
   public.can_access_tenant_as_landlord(id, auth.uid()))
)
WITH CHECK (
  public.has_role_safe(auth.uid(), 'Admin'::public.app_role) OR 
  (user_id = auth.uid())
);

-- Fix any existing leases RLS policies that might have recursion issues
-- First check if there are problematic policies on leases table
DO $$
DECLARE
    policy_exists boolean;
BEGIN
    -- Check if there's a problematic policy on leases
    SELECT EXISTS (
        SELECT 1 
        FROM pg_policies 
        WHERE schemaname = 'public' 
        AND tablename = 'leases'
        AND policyname LIKE '%tenant%'
    ) INTO policy_exists;
    
    -- Only recreate if there are tenant-related policies that might be problematic
    IF policy_exists THEN
        -- Drop any existing problematic lease policies
        DROP POLICY IF EXISTS "Landlords can manage their tenant leases" ON public.leases;
        DROP POLICY IF EXISTS "Tenants can view their own leases" ON public.leases;
        DROP POLICY IF EXISTS "Property owners can manage their leases" ON public.leases;
        
        -- Create new safe lease policies
        CREATE POLICY "leases_landlord_access" 
        ON public.leases
        FOR ALL
        TO authenticated
        USING (
          public.has_role_safe(auth.uid(), 'Admin'::public.app_role) OR
          EXISTS (
            SELECT 1 
            FROM public.units u 
            JOIN public.properties p ON u.property_id = p.id
            WHERE u.id = leases.unit_id 
            AND (p.owner_id = auth.uid() OR p.manager_id = auth.uid())
          )
        );
        
        CREATE POLICY "leases_tenant_access" 
        ON public.leases
        FOR SELECT
        TO authenticated
        USING (
          EXISTS (
            SELECT 1 
            FROM public.tenants t
            WHERE t.id = leases.tenant_id 
            AND t.user_id = auth.uid()
          )
        );
    END IF;
END
$$;

-- Grant necessary permissions for the new functions
GRANT EXECUTE ON FUNCTION public.get_user_role_safe(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.has_role_safe(uuid, public.app_role) TO authenticated;
GRANT EXECUTE ON FUNCTION public.can_access_tenant_as_landlord(uuid, uuid) TO authenticated;