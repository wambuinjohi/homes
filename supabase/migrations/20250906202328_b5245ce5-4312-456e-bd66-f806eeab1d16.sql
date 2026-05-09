-- Fix security linter warnings
-- 1. Fix function search path issues by setting explicit search_path to empty string
ALTER FUNCTION public.has_role(uuid, app_role) SET search_path TO '';
ALTER FUNCTION public.can_assign_role(uuid, app_role) SET search_path TO '';
ALTER FUNCTION public.can_remove_role(uuid, uuid, app_role) SET search_path TO '';
ALTER FUNCTION public.log_security_event(text, jsonb, uuid, inet) SET search_path TO '';
ALTER FUNCTION public.log_user_activity(uuid, text, text, uuid, jsonb, inet, text) SET search_path TO '';

-- 2. Fix the SECURITY DEFINER view warning by replacing view with a function
DROP VIEW IF EXISTS public.mpesa_credentials_safe;

-- Create a secure function instead of a SECURITY DEFINER view
CREATE OR REPLACE FUNCTION public.get_mpesa_credentials_safe(_landlord_id uuid DEFAULT auth.uid())
RETURNS TABLE(
  id uuid,
  landlord_id uuid,
  shortcode text,
  is_sandbox boolean,
  created_at timestamptz,
  updated_at timestamptz,
  has_consumer_key text,
  has_consumer_secret text,
  has_passkey text
)
LANGUAGE sql
SECURITY DEFINER
SET search_path TO ''
AS $$
  SELECT 
    mc.id,
    mc.landlord_id,
    mc.shortcode,
    mc.is_sandbox,
    mc.created_at,
    mc.updated_at,
    CASE WHEN mc.consumer_key IS NOT NULL THEN '***configured***' ELSE NULL END,
    CASE WHEN mc.consumer_secret IS NOT NULL THEN '***configured***' ELSE NULL END,
    CASE WHEN mc.passkey IS NOT NULL THEN '***configured***' ELSE NULL END
  FROM public.mpesa_credentials mc
  WHERE mc.landlord_id = _landlord_id
    AND (auth.uid() = _landlord_id OR public.has_role(auth.uid(), 'Admin'::app_role));
$$;