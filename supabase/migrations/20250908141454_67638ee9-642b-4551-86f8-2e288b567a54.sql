-- COMPREHENSIVE SECURITY FIX: Part 5 - Final Warning Fixes & Encryption Triggers
-- Fix the last function search path issue and complete encryption setup

-- Fix the remaining function without proper search_path
CREATE OR REPLACE FUNCTION public.cleanup_rate_limits()
RETURNS void 
LANGUAGE plpgsql 
SECURITY DEFINER 
SET search_path = public, pg_temp
AS $$
BEGIN
  -- Clean up old rate limit entries (older than 1 hour)
  DELETE FROM public.rate_limits 
  WHERE created_at < now() - interval '1 hour';
END;
$$;

-- Create encryption triggers for automatic encryption of sensitive data
-- Trigger for mpesa_credentials
CREATE OR REPLACE FUNCTION public.encrypt_mpesa_credentials()
RETURNS trigger 
LANGUAGE plpgsql 
SECURITY DEFINER 
SET search_path = public, pg_temp
AS $$
BEGIN
  -- Encrypt sensitive fields when inserting or updating
  IF NEW.consumer_key IS NOT NULL THEN
    NEW.consumer_key_encrypted := public.encrypt_sensitive_data(NEW.consumer_key, 'mpesa_key');
    NEW.consumer_key := '***ENCRYPTED***';  -- Mask the original
  END IF;
  
  IF NEW.consumer_secret IS NOT NULL THEN
    NEW.consumer_secret_encrypted := public.encrypt_sensitive_data(NEW.consumer_secret, 'mpesa_secret');
    NEW.consumer_secret := '***ENCRYPTED***';
  END IF;
  
  IF NEW.passkey IS NOT NULL THEN
    NEW.passkey_encrypted := public.encrypt_sensitive_data(NEW.passkey, 'mpesa_passkey');
    NEW.passkey := '***ENCRYPTED***';
  END IF;
  
  RETURN NEW;
END;
$$;

-- Trigger for tenants table
CREATE OR REPLACE FUNCTION public.encrypt_tenant_pii()
RETURNS trigger 
LANGUAGE plpgsql 
SECURITY DEFINER 
SET search_path = public, pg_temp
AS $$
BEGIN
  -- Encrypt and create search tokens for sensitive PII
  IF NEW.phone IS NOT NULL AND (TG_OP = 'INSERT' OR NEW.phone != OLD.phone) THEN
    NEW.phone_encrypted := public.encrypt_sensitive_data(NEW.phone, 'tenant_phone');
    NEW.phone_token := public.create_search_token(NEW.phone);
    NEW.phone := public.mask_sensitive_data(NEW.phone, 4);
  END IF;
  
  IF NEW.email IS NOT NULL AND (TG_OP = 'INSERT' OR NEW.email != OLD.email) THEN
    NEW.email_encrypted := public.encrypt_sensitive_data(NEW.email, 'tenant_email');
    NEW.email_token := public.create_search_token(NEW.email);
  END IF;
  
  IF NEW.national_id IS NOT NULL AND (TG_OP = 'INSERT' OR NEW.national_id != OLD.national_id) THEN
    NEW.national_id_encrypted := public.encrypt_sensitive_data(NEW.national_id, 'tenant_id');
    NEW.national_id := '***ENCRYPTED***';
  END IF;
  
  IF NEW.emergency_contact_phone IS NOT NULL AND (TG_OP = 'INSERT' OR NEW.emergency_contact_phone != OLD.emergency_contact_phone) THEN
    NEW.emergency_contact_phone_encrypted := public.encrypt_sensitive_data(NEW.emergency_contact_phone, 'emergency_phone');
    NEW.emergency_contact_phone := public.mask_sensitive_data(NEW.emergency_contact_phone, 4);
  END IF;
  
  RETURN NEW;
END;
$$;

-- Trigger for sms_usage table
CREATE OR REPLACE FUNCTION public.encrypt_sms_data()
RETURNS trigger 
LANGUAGE plpgsql 
SECURITY DEFINER 
SET search_path = public, pg_temp
AS $$
BEGIN
  -- Encrypt sensitive SMS data
  IF NEW.recipient_phone IS NOT NULL THEN
    NEW.recipient_phone_encrypted := public.encrypt_sensitive_data(NEW.recipient_phone, 'sms_phone');
    NEW.recipient_phone_token := public.create_search_token(NEW.recipient_phone);
    NEW.recipient_phone := public.mask_sensitive_data(NEW.recipient_phone, 4);
  END IF;
  
  IF NEW.message_content IS NOT NULL THEN
    NEW.message_content_encrypted := public.encrypt_sensitive_data(NEW.message_content, 'sms_content');
    NEW.message_content := '***MESSAGE ENCRYPTED***';
  END IF;
  
  RETURN NEW;
END;
$$;

-- Apply triggers to tables
DROP TRIGGER IF EXISTS encrypt_mpesa_credentials_trigger ON public.mpesa_credentials;
CREATE TRIGGER encrypt_mpesa_credentials_trigger
  BEFORE INSERT OR UPDATE ON public.mpesa_credentials
  FOR EACH ROW EXECUTE FUNCTION public.encrypt_mpesa_credentials();

DROP TRIGGER IF EXISTS encrypt_tenant_pii_trigger ON public.tenants;
CREATE TRIGGER encrypt_tenant_pii_trigger
  BEFORE INSERT OR UPDATE ON public.tenants
  FOR EACH ROW EXECUTE FUNCTION public.encrypt_tenant_pii();

DROP TRIGGER IF EXISTS encrypt_sms_data_trigger ON public.sms_usage;
CREATE TRIGGER encrypt_sms_data_trigger
  BEFORE INSERT OR UPDATE ON public.sms_usage
  FOR EACH ROW EXECUTE FUNCTION public.encrypt_sms_data();