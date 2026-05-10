-- Fix the function parameter ordering issues
-- Parameters with defaults must come last

CREATE OR REPLACE FUNCTION public.has_role(_role public.app_role, _user_id uuid DEFAULT auth.uid())
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

-- Update is_admin to use the corrected parameter order
CREATE OR REPLACE FUNCTION public.is_admin(_user_id uuid DEFAULT auth.uid())
RETURNS boolean
LANGUAGE sql
STABLE 
SECURITY DEFINER
SET search_path = 'public'
AS $$
  SELECT public.has_role('Admin'::public.app_role, _user_id);
$$;