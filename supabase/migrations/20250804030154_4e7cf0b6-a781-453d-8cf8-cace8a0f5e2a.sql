-- Create billing plans table
CREATE TABLE IF NOT EXISTS public.billing_plans (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT,
  price DECIMAL(10,2) NOT NULL,
  billing_cycle TEXT NOT NULL CHECK (billing_cycle IN ('monthly', 'quarterly', 'annual')),
  max_properties INTEGER,
  max_units INTEGER,
  sms_credits_included INTEGER DEFAULT 0,
  features JSONB DEFAULT '[]'::jsonb,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create landlord subscriptions table
CREATE TABLE IF NOT EXISTS public.landlord_subscriptions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  landlord_id UUID NOT NULL,
  billing_plan_id UUID REFERENCES public.billing_plans(id),
  status TEXT NOT NULL DEFAULT 'trial' CHECK (status IN ('trial', 'active', 'suspended', 'cancelled', 'overdue')),
  trial_start_date TIMESTAMP WITH TIME ZONE,
  trial_end_date TIMESTAMP WITH TIME ZONE,
  subscription_start_date TIMESTAMP WITH TIME ZONE,
  next_billing_date TIMESTAMP WITH TIME ZONE,
  last_billing_date TIMESTAMP WITH TIME ZONE,
  sms_credits_balance INTEGER DEFAULT 0,
  auto_renewal BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create SMS usage tracking table
CREATE TABLE IF NOT EXISTS public.sms_usage (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  landlord_id UUID NOT NULL,
  recipient_phone TEXT NOT NULL,
  message_content TEXT,
  cost DECIMAL(10,2) NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('sent', 'failed', 'pending')),
  sent_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create SMS bundles table
CREATE TABLE IF NOT EXISTS public.sms_bundles (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT,
  sms_count INTEGER NOT NULL,
  price DECIMAL(10,2) NOT NULL,
  currency TEXT NOT NULL DEFAULT 'USD',
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create payment transactions table
CREATE TABLE IF NOT EXISTS public.payment_transactions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  invoice_id UUID REFERENCES public.invoices(id),
  landlord_id UUID NOT NULL,
  transaction_id TEXT,
  payment_method TEXT NOT NULL CHECK (payment_method IN ('mpesa', 'stripe', 'bank_transfer', 'manual')),
  amount DECIMAL(10,2) NOT NULL,
  currency TEXT NOT NULL DEFAULT 'USD',
  status TEXT NOT NULL CHECK (status IN ('pending', 'completed', 'failed', 'refunded')),
  gateway_response JSONB,
  processed_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create billing settings table
CREATE TABLE IF NOT EXISTS public.billing_settings (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  setting_key TEXT NOT NULL UNIQUE,
  setting_value JSONB NOT NULL,
  description TEXT,
  updated_by UUID,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable Row Level Security for new tables
ALTER TABLE public.billing_plans ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.landlord_subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sms_usage ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sms_bundles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payment_transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.billing_settings ENABLE ROW LEVEL SECURITY;

-- Create RLS policies for billing_plans
DROP POLICY IF EXISTS "Admins can manage billing plans" ON public.billing_plans;
CREATE POLICY "Admins can manage billing plans" ON public.billing_plans
FOR ALL USING (has_role(auth.uid(), 'Admin'::app_role));

DROP POLICY IF EXISTS "Landlords can view active billing plans" ON public.billing_plans;
CREATE POLICY "Landlords can view active billing plans" ON public.billing_plans
FOR SELECT USING (is_active = true AND has_role(auth.uid(), 'Landlord'::app_role));

-- Create RLS policies for landlord_subscriptions
DROP POLICY IF EXISTS "Admins can manage all subscriptions" ON public.landlord_subscriptions;
CREATE POLICY "Admins can manage all subscriptions" ON public.landlord_subscriptions
FOR ALL USING (has_role(auth.uid(), 'Admin'::app_role));

DROP POLICY IF EXISTS "Landlords can view their own subscription" ON public.landlord_subscriptions;
CREATE POLICY "Landlords can view their own subscription" ON public.landlord_subscriptions
FOR SELECT USING (has_role(auth.uid(), 'Landlord'::app_role) AND landlord_id = auth.uid());

-- Create RLS policies for sms_usage
DROP POLICY IF EXISTS "Admins can manage all SMS usage" ON public.sms_usage;
CREATE POLICY "Admins can manage all SMS usage" ON public.sms_usage
FOR ALL USING (has_role(auth.uid(), 'Admin'::app_role));

DROP POLICY IF EXISTS "Landlords can view their own SMS usage" ON public.sms_usage;
CREATE POLICY "Landlords can view their own SMS usage" ON public.sms_usage
FOR SELECT USING (has_role(auth.uid(), 'Landlord'::app_role) AND landlord_id = auth.uid());

-- Create RLS policies for sms_bundles
DROP POLICY IF EXISTS "Admins can manage SMS bundles" ON public.sms_bundles;
CREATE POLICY "Admins can manage SMS bundles" ON public.sms_bundles
FOR ALL USING (has_role(auth.uid(), 'Admin'::app_role));

DROP POLICY IF EXISTS "Landlords can view active SMS bundles" ON public.sms_bundles;
CREATE POLICY "Landlords can view active SMS bundles" ON public.sms_bundles
FOR SELECT USING (is_active = true AND has_role(auth.uid(), 'Landlord'::app_role));

-- Create RLS policies for payment_transactions
DROP POLICY IF EXISTS "Admins can manage all payment transactions" ON public.payment_transactions;
CREATE POLICY "Admins can manage all payment transactions" ON public.payment_transactions
FOR ALL USING (has_role(auth.uid(), 'Admin'::app_role));

DROP POLICY IF EXISTS "Landlords can view their own payment transactions" ON public.payment_transactions;
CREATE POLICY "Landlords can view their own payment transactions" ON public.payment_transactions
FOR SELECT USING (has_role(auth.uid(), 'Landlord'::app_role) AND landlord_id = auth.uid());

-- Create RLS policies for billing_settings
DROP POLICY IF EXISTS "Admins can manage billing settings" ON public.billing_settings;
CREATE POLICY "Admins can manage billing settings" ON public.billing_settings
FOR ALL USING (has_role(auth.uid(), 'Admin'::app_role));

-- Insert default billing settings (only if they don't exist)
INSERT INTO public.billing_settings (setting_key, setting_value, description) 
VALUES 
('trial_period_days', '14', 'Number of days for free trial period'),
('sms_cost_per_unit', '0.05', 'Cost per SMS in USD'),
('grace_period_days', '7', 'Days before suspension after overdue'),
('auto_invoice_generation', 'true', 'Automatically generate invoices'),
('payment_reminder_days', '[3, 1]', 'Days before due date to send payment reminders'),
('currency_settings', '{"default": "USD", "supported": ["USD", "KES"]}', 'Currency configuration')
ON CONFLICT (setting_key) DO NOTHING;

-- Insert default billing plans (only if they don't exist)
INSERT INTO public.billing_plans (name, description, price, billing_cycle, max_properties, max_units, sms_credits_included, features) 
SELECT 'Starter', 'Perfect for small landlords', 29.99, 'monthly', 5, 25, 100, '["Basic reporting", "Email support", "Mobile app access"]'
WHERE NOT EXISTS (SELECT 1 FROM public.billing_plans WHERE name = 'Starter');

INSERT INTO public.billing_plans (name, description, price, billing_cycle, max_properties, max_units, sms_credits_included, features) 
SELECT 'Professional', 'For growing property portfolios', 79.99, 'monthly', 20, 100, 500, '["Advanced reporting", "Priority support", "API access", "Custom branding"]'
WHERE NOT EXISTS (SELECT 1 FROM public.billing_plans WHERE name = 'Professional');

INSERT INTO public.billing_plans (name, description, price, billing_cycle, max_properties, max_units, sms_credits_included, features) 
SELECT 'Enterprise', 'For large property management companies', 199.99, 'monthly', -1, -1, 2000, '["Unlimited properties", "Dedicated support", "Custom integrations", "White labeling"]'
WHERE NOT EXISTS (SELECT 1 FROM public.billing_plans WHERE name = 'Enterprise');

-- Insert default SMS bundles (only if they don't exist)
INSERT INTO public.sms_bundles (name, description, sms_count, price) 
SELECT 'Small Bundle', '100 SMS credits', 100, 5.00
WHERE NOT EXISTS (SELECT 1 FROM public.sms_bundles WHERE name = 'Small Bundle');

INSERT INTO public.sms_bundles (name, description, sms_count, price) 
SELECT 'Medium Bundle', '500 SMS credits', 500, 20.00
WHERE NOT EXISTS (SELECT 1 FROM public.sms_bundles WHERE name = 'Medium Bundle');

INSERT INTO public.sms_bundles (name, description, sms_count, price) 
SELECT 'Large Bundle', '1000 SMS credits', 1000, 35.00
WHERE NOT EXISTS (SELECT 1 FROM public.sms_bundles WHERE name = 'Large Bundle');

INSERT INTO public.sms_bundles (name, description, sms_count, price) 
SELECT 'Bulk Bundle', '5000 SMS credits', 5000, 150.00
WHERE NOT EXISTS (SELECT 1 FROM public.sms_bundles WHERE name = 'Bulk Bundle');