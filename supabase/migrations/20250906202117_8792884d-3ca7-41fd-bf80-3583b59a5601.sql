-- Remove hardcoded SMS credentials and clean up policies
-- First, update sms_providers to remove any hardcoded credentials  
UPDATE public.sms_providers 
SET authorization_token = '[REDACTED]'
WHERE authorization_token IS NOT NULL 
  AND authorization_token != '[REDACTED]';

-- Create safe view for mpesa credentials (prevent exposing secrets to client)
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