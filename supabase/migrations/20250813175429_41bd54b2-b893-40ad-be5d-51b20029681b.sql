-- Add landlord_id column to email_templates table for landlord-specific templates
ALTER TABLE public.email_templates 
ADD COLUMN landlord_id UUID REFERENCES auth.users(id) ON DELETE CASCADE;

-- Add landlord_id column to message_templates table for landlord-specific templates  
ALTER TABLE public.message_templates
ADD COLUMN landlord_id UUID REFERENCES auth.users(id) ON DELETE CASCADE;

-- Update RLS policies for email_templates to support landlord access
DROP POLICY IF EXISTS "Admins can manage email templates" ON public.email_templates;
DROP POLICY IF EXISTS "Landlords can view their email templates" ON public.email_templates;

CREATE POLICY "Admins can manage all email templates" 
ON public.email_templates 
FOR ALL 
USING (has_role(auth.uid(), 'Admin'::app_role));

CREATE POLICY "Landlords can manage their own email templates"
ON public.email_templates
FOR ALL
USING (
  (landlord_id = auth.uid() AND has_role(auth.uid(), 'Landlord'::app_role)) OR
  has_role(auth.uid(), 'Admin'::app_role)
);

CREATE POLICY "Landlords can view global email templates"
ON public.email_templates
FOR SELECT
USING (
  (landlord_id IS NULL AND enabled = true AND has_role(auth.uid(), 'Landlord'::app_role)) OR
  (landlord_id = auth.uid() AND has_role(auth.uid(), 'Landlord'::app_role)) OR
  has_role(auth.uid(), 'Admin'::app_role)
);

-- Update RLS policies for message_templates to support landlord access
DROP POLICY IF EXISTS "Admins can manage message templates" ON public.message_templates;
DROP POLICY IF EXISTS "Landlords can view their message templates" ON public.message_templates;

CREATE POLICY "Admins can manage all message templates"
ON public.message_templates
FOR ALL
USING (has_role(auth.uid(), 'Admin'::app_role));

CREATE POLICY "Landlords can manage their own message templates"
ON public.message_templates
FOR ALL
USING (
  (landlord_id = auth.uid() AND has_role(auth.uid(), 'Landlord'::app_role)) OR
  has_role(auth.uid(), 'Admin'::app_role)
);

CREATE POLICY "Landlords can view global message templates"
ON public.message_templates
FOR SELECT
USING (
  (landlord_id IS NULL AND enabled = true AND has_role(auth.uid(), 'Landlord'::app_role)) OR
  (landlord_id = auth.uid() AND has_role(auth.uid(), 'Landlord'::app_role)) OR
  has_role(auth.uid(), 'Admin'::app_role)
);