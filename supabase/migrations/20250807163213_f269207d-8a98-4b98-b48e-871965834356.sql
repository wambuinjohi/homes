-- Check if sms_providers table exists and add unique constraint
DO $$
BEGIN
    -- Add unique constraint to provider_name if it doesn't exist
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.table_constraints 
        WHERE constraint_name = 'sms_providers_provider_name_key' 
        AND table_name = 'sms_providers' 
        AND table_schema = 'public'
    ) THEN
        ALTER TABLE public.sms_providers ADD CONSTRAINT sms_providers_provider_name_key UNIQUE (provider_name);
    END IF;
END $$;

-- Create table for SMS usage logs if it doesn't exist
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

-- Enable RLS on sms_usage_logs
ALTER TABLE public.sms_usage_logs ENABLE ROW LEVEL SECURITY;

-- Drop and recreate policies for sms_usage_logs
DROP POLICY IF EXISTS "Admins can view all SMS usage logs" ON public.sms_usage_logs;
DROP POLICY IF EXISTS "Landlords can view their own SMS usage logs" ON public.sms_usage_logs;
DROP POLICY IF EXISTS "System can insert SMS usage logs" ON public.sms_usage_logs;

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

-- Insert default SMS provider configuration (update if exists)
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
ON CONFLICT (provider_name) DO UPDATE SET
  authorization_token = EXCLUDED.authorization_token,
  username = EXCLUDED.username,
  sender_id = EXCLUDED.sender_id,
  base_url = EXCLUDED.base_url,
  unique_identifier = EXCLUDED.unique_identifier,
  sender_type = EXCLUDED.sender_type,
  is_active = EXCLUDED.is_active,
  is_default = EXCLUDED.is_default,
  config_data = EXCLUDED.config_data,
  updated_at = now();