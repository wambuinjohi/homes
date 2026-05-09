-- Update RLS policy for billing_plans to include Manager role
DROP POLICY IF EXISTS "Landlords can view active billing plans" ON public.billing_plans;

CREATE POLICY "Property stakeholders can view active billing plans" 
ON public.billing_plans 
FOR SELECT 
USING (
  is_active = true AND (
    has_role(auth.uid(), 'Landlord'::app_role) OR 
    has_role(auth.uid(), 'Manager'::app_role) OR 
    has_role(auth.uid(), 'Agent'::app_role)
  )
);