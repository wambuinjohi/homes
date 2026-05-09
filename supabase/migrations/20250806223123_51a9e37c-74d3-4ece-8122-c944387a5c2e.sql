-- Update RLS policies for trial_notification_templates to allow Landlords as well
DROP POLICY IF EXISTS "Admins can manage trial notification templates" ON public.trial_notification_templates;
DROP POLICY IF EXISTS "Landlords can view trial notification templates" ON public.trial_notification_templates;

-- Create more permissive policies
CREATE POLICY "Admins and Landlords can manage trial notification templates" 
ON public.trial_notification_templates 
FOR ALL 
USING (has_role(auth.uid(), 'Admin'::app_role) OR has_role(auth.uid(), 'Landlord'::app_role))
WITH CHECK (has_role(auth.uid(), 'Admin'::app_role) OR has_role(auth.uid(), 'Landlord'::app_role));