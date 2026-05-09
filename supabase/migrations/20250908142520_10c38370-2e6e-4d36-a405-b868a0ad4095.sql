-- Fix the existing has_role function to prevent recursion
-- Update search path and ensure it's properly isolated

CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid DEFAULT auth.uid(), _role public.app_role)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = 'public'
AS $$
  SELECT EXISTS (
    SELECT 1 
    FROM public.user_roles ur 
    WHERE ur.user_id = COALESCE(_user_id, auth.uid()) 
    AND ur.role = _role
  );
$$;

-- Also fix the is_admin function to use the updated has_role
CREATE OR REPLACE FUNCTION public.is_admin(_user_id uuid DEFAULT auth.uid())
RETURNS boolean
LANGUAGE sql
STABLE 
SECURITY DEFINER
SET search_path = 'public'
AS $$
  SELECT public.has_role(_user_id, 'Admin'::public.app_role);
$$;

-- Update the is_user_tenant function to be more isolated
CREATE OR REPLACE FUNCTION public.is_user_tenant(_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE 
SECURITY DEFINER
SET search_path = 'public'
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.tenants t
    WHERE t.user_id = _user_id
  );
$$;