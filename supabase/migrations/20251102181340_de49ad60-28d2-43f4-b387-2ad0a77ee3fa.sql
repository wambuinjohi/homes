-- Create billing_settings table
CREATE TABLE IF NOT EXISTS billing_settings (
  setting_key TEXT PRIMARY KEY,
  setting_value JSONB NOT NULL,
  description TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE billing_settings ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Admins can manage billing settings" 
  ON billing_settings FOR ALL 
  USING (has_role(auth.uid(), 'Admin'::app_role));

CREATE POLICY "Authenticated users can view settings" 
  ON billing_settings FOR SELECT 
  USING (auth.uid() IS NOT NULL);

-- Insert default trial settings
INSERT INTO billing_settings (setting_key, setting_value, description) VALUES
('trial_settings', '{
  "trial_period_days": 30,
  "grace_period_days": 7,
  "auto_invoice_generation": true,
  "payment_reminder_days": [3, 1],
  "default_sms_credits": 200,
  "sms_cost_per_unit": 0.05,
  "cutoff_date_utc": "2025-01-01T00:00:00Z",
  "pre_cutoff_days": 30,
  "post_cutoff_days": 14,
  "policy_history": []
}'::jsonb, 'Trial subscription configuration settings')
ON CONFLICT (setting_key) DO NOTHING;

-- Add missing columns to billing_plans
ALTER TABLE billing_plans 
  ADD COLUMN IF NOT EXISTS billing_model TEXT DEFAULT 'percentage' CHECK (billing_model IN ('percentage', 'fixed_per_unit', 'tiered')),
  ADD COLUMN IF NOT EXISTS percentage_rate DECIMAL(5,2),
  ADD COLUMN IF NOT EXISTS fixed_amount_per_unit DECIMAL(10,2),
  ADD COLUMN IF NOT EXISTS tier_pricing JSONB,
  ADD COLUMN IF NOT EXISTS currency TEXT DEFAULT 'KES';

-- Update existing plans with default values
UPDATE billing_plans SET 
  billing_model = 'percentage',
  percentage_rate = 2.0,
  currency = 'KES'
WHERE billing_model IS NULL;

-- Add missing columns to landlord_subscriptions
ALTER TABLE landlord_subscriptions
  ADD COLUMN IF NOT EXISTS onboarding_completed BOOLEAN DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS trial_usage_data JSONB DEFAULT '{}'::jsonb;

-- Create trial_notification_templates table
CREATE TABLE IF NOT EXISTS trial_notification_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  template_name TEXT NOT NULL UNIQUE,
  subject TEXT NOT NULL,
  email_content TEXT NOT NULL,
  html_content TEXT NOT NULL,
  days_before_expiry INTEGER NOT NULL,
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable RLS for trial_notification_templates
ALTER TABLE trial_notification_templates ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins manage trial templates" 
  ON trial_notification_templates FOR ALL 
  USING (has_role(auth.uid(), 'Admin'::app_role));

-- Insert default notification templates
INSERT INTO trial_notification_templates (template_name, subject, email_content, html_content, days_before_expiry) VALUES
('trial_30_days', 'Welcome to Your 30-Day Free Trial!', 
 'Hi {{first_name}},\n\nWelcome! Your 30-day free trial has started. You have {{days_remaining}} days to explore all features.\n\nUpgrade anytime: {{upgrade_url}}',
 '<h2>Welcome {{first_name}}!</h2><p>Your 30-day free trial has started. You have <strong>{{days_remaining}} days</strong> remaining.</p><p><a href="{{upgrade_url}}">Upgrade Now</a></p>',
 30),
('trial_7_days', 'Your Trial Expires in 7 Days', 
 'Hi {{first_name}},\n\nYou have 7 days left in your trial. Upgrade now to keep access to all features.\n\nUpgrade: {{upgrade_url}}',
 '<h2>Hi {{first_name}}</h2><p>Your trial expires in <strong>7 days</strong>.</p><p><a href="{{upgrade_url}}">Upgrade Now</a></p>',
 7),
('trial_3_days', 'Your Trial Expires in 3 Days', 
 'Hi {{first_name}},\n\nOnly 3 days left! Upgrade now to continue using all features.\n\nUpgrade: {{upgrade_url}}',
 '<h2>Hi {{first_name}}</h2><p>Your trial expires in <strong>3 days</strong>.</p><p><a href="{{upgrade_url}}">Upgrade Now</a></p>',
 3),
('trial_1_day', 'Your Trial Expires Tomorrow!', 
 'Hi {{first_name}},\n\nYour trial ends tomorrow. Upgrade today to avoid interruption.\n\nUpgrade: {{upgrade_url}}',
 '<h2>Hi {{first_name}}</h2><p>Your trial expires <strong>tomorrow</strong>!</p><p><a href="{{upgrade_url}}">Upgrade Now</a></p>',
 1),
('trial_expired', 'Your Trial Has Ended', 
 'Hi {{first_name}},\n\nYour trial has ended. You have a 7-day grace period. Upgrade now to restore full access.\n\nUpgrade: {{upgrade_url}}',
 '<h2>Hi {{first_name}}</h2><p>Your trial has ended. You have a <strong>7-day grace period</strong>.</p><p><a href="{{upgrade_url}}">Upgrade Now</a></p>',
 0)
ON CONFLICT (template_name) DO NOTHING;