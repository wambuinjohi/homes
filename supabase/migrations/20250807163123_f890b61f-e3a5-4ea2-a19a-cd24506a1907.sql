-- Create tables for SMS provider configurations and logs
CREATE TABLE IF NOT EXISTS public.sms_providers (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  provider_name text NOT NULL UNIQUE,
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

-- Drop existing policies if they exist
DROP POLICY IF EXISTS "Admins can manage SMS providers" ON public.sms_providers;

-- Create policies
CREATE POLICY "Admins can manage SMS providers"
ON public.sms_providers
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

-- Drop existing policies if they exist
DROP POLICY IF EXISTS "Admins can view all SMS usage logs" ON public.sms_usage_logs;
DROP POLICY IF EXISTS "Landlords can view their own SMS usage logs" ON public.sms_usage_logs;
DROP POLICY IF EXISTS "System can insert SMS usage logs" ON public.sms_usage_logs;

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

-- Drop existing triggers if they exist
DROP TRIGGER IF EXISTS update_sms_providers_updated_at ON public.sms_providers;

CREATE TRIGGER update_sms_providers_updated_at
  BEFORE UPDATE ON public.sms_providers
  FOR EACH ROW
  EXECUTE FUNCTION public.update_sms_provider_updated_at();

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