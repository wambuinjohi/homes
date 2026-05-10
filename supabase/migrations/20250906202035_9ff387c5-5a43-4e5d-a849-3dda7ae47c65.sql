-- Remove hardcoded SMS credentials and clean up policies
-- First, update sms_providers to remove any hardcoded credentials
UPDATE public.sms_providers 
SET authorization_token = '[REDACTED]'
WHERE authorization_token IS NOT NULL 
  AND authorization_token != '[REDACTED]';

-- Add RLS policy for sms_usage_logs if it doesn't exist
ALTER TABLE public.sms_usage_logs ENABLE ROW LEVEL SECURITY;

-- Clean up any duplicate RLS policies
DROP POLICY IF EXISTS "Landlords can view their own SMS usage" ON public.sms_usage_logs;
DROP POLICY IF EXISTS "Admins can manage all SMS usage" ON public.sms_usage_logs;

-- Create proper RLS policies for sms_usage_logs
CREATE POLICY "Landlords can view their SMS usage" 
ON public.sms_usage_logs 
FOR SELECT 
USING (landlord_id = auth.uid() OR has_role(auth.uid(), 'Admin'::app_role));

CREATE POLICY "System can insert SMS usage logs" 
ON public.sms_usage_logs 
FOR INSERT 
WITH CHECK (true);

-- Ensure mpesa_credentials has proper RLS
ALTER TABLE public.mpesa_credentials ENABLE ROW LEVEL SECURITY;

-- Add policy to prevent SELECT of sensitive fields from client
CREATE OR REPLACE VIEW public.mpesa_credentials_safe AS
SELECT 
  id,
  landlord_id,
  shortcode,
  is_sandbox,
  created_at,
  updated_at,
  CASE WHEN consumer_key IS NOT NULL THEN '***configured***' ELSE NULL END as has_consumer_key,
  CASE WHEN consumer_secret IS NOT NULL THEN '***configured***' ELSE NULL END as has_consumer_secret,
  CASE WHEN passkey IS NOT NULL THEN '***configured***' ELSE NULL END as has_passkey
FROM public.mpesa_credentials;