-- Create communication preferences table for admin settings
CREATE TABLE IF NOT EXISTS public.communication_preferences (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  setting_name text NOT NULL UNIQUE,
  email_enabled boolean NOT NULL DEFAULT true,
  sms_enabled boolean NOT NULL DEFAULT false,
  description text,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.communication_preferences ENABLE ROW LEVEL SECURITY;

-- Create policy for admins to manage communication preferences
CREATE POLICY "Admins can manage communication preferences" 
ON public.communication_preferences 
FOR ALL 
USING (has_role(auth.uid(), 'Admin'::app_role));

-- Insert default communication preferences
INSERT INTO public.communication_preferences (setting_name, email_enabled, sms_enabled, description) VALUES
('tenant_account_creation', true, true, 'Communication method when creating new tenant accounts'),
('password_reset', true, true, 'Communication method for password reset requests'),
('payment_notifications', true, true, 'Communication method for payment confirmations'),
('maintenance_notifications', true, true, 'Communication method for maintenance updates'),
('general_announcements', true, false, 'Communication method for general announcements')
ON CONFLICT (setting_name) DO NOTHING;

-- Create trigger for updated_at
CREATE TRIGGER update_communication_preferences_updated_at
BEFORE UPDATE ON public.communication_preferences
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();