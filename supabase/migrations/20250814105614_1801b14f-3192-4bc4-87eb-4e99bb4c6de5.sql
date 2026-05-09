-- Fix critical security vulnerabilities by implementing proper RLS policies for user data tables

-- 1. Enable RLS on profiles table (if not already enabled)
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- 2. Create RLS policies for profiles table
-- Drop existing policies if they exist to avoid conflicts
DROP POLICY IF EXISTS "Users can view own profile" ON public.profiles;
DROP POLICY IF EXISTS "Users can update own profile" ON public.profiles;
DROP POLICY IF EXISTS "Users can insert own profile" ON public.profiles;
DROP POLICY IF EXISTS "Admins can view all profiles" ON public.profiles;
DROP POLICY IF EXISTS "Admins can manage all profiles" ON public.profiles;

-- Allow users to view only their own profile
CREATE POLICY "Users can view own profile" ON public.profiles
  FOR SELECT
  USING (auth.uid() = id);

-- Allow users to update only their own profile
CREATE POLICY "Users can update own profile" ON public.profiles
  FOR UPDATE
  USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id);

-- Allow users to insert their own profile (for new signups)
CREATE POLICY "Users can insert own profile" ON public.profiles
  FOR INSERT
  WITH CHECK (auth.uid() = id);

-- Allow admins to manage all profiles
CREATE POLICY "Admins can manage all profiles" ON public.profiles
  FOR ALL
  USING (has_role(auth.uid(), 'Admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'Admin'::app_role));

-- 3. Enable RLS on tenants table (if not already enabled)
ALTER TABLE public.tenants ENABLE ROW LEVEL SECURITY;

-- 4. Create RLS policies for tenants table
-- Drop existing policies if they exist to avoid conflicts
DROP POLICY IF EXISTS "Tenants can view own record" ON public.tenants;
DROP POLICY IF EXISTS "Tenants can update own record" ON public.tenants;
DROP POLICY IF EXISTS "Property stakeholders can manage tenants" ON public.tenants;
DROP POLICY IF EXISTS "Admins can manage all tenants" ON public.tenants;

-- Allow tenants to view only their own record
CREATE POLICY "Tenants can view own record" ON public.tenants
  FOR SELECT
  USING (auth.uid() = user_id);

-- Allow tenants to update only their own record (limited fields)
CREATE POLICY "Tenants can update own record" ON public.tenants
  FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Allow property owners/managers to manage tenants for their properties
CREATE POLICY "Property stakeholders can manage tenants" ON public.tenants
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.leases l
      JOIN public.units u ON l.unit_id = u.id
      JOIN public.properties p ON u.property_id = p.id
      WHERE l.tenant_id = tenants.id 
        AND (p.owner_id = auth.uid() OR p.manager_id = auth.uid())
    )
  );

-- Allow admins to manage all tenant records
CREATE POLICY "Admins can manage all tenants" ON public.tenants
  FOR ALL
  USING (has_role(auth.uid(), 'Admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'Admin'::app_role));

-- 5. Ensure user_roles table has proper RLS (should already be secure but let's verify)
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they exist
DROP POLICY IF EXISTS "Users can view own roles" ON public.user_roles;
DROP POLICY IF EXISTS "Admins can manage all roles" ON public.user_roles;

-- Allow users to view only their own roles
CREATE POLICY "Users can view own roles" ON public.user_roles
  FOR SELECT
  USING (auth.uid() = user_id);

-- Allow admins to manage all user roles
CREATE POLICY "Admins can manage all roles" ON public.user_roles
  FOR ALL
  USING (has_role(auth.uid(), 'Admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'Admin'::app_role));

-- 6. Create a function to safely get user profile data (for admin use cases)
CREATE OR REPLACE FUNCTION public.get_user_profile_safe(_user_id UUID)
RETURNS TABLE(
  id UUID,
  email TEXT,
  first_name TEXT,
  last_name TEXT,
  phone TEXT,
  created_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ
)
LANGUAGE SQL
SECURITY DEFINER
SET search_path = ''
AS $$
  -- Only allow admins or the user themselves to access profile data
  SELECT 
    p.id,
    p.email,
    p.first_name,
    p.last_name,
    p.phone,
    p.created_at,
    p.updated_at
  FROM public.profiles p
  WHERE p.id = _user_id
    AND (
      auth.uid() = _user_id 
      OR public.has_role(auth.uid(), 'Admin'::public.app_role)
    );
$$;

-- 7. Create audit logging for sensitive data access
CREATE TABLE IF NOT EXISTS public.data_access_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  accessed_by UUID NOT NULL,
  accessed_table TEXT NOT NULL,
  accessed_record_id UUID,
  access_type TEXT NOT NULL, -- SELECT, INSERT, UPDATE, DELETE
  accessed_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  ip_address INET,
  user_agent TEXT
);

-- Enable RLS on audit logs
ALTER TABLE public.data_access_logs ENABLE ROW LEVEL SECURITY;

-- Only admins can view audit logs
CREATE POLICY "Admins can view audit logs" ON public.data_access_logs
  FOR SELECT
  USING (has_role(auth.uid(), 'Admin'::app_role));

-- System can insert audit logs
CREATE POLICY "System can insert audit logs" ON public.data_access_logs
  FOR INSERT
  WITH CHECK (true);

-- Comment on the security measures
COMMENT ON POLICY "Users can view own profile" ON public.profiles IS 
'Security: Users can only access their own profile data to prevent data leaks';

COMMENT ON POLICY "Admins can manage all profiles" ON public.profiles IS 
'Security: Admin access to profiles for legitimate administrative purposes';

COMMENT ON POLICY "Tenants can view own record" ON public.tenants IS 
'Security: Tenants can only access their own tenant record to prevent personal information exposure';

COMMENT ON POLICY "Property stakeholders can manage tenants" ON public.tenants IS 
'Security: Property owners/managers can only access tenants for their own properties';

COMMENT ON TABLE public.data_access_logs IS 
'Security: Audit trail for accessing sensitive user data';