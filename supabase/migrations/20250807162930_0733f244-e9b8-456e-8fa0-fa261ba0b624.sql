-- Create tables for SMS provider configurations and automation settings
CREATE TABLE IF NOT EXISTS public.sms_providers (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  provider_name text NOT NULL,
  api_key text,
  api_secret text,
  authorization_token text,
  username text,
  sender_id text,
  base_url text,
  unique_identifier text,
  sender_type text,
  country_code text DEFAULT 'KE',
  is_active boolean DEFAULT false,
  is_default boolean DEFAULT false,
  config_data jsonb DEFAULT '{}',
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.sms_providers ENABLE ROW LEVEL SECURITY;

-- Create policies
CREATE POLICY "Admins can manage SMS providers"
ON public.sms_providers
FOR ALL
TO authenticated
USING (has_role(auth.uid(), 'Admin'::app_role));

-- Create table for SMS automation settings
CREATE TABLE IF NOT EXISTS public.sms_automation_settings (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  automation_key text NOT NULL UNIQUE,
  enabled boolean DEFAULT true,
  timing text NOT NULL,
  audience_type text NOT NULL,
  template_id uuid,
  template_content text,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.sms_automation_settings ENABLE ROW LEVEL SECURITY;

-- Create policies
CREATE POLICY "Admins can manage SMS automation settings"
ON public.sms_automation_settings
FOR ALL
TO authenticated
USING (has_role(auth.uid(), 'Admin'::app_role));

-- Create table for SMS usage logs
CREATE TABLE IF NOT EXISTS public.sms_usage_logs (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  landlord_id uuid,
  recipient_phone text NOT NULL,
  message_content text NOT NULL,
  provider_name text NOT NULL,
  cost numeric DEFAULT 0,
  status text NOT NULL,
  sent_at timestamp with time zone DEFAULT now(),
  delivery_status text DEFAULT 'pending',
  error_message text,
  metadata jsonb DEFAULT '{}'
);

-- Enable RLS
ALTER TABLE public.sms_usage_logs ENABLE ROW LEVEL SECURITY;

-- Create policies
CREATE POLICY "Admins can view all SMS usage logs"
ON public.sms_usage_logs
FOR SELECT
TO authenticated
USING (has_role(auth.uid(), 'Admin'::app_role));

CREATE POLICY "Landlords can view their own SMS usage logs"
ON public.sms_usage_logs
FOR SELECT
TO authenticated
USING (has_role(auth.uid(), 'Landlord'::app_role) AND landlord_id = auth.uid());

CREATE POLICY "System can insert SMS usage logs"
ON public.sms_usage_logs
FOR INSERT
TO authenticated
WITH CHECK (true);

-- Create triggers for updated_at
CREATE OR REPLACE FUNCTION public.update_sms_provider_updated_at()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

CREATE TRIGGER update_sms_providers_updated_at
  BEFORE UPDATE ON public.sms_providers
  FOR EACH ROW
  EXECUTE FUNCTION public.update_sms_provider_updated_at();

CREATE TRIGGER update_sms_automation_settings_updated_at
  BEFORE UPDATE ON public.sms_automation_settings
  FOR EACH ROW
  EXECUTE FUNCTION public.update_sms_provider_updated_at();

-- Insert default communication preferences if they don't exist
INSERT INTO public.communication_preferences (setting_name, email_enabled, sms_enabled, description)
VALUES 
  ('user_account_creation', true, true, 'Communication method when creating new user accounts (all roles)'),
  ('password_reset', true, true, 'Communication method for password reset requests'),
  ('payment_notifications', true, true, 'Communication method for payment confirmations'),
  ('maintenance_notifications', true, true, 'Communication method for maintenance updates'),
  ('general_announcements', true, false, 'Communication method for general announcements')
ON CONFLICT (setting_name) DO NOTHING;

-- Insert default message templates if they don't exist  
INSERT INTO public.message_templates (name, type, category, content, variables, enabled)
VALUES 
  ('Rent Payment Reminder', 'sms', 'payment', 'Rent reminder: KES {{amount}} due for {{property_name}}, Unit {{unit_number}}. Due: {{due_date}}. Pay online or via M-Pesa. - ZIRA Property', ARRAY['amount', 'property_name', 'unit_number', 'due_date'], true),
  ('Overdue Payment Notice', 'sms', 'payment', 'OVERDUE: Rent payment of KES {{amount}} is {{days_overdue}} days overdue for {{property_name}}. Please pay immediately to avoid late fees. - ZIRA Property', ARRAY['amount', 'days_overdue', 'property_name'], true),
  ('Payment Confirmation', 'sms', 'payment', 'Payment received! KES {{amount}} for {{property_name}}, Unit {{unit_number}}. Transaction: {{transaction_id}}. Thank you! - ZIRA Property', ARRAY['amount', 'property_name', 'unit_number', 'transaction_id'], true),
  ('Welcome New User', 'sms', 'account', 'Welcome to the platform! Your account has been created.\n\nRole: {{user_role}}\nEmail: {{email}}\nTemporary Password: {{temporary_password}}\n\nPlease log in and change your password immediately.\n\n- ZIRA Property Management', ARRAY['user_role', 'email', 'temporary_password'], true),
  ('Welcome New Tenant', 'sms', 'account', 'Welcome to Zira Homes! Your login details:\nEmail: {{email}}\nPassword: {{temporary_password}}\nLogin: {{login_url}}\n\nProperty: {{property_name}}\nUnit: {{unit_number}}', ARRAY['email', 'temporary_password', 'login_url', 'property_name', 'unit_number'], true),
  ('Password Reset Notification', 'sms', 'account', 'Hi {{first_name}}, a password reset was requested for your Zira Homes account. If this wasn''t you, please contact support. Reset link sent to your email.', ARRAY['first_name'], true),
  ('Maintenance Status Update', 'sms', 'maintenance', 'Maintenance Update: {{request_title}} status changed to {{new_status}}. Property: {{property_name}}{{#if message}}. Note: {{message}}{{/if}}', ARRAY['request_title', 'new_status', 'property_name', 'message'], true),
  ('Service Provider Assignment', 'sms', 'maintenance', 'Service provider {{service_provider_name}} assigned to your maintenance request: {{request_title}}. They will contact you soon.', ARRAY['service_provider_name', 'request_title'], true),
  ('Maintenance Completion', 'sms', 'maintenance', 'Maintenance request completed: {{request_title}} at {{property_name}}{{#if message}}. Notes: {{message}}{{/if}}', ARRAY['request_title', 'property_name', 'message'], true),
  ('General Announcement', 'sms', 'announcement', '{{#if is_urgent}}URGENT: {{/if}}{{announcement_title}}\n\n{{announcement_message_truncated}}\n\n- {{property_name}}', ARRAY['is_urgent', 'announcement_title', 'announcement_message_truncated', 'property_name'], true)
ON CONFLICT (name) DO NOTHING;

-- Insert default SMS provider configuration
INSERT INTO public.sms_providers (provider_name, authorization_token, username, sender_id, base_url, unique_identifier, sender_type, is_active, is_default, config_data)
VALUES (
  'InHouse SMS',
  'f22b2aa230b02b428a71023c7eb7f7bb9d440f38',
  'ZIRA TECH',
  'ZIRA TECH',
  'http://68.183.101.252:803/bulk_api/',
  '77',
  '10',
  true,
  true,
  '{"username": "ZIRA TECH", "authorization_token": "f22b2aa230b02b428a71023c7eb7f7bb9d440f38", "unique_identifier": "77", "sender_type": "10"}'
)
ON CONFLICT (provider_name) DO NOTHING;

-- Insert default SMS automation settings
INSERT INTO public.sms_automation_settings (automation_key, enabled, timing, audience_type, template_content)
VALUES 
  ('rent_due_reminder', true, '5-7-days', 'tenants', 'Reminder: Your rent of KES {{rent_amount}} is due on {{due_date}} for Unit {{unit_number}}.'),
  ('payment_confirmation', true, 'instant', 'tenants', 'Payment of KES {{amount}} received. Thank you! - Zira Homes'),
  ('maintenance_update', true, 'instant', 'tenants', 'Maintenance Update: {{request_title}} status changed to {{new_status}}.'),
  ('account_creation', true, 'instant', 'all', 'Welcome! Your account: Email: {{email}}, Password: {{temporary_password}}'),
  ('password_reset', true, 'instant', 'all', 'Password reset requested for your Zira Homes account. Check your email.')
ON CONFLICT (automation_key) DO NOTHING;