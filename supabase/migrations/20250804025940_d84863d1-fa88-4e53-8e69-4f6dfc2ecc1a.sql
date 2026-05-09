-- Create billing plans table
CREATE TABLE public.billing_plans (
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
CREATE TABLE public.landlord_subscriptions (
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

-- Create invoices table
CREATE TABLE public.invoices (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  invoice_number TEXT NOT NULL UNIQUE,
  landlord_id UUID NOT NULL,
  subscription_id UUID REFERENCES public.landlord_subscriptions(id),
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'paid', 'overdue', 'cancelled', 'refunded')),
  subtotal DECIMAL(10,2) NOT NULL DEFAULT 0,
  tax_amount DECIMAL(10,2) DEFAULT 0,
  discount_amount DECIMAL(10,2) DEFAULT 0,
  total_amount DECIMAL(10,2) NOT NULL,
  currency TEXT NOT NULL DEFAULT 'USD',
  invoice_date DATE NOT NULL DEFAULT CURRENT_DATE,
  due_date DATE NOT NULL,
  paid_date TIMESTAMP WITH TIME ZONE,
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create invoice items table
CREATE TABLE public.invoice_items (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  invoice_id UUID NOT NULL REFERENCES public.invoices(id) ON DELETE CASCADE,
  item_type TEXT NOT NULL CHECK (item_type IN ('subscription', 'sms_bundle', 'addon', 'discount')),
  description TEXT NOT NULL,
  quantity INTEGER NOT NULL DEFAULT 1,
  unit_price DECIMAL(10,2) NOT NULL,
  total_price DECIMAL(10,2) NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create SMS usage tracking table
CREATE TABLE public.sms_usage (
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
CREATE TABLE public.sms_bundles (
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
CREATE TABLE public.payment_transactions (
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
CREATE TABLE public.billing_settings (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  setting_key TEXT NOT NULL UNIQUE,
  setting_value JSONB NOT NULL,
  description TEXT,
  updated_by UUID,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable Row Level Security
ALTER TABLE public.billing_plans ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.landlord_subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.invoices ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.invoice_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sms_usage ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sms_bundles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payment_transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.billing_settings ENABLE ROW LEVEL SECURITY;

-- Create RLS policies for billing_plans
CREATE POLICY "Admins can manage billing plans" ON public.billing_plans
FOR ALL USING (has_role(auth.uid(), 'Admin'::app_role));

CREATE POLICY "Landlords can view active billing plans" ON public.billing_plans
FOR SELECT USING (is_active = true AND has_role(auth.uid(), 'Landlord'::app_role));

-- Create RLS policies for landlord_subscriptions
CREATE POLICY "Admins can manage all subscriptions" ON public.landlord_subscriptions
FOR ALL USING (has_role(auth.uid(), 'Admin'::app_role));

CREATE POLICY "Landlords can view their own subscription" ON public.landlord_subscriptions
FOR SELECT USING (has_role(auth.uid(), 'Landlord'::app_role) AND landlord_id = auth.uid());

-- Create RLS policies for invoices
CREATE POLICY "Admins can manage all invoices" ON public.invoices
FOR ALL USING (has_role(auth.uid(), 'Admin'::app_role));

CREATE POLICY "Landlords can view their own invoices" ON public.invoices
FOR SELECT USING (has_role(auth.uid(), 'Landlord'::app_role) AND landlord_id = auth.uid());

-- Create RLS policies for invoice_items
CREATE POLICY "Admins can manage all invoice items" ON public.invoice_items
FOR ALL USING (has_role(auth.uid(), 'Admin'::app_role));

CREATE POLICY "Landlords can view their own invoice items" ON public.invoice_items
FOR SELECT USING (
  has_role(auth.uid(), 'Landlord'::app_role) AND 
  EXISTS (
    SELECT 1 FROM public.invoices i 
    WHERE i.id = invoice_items.invoice_id AND i.landlord_id = auth.uid()
  )
);

-- Create RLS policies for sms_usage
CREATE POLICY "Admins can manage all SMS usage" ON public.sms_usage
FOR ALL USING (has_role(auth.uid(), 'Admin'::app_role));

CREATE POLICY "Landlords can view their own SMS usage" ON public.sms_usage
FOR SELECT USING (has_role(auth.uid(), 'Landlord'::app_role) AND landlord_id = auth.uid());

-- Create RLS policies for sms_bundles
CREATE POLICY "Admins can manage SMS bundles" ON public.sms_bundles
FOR ALL USING (has_role(auth.uid(), 'Admin'::app_role));

CREATE POLICY "Landlords can view active SMS bundles" ON public.sms_bundles
FOR SELECT USING (is_active = true AND has_role(auth.uid(), 'Landlord'::app_role));

-- Create RLS policies for payment_transactions
CREATE POLICY "Admins can manage all payment transactions" ON public.payment_transactions
FOR ALL USING (has_role(auth.uid(), 'Admin'::app_role));

CREATE POLICY "Landlords can view their own payment transactions" ON public.payment_transactions
FOR SELECT USING (has_role(auth.uid(), 'Landlord'::app_role) AND landlord_id = auth.uid());

-- Create RLS policies for billing_settings
CREATE POLICY "Admins can manage billing settings" ON public.billing_settings
FOR ALL USING (has_role(auth.uid(), 'Admin'::app_role));

-- Create indexes for better performance
CREATE INDEX idx_landlord_subscriptions_landlord_id ON public.landlord_subscriptions(landlord_id);
CREATE INDEX idx_landlord_subscriptions_status ON public.landlord_subscriptions(status);
CREATE INDEX idx_invoices_landlord_id ON public.invoices(landlord_id);
CREATE INDEX idx_invoices_status ON public.invoices(status);
CREATE INDEX idx_invoices_due_date ON public.invoices(due_date);
CREATE INDEX idx_sms_usage_landlord_id ON public.sms_usage(landlord_id);
CREATE INDEX idx_sms_usage_sent_at ON public.sms_usage(sent_at);
CREATE INDEX idx_payment_transactions_landlord_id ON public.payment_transactions(landlord_id);
CREATE INDEX idx_payment_transactions_status ON public.payment_transactions(status);

-- Create triggers for updated_at
CREATE TRIGGER update_billing_plans_updated_at
BEFORE UPDATE ON public.billing_plans
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_landlord_subscriptions_updated_at
BEFORE UPDATE ON public.landlord_subscriptions
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_invoices_updated_at
BEFORE UPDATE ON public.invoices
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_sms_bundles_updated_at
BEFORE UPDATE ON public.sms_bundles
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_billing_settings_updated_at
BEFORE UPDATE ON public.billing_settings
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Insert default billing settings
INSERT INTO public.billing_settings (setting_key, setting_value, description) VALUES
('trial_period_days', '14', 'Number of days for free trial period'),
('sms_cost_per_unit', '0.05', 'Cost per SMS in USD'),
('grace_period_days', '7', 'Days before suspension after overdue'),
('auto_invoice_generation', 'true', 'Automatically generate invoices'),
('payment_reminder_days', '[3, 1]', 'Days before due date to send payment reminders'),
('currency_settings', '{"default": "USD", "supported": ["USD", "KES"]}', 'Currency configuration');

-- Insert default billing plans
INSERT INTO public.billing_plans (name, description, price, billing_cycle, max_properties, max_units, sms_credits_included, features) VALUES
('Starter', 'Perfect for small landlords', 29.99, 'monthly', 5, 25, 100, '["Basic reporting", "Email support", "Mobile app access"]'),
('Professional', 'For growing property portfolios', 79.99, 'monthly', 20, 100, 500, '["Advanced reporting", "Priority support", "API access", "Custom branding"]'),
('Enterprise', 'For large property management companies', 199.99, 'monthly', -1, -1, 2000, '["Unlimited properties", "Dedicated support", "Custom integrations", "White labeling"]');

-- Insert default SMS bundles
INSERT INTO public.sms_bundles (name, description, sms_count, price) VALUES
('Small Bundle', '100 SMS credits', 100, 5.00),
('Medium Bundle', '500 SMS credits', 500, 20.00),
('Large Bundle', '1000 SMS credits', 1000, 35.00),
('Bulk Bundle', '5000 SMS credits', 5000, 150.00);

-- Create function to generate invoice numbers
CREATE OR REPLACE FUNCTION public.generate_invoice_number()
RETURNS TEXT AS $$
DECLARE
  next_number INTEGER;
  invoice_number TEXT;
BEGIN
  -- Get the next invoice number (simple sequential numbering)
  SELECT COALESCE(MAX(CAST(SUBSTRING(invoice_number FROM '[0-9]+$') AS INTEGER)), 0) + 1
  INTO next_number
  FROM public.invoices
  WHERE invoice_number ~ '^INV-[0-9]+$';
  
  invoice_number := 'INV-' || LPAD(next_number::TEXT, 6, '0');
  
  RETURN invoice_number;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;