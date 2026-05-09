-- Create email_templates table
CREATE TABLE public.email_templates (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  subject TEXT NOT NULL,
  content TEXT NOT NULL,
  category TEXT NOT NULL DEFAULT 'general',
  variables TEXT[] NOT NULL DEFAULT '{}',
  enabled BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create message_templates table
CREATE TABLE public.message_templates (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('sms', 'whatsapp')),
  category TEXT NOT NULL DEFAULT 'general',
  subject TEXT,
  content TEXT NOT NULL,
  variables TEXT[] NOT NULL DEFAULT '{}',
  enabled BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS on both tables
ALTER TABLE public.email_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.message_templates ENABLE ROW LEVEL SECURITY;

-- Create RLS policies for email_templates
CREATE POLICY "Admins can manage email templates" ON public.email_templates
FOR ALL USING (has_role(auth.uid(), 'Admin'::app_role));

-- Create RLS policies for message_templates
CREATE POLICY "Admins can manage message templates" ON public.message_templates
FOR ALL USING (has_role(auth.uid(), 'Admin'::app_role));

-- Create update triggers for both tables
CREATE TRIGGER update_email_templates_updated_at
BEFORE UPDATE ON public.email_templates
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_message_templates_updated_at
BEFORE UPDATE ON public.message_templates
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Insert default email templates
INSERT INTO public.email_templates (name, subject, content, category, variables, enabled) VALUES
('User Welcome Email', 'Welcome to ZIRA Property Management - Your {{user_role}} account is ready', 'Professional React Email template for user welcome emails with role-specific content, login credentials, and feature highlights. This uses the UserWelcomeEmail React Email component.', 'authentication', ARRAY['user_name', 'user_email', 'user_role', 'temporary_password', 'login_url', 'property_name', 'unit_number'], true),
('Tenant Welcome Email', 'Welcome to Zira Homes - Your Tenant Portal Access', 'Professional React Email template for tenant welcome emails with property details, login credentials, and portal features. This uses the enhanced tenant welcome email template.', 'authentication', ARRAY['tenant_name', 'property_name', 'unit_number', 'temporary_password', 'login_url'], true),
('Password Reset', 'Reset your ZIRA Property password', 'Password reset email using Supabase''s built-in email template. SMS notification is also sent if enabled in communication preferences.', 'authentication', ARRAY['user_name', 'reset_link'], true),
('Payment Reminder', 'Rent Payment Due - {{property_name}}', 'Professional React Email template for rent payment reminders with payment details, due dates, and online payment options. Uses PaymentReminderEmail component.', 'payments', ARRAY['tenant_name', 'property_name', 'unit_number', 'amount_due', 'due_date', 'invoice_number', 'payment_url'], true),
('Overdue Payment Notice', 'Overdue Payment Notice - {{property_name}}', 'Urgent payment reminder template for overdue rent payments with late fees warning and immediate action required. Uses PaymentReminderEmail component with urgency styling.', 'payments', ARRAY['tenant_name', 'property_name', 'unit_number', 'amount_due', 'due_date', 'days_overdue', 'invoice_number'], true),
('Payment Confirmation', 'Payment Received - {{property_name}}', 'Payment confirmation email template with transaction details, receipt information, and account status updates. Uses PaymentConfirmationEmail component.', 'payments', ARRAY['tenant_name', 'property_name', 'unit_number', 'amount_paid', 'payment_date', 'payment_method', 'transaction_id', 'invoice_number'], true),
('Maintenance Status Update', 'Maintenance Request Update - {{request_title}}', 'Maintenance request status update email with current status, update notes, and next steps. Uses structured HTML template.', 'maintenance', ARRAY['tenant_name', 'request_title', 'status', 'property_name', 'unit_number', 'update_date', 'update_notes'], true),
('Service Provider Assignment', 'Service Provider Assigned - {{request_title}}', 'Email notification when a service provider is assigned to a maintenance request with provider details and contact information.', 'maintenance', ARRAY['tenant_name', 'request_title', 'property_name', 'unit_number', 'service_provider_name'], true),
('Maintenance Completion', 'Maintenance Request Completed - {{request_title}}', 'Maintenance completion notification with resolution details and follow-up instructions.', 'maintenance', ARRAY['tenant_name', 'request_title', 'property_name', 'unit_number', 'completion_notes'], true),
('General Announcement', '{{announcement_title}} - {{property_name}}', 'General property announcement email template with urgency indicators, expiration dates, and professional formatting. Uses GeneralAnnouncementEmail component.', 'announcements', ARRAY['tenant_name', 'property_name', 'announcement_title', 'announcement_message', 'announcement_type', 'is_urgent', 'expires_at'], true),
('Emergency Notice', '🚨 URGENT: {{announcement_title}} - {{property_name}}', 'Emergency announcement template with high priority styling, immediate attention indicators, and urgent action requirements.', 'announcements', ARRAY['tenant_name', 'property_name', 'announcement_title', 'announcement_message', 'expires_at'], true),
('Lease Expiry Reminder', 'Lease Expiry Notice - {{property_name}}', 'Dear {{tenant_name}},\n\nThis is a reminder that your lease for {{property_name}}, Unit {{unit_number}} is set to expire on {{expiry_date}}.\n\nPlease contact your property manager to discuss renewal options or move-out procedures.\n\nProperty Details:\n- Property: {{property_name}}\n- Unit: {{unit_number}}\n- Lease End Date: {{expiry_date}}\n- Days Remaining: {{days_remaining}}\n\nBest regards,\nThe ZIRA Property Team', 'leases', ARRAY['tenant_name', 'property_name', 'unit_number', 'expiry_date', 'days_remaining'], true);

-- Insert default message templates
INSERT INTO public.message_templates (name, type, category, content, variables, enabled) VALUES
('Rent Payment Reminder', 'sms', 'payment', 'Rent reminder: KES {{amount}} due for {{property_name}}, Unit {{unit_number}}. Due: {{due_date}}. Pay online or via M-Pesa. - ZIRA Property', ARRAY['amount', 'property_name', 'unit_number', 'due_date'], true),
('Overdue Payment Notice', 'sms', 'payment', 'OVERDUE: Rent payment of KES {{amount}} is {{days_overdue}} days overdue for {{property_name}}. Please pay immediately to avoid late fees. - ZIRA Property', ARRAY['amount', 'days_overdue', 'property_name'], true),
('Payment Confirmation', 'sms', 'payment', 'Payment received! KES {{amount}} for {{property_name}}, Unit {{unit_number}}. Transaction: {{transaction_id}}. Thank you! - ZIRA Property', ARRAY['amount', 'property_name', 'unit_number', 'transaction_id'], true),
('Welcome New User', 'sms', 'account', 'Welcome to the platform! Your account has been created.\n\nRole: {{user_role}}\nEmail: {{email}}\nTemporary Password: {{temporary_password}}\n\nPlease log in and change your password immediately.\n\n- ZIRA Property Management', ARRAY['user_role', 'email', 'temporary_password'], true),
('Welcome New Tenant', 'sms', 'account', 'Welcome to Zira Homes! Your login details:\nEmail: {{email}}\nPassword: {{temporary_password}}\nLogin: {{login_url}}\n\nProperty: {{property_name}}\nUnit: {{unit_number}}', ARRAY['email', 'temporary_password', 'login_url', 'property_name', 'unit_number'], true),
('Password Reset Notification', 'sms', 'account', 'Hi {{first_name}}, a password reset was requested for your Zira Homes account. If this wasn''t you, please contact support. Reset link sent to your email.', ARRAY['first_name'], true),
('Maintenance Status Update', 'sms', 'maintenance', 'Maintenance Update: {{request_title}} status changed to {{new_status}}. Property: {{property_name}}{{#if message}}. Note: {{message}}{{/if}}', ARRAY['request_title', 'new_status', 'property_name', 'message'], true),
('Service Provider Assignment', 'sms', 'maintenance', 'Service provider {{service_provider_name}} assigned to your maintenance request: {{request_title}}. They will contact you soon.', ARRAY['service_provider_name', 'request_title'], true),
('Maintenance Completion', 'sms', 'maintenance', 'Maintenance request completed: {{request_title}} at {{property_name}}{{#if message}}. Notes: {{message}}{{/if}}', ARRAY['request_title', 'property_name', 'message'], true),
('General Announcement', 'sms', 'announcement', '{{#if is_urgent}}URGENT: {{/if}}{{announcement_title}}\n\n{{announcement_message_truncated}}\n\n- {{property_name}}', ARRAY['is_urgent', 'announcement_title', 'announcement_message_truncated', 'property_name'], true),
('Emergency Notice', 'sms', 'announcement', 'URGENT: {{announcement_title}}\n\n{{announcement_message}}\n\nImmediate attention required.\n\n- {{property_name}}', ARRAY['announcement_title', 'announcement_message', 'property_name'], true);