-- Get the current user's ID and assign Admin role
DO $$
DECLARE
    current_user_id uuid;
BEGIN
    -- Get the authenticated user's ID
    SELECT auth.uid() INTO current_user_id;
    
    -- Insert Admin role for the current user if not exists
    INSERT INTO public.user_roles (user_id, role)
    VALUES (current_user_id, 'Admin'::app_role)
    ON CONFLICT (user_id, role) DO NOTHING;
END $$;

-- Update RLS policies for trial_notification_templates to allow Landlords as well
DROP POLICY IF EXISTS "Admins can manage trial notification templates" ON public.trial_notification_templates;
DROP POLICY IF EXISTS "Landlords can view trial notification templates" ON public.trial_notification_templates;

-- Create more permissive policies
CREATE POLICY "Admins and Landlords can manage trial notification templates" 
ON public.trial_notification_templates 
FOR ALL 
USING (has_role(auth.uid(), 'Admin'::app_role) OR has_role(auth.uid(), 'Landlord'::app_role))
WITH CHECK (has_role(auth.uid(), 'Admin'::app_role) OR has_role(auth.uid(), 'Landlord'::app_role));