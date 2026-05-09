-- Add trial expiration status management
-- Add new status types for trial lifecycle
ALTER TYPE app_role ADD VALUE IF NOT EXISTS 'System';

-- Create trial notification templates table
CREATE TABLE IF NOT EXISTS public.trial_notification_templates (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  template_name text NOT NULL,
  notification_type text NOT NULL,
  days_before_expiry integer NOT NULL DEFAULT 0,
  subject text NOT NULL,
  html_content text NOT NULL,
  email_content text NOT NULL,
  is_active boolean DEFAULT true,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Enable RLS on trial notification templates
ALTER TABLE public.trial_notification_templates ENABLE ROW LEVEL SECURITY;

-- Create policy for admins to manage templates
CREATE POLICY "Admins can manage trial notification templates" 
ON public.trial_notification_templates 
FOR ALL 
USING (has_role(auth.uid(), 'Admin'::app_role));

-- Create trial status log table for tracking status changes
CREATE TABLE IF NOT EXISTS public.trial_status_logs (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  landlord_id uuid NOT NULL,
  old_status text,
  new_status text NOT NULL,
  reason text,
  metadata jsonb DEFAULT '{}',
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Enable RLS on trial status logs
ALTER TABLE public.trial_status_logs ENABLE ROW LEVEL SECURITY;

-- Create policies for trial status logs
CREATE POLICY "Admins can view all trial status logs" 
ON public.trial_status_logs 
FOR SELECT 
USING (has_role(auth.uid(), 'Admin'::app_role));

CREATE POLICY "Landlords can view their own trial status logs" 
ON public.trial_status_logs 
FOR SELECT 
USING (landlord_id = auth.uid());

CREATE POLICY "System can insert trial status logs" 
ON public.trial_status_logs 
FOR INSERT 
WITH CHECK (true);

-- Function to check trial limitations
CREATE OR REPLACE FUNCTION public.check_trial_limitation(_user_id uuid, _feature text, _current_count integer DEFAULT 1)
RETURNS boolean
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  subscription_record RECORD;
  feature_limit integer;
BEGIN
  -- Get subscription info
  SELECT * INTO subscription_record
  FROM public.landlord_subscriptions
  WHERE landlord_id = _user_id;
  
  -- If no subscription or not on trial, allow
  IF subscription_record IS NULL OR subscription_record.status != 'trial' THEN
    RETURN true;
  END IF;
  
  -- Check if trial is expired
  IF subscription_record.trial_end_date < now() THEN
    RETURN false;
  END IF;
  
  -- Get feature limit from trial_limitations
  feature_limit := (subscription_record.trial_limitations ->> _feature)::integer;
  
  -- If no limit set, allow
  IF feature_limit IS NULL THEN
    RETURN true;
  END IF;
  
  -- Check if current count exceeds limit
  RETURN _current_count <= feature_limit;
END;
$$;

-- Function to get trial status with grace period
CREATE OR REPLACE FUNCTION public.get_trial_status(_user_id uuid)
RETURNS text
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  subscription_record RECORD;
  grace_period_days integer := 7;
BEGIN
  -- Get subscription info
  SELECT * INTO subscription_record
  FROM public.landlord_subscriptions
  WHERE landlord_id = _user_id;
  
  -- If no subscription, return null
  IF subscription_record IS NULL THEN
    RETURN NULL;
  END IF;
  
  -- Return current status if not trial-related
  IF subscription_record.status NOT IN ('trial', 'trial_expired', 'suspended') THEN
    RETURN subscription_record.status;
  END IF;
  
  -- Check trial status based on dates
  IF subscription_record.trial_end_date IS NULL THEN
    RETURN 'trial';
  END IF;
  
  -- Active trial
  IF now() <= subscription_record.trial_end_date THEN
    RETURN 'trial';
  END IF;
  
  -- Grace period
  IF now() <= (subscription_record.trial_end_date + interval '7 days') THEN
    RETURN 'trial_expired';
  END IF;
  
  -- Suspended after grace period
  RETURN 'suspended';
END;
$$;

-- Function to log trial status changes
CREATE OR REPLACE FUNCTION public.log_trial_status_change(_landlord_id uuid, _old_status text, _new_status text, _reason text DEFAULT NULL, _metadata jsonb DEFAULT '{}')
RETURNS void
LANGUAGE sql
SECURITY DEFINER
SET search_path = ''
AS $$
  INSERT INTO public.trial_status_logs (landlord_id, old_status, new_status, reason, metadata)
  VALUES (_landlord_id, _old_status, _new_status, _reason, _metadata);
$$;

-- Insert default trial notification templates
INSERT INTO public.trial_notification_templates (template_name, notification_type, days_before_expiry, subject, html_content, email_content) VALUES
('trial_reminder_7', 'trial_reminder', 7, 'Your Zira Homes trial expires in 7 days', 
 '<h1>Your trial expires soon!</h1><p>Your Zira Homes trial will expire in 7 days. Upgrade now to continue using all features.</p><p><a href="{{upgrade_url}}" style="background-color: #007bff; color: white; padding: 10px 20px; text-decoration: none; border-radius: 5px;">Upgrade Now</a></p>',
 'Your Zira Homes trial will expire in 7 days. Upgrade now to continue using all features.'),
 
('trial_reminder_3', 'trial_reminder', 3, 'Your Zira Homes trial expires in 3 days', 
 '<h1>Only 3 days left!</h1><p>Your Zira Homes trial expires in 3 days. Don''t lose access to your property management tools.</p><p><a href="{{upgrade_url}}" style="background-color: #dc3545; color: white; padding: 10px 20px; text-decoration: none; border-radius: 5px;">Upgrade Now</a></p>',
 'Your Zira Homes trial expires in 3 days. Don''t lose access to your property management tools.'),
 
('trial_reminder_1', 'trial_reminder', 1, 'Last chance - Your trial expires tomorrow!', 
 '<h1>Last chance!</h1><p>Your Zira Homes trial expires tomorrow. Upgrade now to avoid losing access to your data and features.</p><p><a href="{{upgrade_url}}" style="background-color: #dc3545; color: white; padding: 10px 20px; text-decoration: none; border-radius: 5px;">Upgrade Immediately</a></p>',
 'Your Zira Homes trial expires tomorrow. Upgrade now to avoid losing access to your data and features.'),
 
('trial_expired', 'trial_expired', 0, 'Your Zira Homes trial has expired', 
 '<h1>Trial Expired</h1><p>Your Zira Homes trial has expired. You have 7 days of limited access to export your data and upgrade.</p><p><a href="{{upgrade_url}}" style="background-color: #007bff; color: white; padding: 10px 20px; text-decoration: none; border-radius: 5px;">Upgrade Now</a></p>',
 'Your Zira Homes trial has expired. You have 7 days of limited access to export your data and upgrade.'),
 
('grace_period_end', 'grace_period_end', -7, 'Final notice - Account will be suspended', 
 '<h1>Final Notice</h1><p>Your grace period ends today. Your account will be suspended if you don''t upgrade immediately.</p><p><a href="{{upgrade_url}}" style="background-color: #dc3545; color: white; padding: 10px 20px; text-decoration: none; border-radius: 5px;">Upgrade Now</a></p>',
 'Your grace period ends today. Your account will be suspended if you don''t upgrade immediately.') 
ON CONFLICT DO NOTHING;

-- Create trigger to update trial notification templates timestamps
CREATE TRIGGER update_trial_notification_templates_updated_at
    BEFORE UPDATE ON public.trial_notification_templates
    FOR EACH ROW
    EXECUTE FUNCTION public.update_updated_at_column();