-- Fix the encrypt_pii function to use correct pgcrypto encryption
-- The current function incorrectly uses encrypt_iv which doesn't exist
-- Replace with proper AES encryption using encrypt function

DROP FUNCTION IF EXISTS public.encrypt_pii(text);

CREATE OR REPLACE FUNCTION public.encrypt_pii(data text)
RETURNS bytea AS $$
DECLARE
  encryption_key bytea;
BEGIN
  -- Get encryption key from vault or use a default key
  -- In production, this should use Supabase Vault
  encryption_key := decode(current_setting('app.settings.encryption_key', true), 'hex');
  
  -- If no key is set, use a default (should be configured in production)
  IF encryption_key IS NULL THEN
    encryption_key := digest('default-encryption-key-change-in-production', 'sha256');
  END IF;
  
  -- Use pgcrypto's encrypt function with AES algorithm
  RETURN encrypt(
    data::bytea,
    encryption_key,
    'aes'
  );
EXCEPTION
  WHEN OTHERS THEN
    -- Log error and return NULL to prevent transaction failure
    RAISE WARNING 'Encryption failed: %', SQLERRM;
    RETURN NULL;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;