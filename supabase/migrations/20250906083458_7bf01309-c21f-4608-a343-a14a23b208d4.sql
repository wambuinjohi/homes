-- Create sub_users table for sub-user management
CREATE TABLE IF NOT EXISTS public.sub_users (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  landlord_id uuid NOT NULL,
  user_id uuid,
  title text,
  permissions jsonb NOT NULL DEFAULT '{}',
  status text NOT NULL DEFAULT 'active',
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT fk_sub_users_landlord FOREIGN KEY (landlord_id) REFERENCES auth.users(id) ON DELETE CASCADE
);

-- Enable RLS on sub_users
ALTER TABLE public.sub_users ENABLE ROW LEVEL SECURITY;

-- Create policies for sub_users
CREATE POLICY "Landlords can manage their sub-users" ON public.sub_users
  FOR ALL USING (landlord_id = auth.uid() OR has_role(auth.uid(), 'Admin'::public.app_role));

-- Create email_templates table
CREATE TABLE IF NOT EXISTS public.email_templates (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  landlord_id uuid,
  name text NOT NULL,
  subject text NOT NULL,
  content text NOT NULL,
  category text NOT NULL,
  enabled boolean NOT NULL DEFAULT true,
  variables text[] DEFAULT '{}',
  is_default boolean DEFAULT false,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT fk_email_templates_landlord FOREIGN KEY (landlord_id) REFERENCES auth.users(id) ON DELETE CASCADE
);

-- Enable RLS on email_templates
ALTER TABLE public.email_templates ENABLE ROW LEVEL SECURITY;

-- Create policies for email_templates  
CREATE POLICY "Landlords can manage their email templates" ON public.email_templates
  FOR ALL USING (landlord_id = auth.uid() OR landlord_id IS NULL OR has_role(auth.uid(), 'Admin'::public.app_role));

-- Create sms_templates table
CREATE TABLE IF NOT EXISTS public.sms_templates (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  landlord_id uuid,
  name text NOT NULL,
  content text NOT NULL,
  category text NOT NULL,
  enabled boolean NOT NULL DEFAULT true,
  variables text[] DEFAULT '{}',
  is_default boolean DEFAULT false,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT fk_sms_templates_landlord FOREIGN KEY (landlord_id) REFERENCES auth.users(id) ON DELETE CASCADE
);

-- Enable RLS on sms_templates
ALTER TABLE public.sms_templates ENABLE ROW LEVEL SECURITY;

-- Create policies for sms_templates
CREATE POLICY "Landlords can manage their SMS templates" ON public.sms_templates
  FOR ALL USING (landlord_id = auth.uid() OR landlord_id IS NULL OR has_role(auth.uid(), 'Admin'::public.app_role));

-- Create landlord_payment_preferences table
CREATE TABLE IF NOT EXISTS public.landlord_payment_preferences (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  landlord_id uuid NOT NULL UNIQUE,
  preferred_payment_method text NOT NULL DEFAULT 'mpesa',
  mpesa_phone_number text,
  bank_account_details jsonb,
  payment_instructions text,
  auto_payment_enabled boolean NOT NULL DEFAULT false,
  payment_reminders_enabled boolean NOT NULL DEFAULT true,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT fk_landlord_payment_preferences_landlord FOREIGN KEY (landlord_id) REFERENCES auth.users(id) ON DELETE CASCADE
);

-- Enable RLS on landlord_payment_preferences
ALTER TABLE public.landlord_payment_preferences ENABLE ROW LEVEL SECURITY;

-- Create policies for landlord_payment_preferences
CREATE POLICY "Landlords can manage their payment preferences" ON public.landlord_payment_preferences
  FOR ALL USING (landlord_id = auth.uid() OR has_role(auth.uid(), 'Admin'::public.app_role));

-- Create approved_payment_methods table
CREATE TABLE IF NOT EXISTS public.approved_payment_methods (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  payment_method_type text NOT NULL,
  provider_name text NOT NULL,
  is_active boolean NOT NULL DEFAULT true,
  country_code text NOT NULL DEFAULT 'KE',
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Enable RLS on approved_payment_methods
ALTER TABLE public.approved_payment_methods ENABLE ROW LEVEL SECURITY;

-- Create policies for approved_payment_methods
CREATE POLICY "Everyone can view active payment methods" ON public.approved_payment_methods
  FOR SELECT USING (is_active = true);

CREATE POLICY "Admins can manage payment methods" ON public.approved_payment_methods
  FOR ALL USING (has_role(auth.uid(), 'Admin'::public.app_role));

-- Insert default payment methods
INSERT INTO public.approved_payment_methods (payment_method_type, provider_name, country_code) VALUES
  ('mpesa', 'M-Pesa', 'KE'),
  ('airtel_money', 'Airtel Money', 'KE'),
  ('equitel', 'Equitel', 'KE')
ON CONFLICT DO NOTHING;

-- Add updated_at triggers
CREATE TRIGGER update_sub_users_updated_at 
  BEFORE UPDATE ON public.sub_users 
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_email_templates_updated_at 
  BEFORE UPDATE ON public.email_templates 
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_sms_templates_updated_at 
  BEFORE UPDATE ON public.sms_templates 
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_landlord_payment_preferences_updated_at 
  BEFORE UPDATE ON public.landlord_payment_preferences 
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_approved_payment_methods_updated_at 
  BEFORE UPDATE ON public.approved_payment_methods 
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();