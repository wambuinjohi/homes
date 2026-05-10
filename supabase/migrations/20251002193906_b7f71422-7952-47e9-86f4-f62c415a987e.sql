-- Fix has_role function permissions and ensure proper grants
-- Grant execute permissions explicitly to all relevant roles
GRANT EXECUTE ON FUNCTION public.has_role(uuid, app_role) TO authenticated, anon, service_role;
GRANT EXECUTE ON FUNCTION public.has_role_safe(uuid, app_role) TO authenticated, anon, service_role;
GRANT EXECUTE ON FUNCTION public.has_role_text(uuid, text) TO authenticated, anon, service_role;
GRANT EXECUTE ON FUNCTION public.has_role_self_text(text) TO authenticated, anon, service_role;

-- Update profiles table RLS policy to use has_role_safe for more reliable admin checks
DROP POLICY IF EXISTS "Admins can manage all profiles" ON public.profiles;
DROP POLICY IF EXISTS "Admins can view all profiles" ON public.profiles;

-- Create a comprehensive admin policy using has_role_safe
CREATE POLICY "Admins can manage all profiles"
ON public.profiles
FOR ALL
TO authenticated
USING (
  has_role_safe(auth.uid(), 'Admin'::app_role)
)
WITH CHECK (
  has_role_safe(auth.uid(), 'Admin'::app_role)
);

-- Ensure users can view their own profile
CREATE POLICY "Users can view own profile"
ON public.profiles
FOR SELECT
TO authenticated
USING (id = auth.uid());

-- Ensure users can update their own profile
CREATE POLICY "Users can update own profile"
ON public.profiles
FOR UPDATE
TO authenticated
USING (id = auth.uid())
WITH CHECK (id = auth.uid());