-- Fix RLS policies to allow users without roles to self-assign 'Agent' role
CREATE POLICY "Users without roles can assign themselves Agent role"
ON public.user_roles
FOR INSERT
TO authenticated
WITH CHECK (
  auth.uid() = user_id 
  AND role = 'Agent'::public.app_role 
  AND NOT EXISTS (
    SELECT 1 FROM public.user_roles 
    WHERE user_id = auth.uid()
  )
);

-- Ensure the current user has an Agent role (if they don't have any role)
INSERT INTO public.user_roles (user_id, role)
SELECT auth.uid(), 'Agent'::public.app_role
WHERE auth.uid() IS NOT NULL
AND NOT EXISTS (
  SELECT 1 FROM public.user_roles 
  WHERE user_id = auth.uid()
);