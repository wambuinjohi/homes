-- Fix RLS policy for landlord_subscriptions to include Manager role
DROP POLICY IF EXISTS "Landlords can view their own subscription" ON public.landlord_subscriptions;

CREATE POLICY "Property stakeholders can view their own subscription" 
ON public.landlord_subscriptions 
FOR SELECT 
USING (
  (has_role(auth.uid(), 'Landlord'::app_role) OR 
   has_role(auth.uid(), 'Manager'::app_role) OR 
   has_role(auth.uid(), 'Agent'::app_role)) AND 
  landlord_id = auth.uid()
);

-- Create INSERT policy for property stakeholders
CREATE POLICY "Property stakeholders can create their own subscription" 
ON public.landlord_subscriptions 
FOR INSERT 
WITH CHECK (
  (has_role(auth.uid(), 'Landlord'::app_role) OR 
   has_role(auth.uid(), 'Manager'::app_role) OR 
   has_role(auth.uid(), 'Agent'::app_role)) AND 
  landlord_id = auth.uid()
);

-- Create UPDATE policy for property stakeholders
CREATE POLICY "Property stakeholders can update their own subscription" 
ON public.landlord_subscriptions 
FOR UPDATE 
USING (
  (has_role(auth.uid(), 'Landlord'::app_role) OR 
   has_role(auth.uid(), 'Manager'::app_role) OR 
   has_role(auth.uid(), 'Agent'::app_role)) AND 
  landlord_id = auth.uid()
)
WITH CHECK (
  (has_role(auth.uid(), 'Landlord'::app_role) OR 
   has_role(auth.uid(), 'Manager'::app_role) OR 
   has_role(auth.uid(), 'Agent'::app_role)) AND 
  landlord_id = auth.uid()
);