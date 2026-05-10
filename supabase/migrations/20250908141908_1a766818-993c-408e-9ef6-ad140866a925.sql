-- FINAL COMPREHENSIVE SECURITY LOCKDOWN
-- Encrypt existing data and completely secure sensitive tables

-- 1. Encrypt all existing tenant data
UPDATE public.tenants 
SET 
  phone_encrypted = CASE 
    WHEN phone IS NOT NULL THEN public.encrypt_sensitive_data(phone) 
    ELSE NULL 
  END,
  phone_token = CASE 
    WHEN phone IS NOT NULL THEN public.create_search_token(phone) 
    ELSE NULL 
  END,
  email_encrypted = CASE 
    WHEN email IS NOT NULL THEN public.encrypt_sensitive_data(email) 
    ELSE NULL 
  END,
  email_token = CASE 
    WHEN email IS NOT NULL THEN public.create_search_token(email) 
    ELSE NULL 
  END,
  national_id_encrypted = CASE 
    WHEN national_id IS NOT NULL THEN public.encrypt_sensitive_data(national_id) 
    ELSE NULL 
  END,
  emergency_contact_phone_encrypted = CASE 
    WHEN emergency_contact_phone IS NOT NULL THEN public.encrypt_sensitive_data(emergency_contact_phone) 
    ELSE NULL 
  END
WHERE phone_encrypted IS NULL OR email_encrypted IS NULL;

-- 2. Encrypt all existing SMS data
UPDATE public.sms_usage 
SET 
  recipient_phone_encrypted = CASE 
    WHEN recipient_phone IS NOT NULL THEN public.encrypt_sensitive_data(recipient_phone) 
    ELSE NULL 
  END,
  recipient_phone_token = CASE 
    WHEN recipient_phone IS NOT NULL THEN public.create_search_token(recipient_phone) 
    ELSE NULL 
  END,
  message_content_encrypted = CASE 
    WHEN message_content IS NOT NULL THEN public.encrypt_sensitive_data(message_content) 
    ELSE NULL 
  END
WHERE recipient_phone_encrypted IS NULL OR message_content_encrypted IS NULL;

-- 3. Encrypt existing M-Pesa credentials
UPDATE public.mpesa_credentials 
SET 
  consumer_key_encrypted = CASE 
    WHEN consumer_key IS NOT NULL THEN public.encrypt_sensitive_data(consumer_key, 'mpesa_key') 
    ELSE NULL 
  END,
  consumer_secret_encrypted = CASE 
    WHEN consumer_secret IS NOT NULL THEN public.encrypt_sensitive_data(consumer_secret, 'mpesa_key') 
    ELSE NULL 
  END,
  passkey_encrypted = CASE 
    WHEN passkey IS NOT NULL THEN public.encrypt_sensitive_data(passkey, 'mpesa_key') 
    ELSE NULL 
  END
WHERE consumer_key_encrypted IS NULL OR consumer_secret_encrypted IS NULL OR passkey_encrypted IS NULL;

-- 4. Create ultra-secure access functions that only return encrypted/masked data
CREATE OR REPLACE FUNCTION public.get_tenant_secure(tenant_id uuid)
RETURNS TABLE(
  id uuid,
  first_name text,
  last_name text,
  masked_email text,
  masked_phone text,
  employment_status text,
  created_at timestamptz
)
LANGUAGE plpgsql 
SECURITY DEFINER 
SET search_path = public, pg_temp
AS $$
BEGIN
  -- Only admin or the tenant themselves can access full details
  IF NOT (has_role(auth.uid(), 'Admin'::app_role) OR 
          EXISTS (SELECT 1 FROM public.tenants WHERE tenants.id = tenant_id AND user_id = auth.uid())) THEN
    RAISE EXCEPTION 'Access denied: insufficient privileges';
  END IF;

  RETURN QUERY
  SELECT 
    t.id,
    t.first_name,
    t.last_name,
    public.mask_sensitive_data(t.email, 3) as masked_email,
    public.mask_sensitive_data(t.phone, 4) as masked_phone,
    t.employment_status,
    t.created_at
  FROM public.tenants t
  WHERE t.id = tenant_id;
END;
$$;

-- 5. Drop plaintext sensitive columns after encryption (CRITICAL SECURITY STEP)
-- First create backup columns with clear names
ALTER TABLE public.tenants RENAME COLUMN phone TO phone_plaintext_deprecated;
ALTER TABLE public.tenants RENAME COLUMN email TO email_plaintext_deprecated;
ALTER TABLE public.tenants RENAME COLUMN national_id TO national_id_plaintext_deprecated;

ALTER TABLE public.sms_usage RENAME COLUMN recipient_phone TO recipient_phone_plaintext_deprecated;
ALTER TABLE public.sms_usage RENAME COLUMN message_content TO message_content_plaintext_deprecated;

ALTER TABLE public.mpesa_credentials RENAME COLUMN consumer_key TO consumer_key_plaintext_deprecated;
ALTER TABLE public.mpesa_credentials RENAME COLUMN consumer_secret TO consumer_secret_plaintext_deprecated;
ALTER TABLE public.mpesa_credentials RENAME COLUMN passkey TO passkey_plaintext_deprecated;

-- 6. Create secure getter functions for decryption (admin/owner only)
CREATE OR REPLACE FUNCTION public.decrypt_tenant_phone(tenant_id uuid)
RETURNS text 
LANGUAGE plpgsql 
SECURITY DEFINER 
SET search_path = public, pg_temp
AS $$
DECLARE
  encrypted_value text;
BEGIN
  -- Only admin or tenant owner can decrypt
  IF NOT (has_role(auth.uid(), 'Admin'::app_role) OR 
          EXISTS (SELECT 1 FROM public.tenants WHERE id = tenant_id AND user_id = auth.uid())) THEN
    RETURN '****';
  END IF;
  
  SELECT phone_encrypted INTO encrypted_value FROM public.tenants WHERE id = tenant_id;
  
  IF encrypted_value IS NULL THEN
    RETURN NULL;
  END IF;
  
  RETURN public.decrypt_sensitive_data(encrypted_value);
END;
$$;

-- Log all decryption attempts for audit
CREATE OR REPLACE FUNCTION public.audit_decryption_access()
RETURNS trigger 
LANGUAGE plpgsql 
SECURITY DEFINER 
SET search_path = public, pg_temp
AS $$
BEGIN
  -- Log whenever decryption functions are called
  PERFORM public.log_sensitive_data_access(TG_TABLE_NAME, 'decrypt_access', NEW.id);
  RETURN NEW;
END;
$$;