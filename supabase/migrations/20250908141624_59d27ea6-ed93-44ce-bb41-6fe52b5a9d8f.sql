-- COMPREHENSIVE SECURITY FIX: Part 7 - Final Encryption & Access Control Implementation
-- Complete the security hardening with encryption triggers and final access restrictions

-- 1. Create encryption triggers for automatic data protection
CREATE OR REPLACE FUNCTION public.encrypt_tenant_sensitive_data()
RETURNS trigger 
LANGUAGE plpgsql 
SECURITY DEFINER 
SET search_path = public, pg_temp
AS $$
BEGIN
  -- Encrypt sensitive fields on insert/update
  IF TG_OP = 'INSERT' OR (TG_OP = 'UPDATE' AND (
    OLD.phone IS DISTINCT FROM NEW.phone OR
    OLD.email IS DISTINCT FROM NEW.email OR
    OLD.national_id IS DISTINCT FROM NEW.national_id OR
    OLD.emergency_contact_phone IS DISTINCT FROM NEW.emergency_contact_phone
  )) THEN
    
    -- Encrypt phone if provided
    IF NEW.phone IS NOT NULL THEN
      NEW.phone_encrypted := public.encrypt_sensitive_data(NEW.phone);
      NEW.phone_token := public.create_search_token(NEW.phone);
    END IF;
    
    -- Encrypt email if provided
    IF NEW.email IS NOT NULL THEN
      NEW.email_encrypted := public.encrypt_sensitive_data(NEW.email);
      NEW.email_token := public.create_search_token(NEW.email);
    END IF;
    
    -- Encrypt national ID if provided
    IF NEW.national_id IS NOT NULL THEN
      NEW.national_id_encrypted := public.encrypt_sensitive_data(NEW.national_id);
    END IF;
    
    -- Encrypt emergency contact phone if provided
    IF NEW.emergency_contact_phone IS NOT NULL THEN
      NEW.emergency_contact_phone_encrypted := public.encrypt_sensitive_data(NEW.emergency_contact_phone);
    END IF;
    
  END IF;
  
  RETURN NEW;
END;
$$;

-- Create trigger for tenant encryption
DROP TRIGGER IF EXISTS encrypt_tenant_data_trigger ON public.tenants;
CREATE TRIGGER encrypt_tenant_data_trigger
  BEFORE INSERT OR UPDATE ON public.tenants
  FOR EACH ROW
  EXECUTE FUNCTION public.encrypt_tenant_sensitive_data();

-- 2. Create encryption trigger for SMS data
CREATE OR REPLACE FUNCTION public.encrypt_sms_sensitive_data()
RETURNS trigger 
LANGUAGE plpgsql 
SECURITY DEFINER 
SET search_path = public, pg_temp
AS $$
BEGIN
  -- Encrypt sensitive SMS fields on insert/update
  IF TG_OP = 'INSERT' OR (TG_OP = 'UPDATE' AND (
    OLD.recipient_phone IS DISTINCT FROM NEW.recipient_phone OR
    OLD.message_content IS DISTINCT FROM NEW.message_content
  )) THEN
    
    -- Encrypt recipient phone
    IF NEW.recipient_phone IS NOT NULL THEN
      NEW.recipient_phone_encrypted := public.encrypt_sensitive_data(NEW.recipient_phone);
      NEW.recipient_phone_token := public.create_search_token(NEW.recipient_phone);
    END IF;
    
    -- Encrypt message content
    IF NEW.message_content IS NOT NULL THEN
      NEW.message_content_encrypted := public.encrypt_sensitive_data(NEW.message_content);
    END IF;
    
  END IF;
  
  RETURN NEW;
END;
$$;

-- Create trigger for SMS encryption
DROP TRIGGER IF EXISTS encrypt_sms_data_trigger ON public.sms_usage;
CREATE TRIGGER encrypt_sms_data_trigger
  BEFORE INSERT OR UPDATE ON public.sms_usage
  FOR EACH ROW
  EXECUTE FUNCTION public.encrypt_sms_sensitive_data();

-- 3. Create encryption trigger for M-Pesa credentials
CREATE OR REPLACE FUNCTION public.encrypt_mpesa_credentials()
RETURNS trigger 
LANGUAGE plpgsql 
SECURITY DEFINER 
SET search_path = public, pg_temp
AS $$
BEGIN
  -- Encrypt M-Pesa credentials on insert/update
  IF TG_OP = 'INSERT' OR (TG_OP = 'UPDATE' AND (
    OLD.consumer_key IS DISTINCT FROM NEW.consumer_key OR
    OLD.consumer_secret IS DISTINCT FROM NEW.consumer_secret OR
    OLD.passkey IS DISTINCT FROM NEW.passkey
  )) THEN
    
    -- Encrypt consumer key
    IF NEW.consumer_key IS NOT NULL THEN
      NEW.consumer_key_encrypted := public.encrypt_sensitive_data(NEW.consumer_key, 'mpesa_key');
    END IF;
    
    -- Encrypt consumer secret
    IF NEW.consumer_secret IS NOT NULL THEN
      NEW.consumer_secret_encrypted := public.encrypt_sensitive_data(NEW.consumer_secret, 'mpesa_key');
    END IF;
    
    -- Encrypt passkey
    IF NEW.passkey IS NOT NULL THEN
      NEW.passkey_encrypted := public.encrypt_sensitive_data(NEW.passkey, 'mpesa_key');
    END IF;
    
  END IF;
  
  RETURN NEW;
END;
$$;

-- Create trigger for M-Pesa credentials encryption
DROP TRIGGER IF EXISTS encrypt_mpesa_credentials_trigger ON public.mpesa_credentials;
CREATE TRIGGER encrypt_mpesa_credentials_trigger
  BEFORE INSERT OR UPDATE ON public.mpesa_credentials
  FOR EACH ROW
  EXECUTE FUNCTION public.encrypt_mpesa_credentials();

-- 4. Final access restrictions - revoke any remaining overly broad permissions
REVOKE ALL ON ALL TABLES IN SCHEMA public FROM PUBLIC;
REVOKE ALL ON ALL FUNCTIONS IN SCHEMA public FROM PUBLIC;
REVOKE ALL ON ALL SEQUENCES IN SCHEMA public FROM PUBLIC;

-- Grant only necessary permissions to authenticated users
GRANT USAGE ON SCHEMA public TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO authenticated;
GRANT USAGE ON ALL SEQUENCES IN SCHEMA public TO authenticated;
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA public TO authenticated;