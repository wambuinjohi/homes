-- Fix encrypt_pii function with proper search_path and fully-qualified calls
DROP FUNCTION IF EXISTS public.encrypt_pii(text, text);
CREATE OR REPLACE FUNCTION public.encrypt_pii(data TEXT, key TEXT)
RETURNS TEXT
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path TO 'public, db_extensions'
AS $$
DECLARE
  encrypted_data TEXT;
BEGIN
  encrypted_data := encode(
    db_extensions.encrypt(
      data::bytea,
      db_extensions.digest(key, 'sha256'),
      'aes-cbc'
    ),
    'base64'
  );
  RETURN encrypted_data;
EXCEPTION WHEN OTHERS THEN
  RAISE EXCEPTION 'Encryption failed: %', SQLERRM;
END;
$$;

-- Fix decrypt_pii function with proper search_path and fully-qualified calls
DROP FUNCTION IF EXISTS public.decrypt_pii(text, text);
CREATE OR REPLACE FUNCTION public.decrypt_pii(encrypted_data TEXT, key TEXT)
RETURNS TEXT
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path TO 'public, db_extensions'
AS $$
DECLARE
  decrypted_text TEXT;
BEGIN
  decrypted_text := convert_from(
    db_extensions.decrypt(
      decode(encrypted_data, 'base64'),
      db_extensions.digest(key, 'sha256'),
      'aes-cbc'
    ),
    'utf8'
  );
  RETURN decrypted_text;
EXCEPTION WHEN OTHERS THEN
  RAISE EXCEPTION 'Decryption failed: %', SQLERRM;
END;
$$;

-- Update encrypt_mpesa_pii trigger to handle missing encryption key gracefully
CREATE OR REPLACE FUNCTION public.encrypt_mpesa_pii()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public, db_extensions'
AS $$
DECLARE
  encryption_key TEXT;
BEGIN
  -- Get encryption key from settings
  encryption_key := COALESCE(current_setting('app.encryption_key', true), '');
  
  -- Skip encryption if no key is configured
  IF encryption_key = '' THEN
    RETURN NEW;
  END IF;

  -- Encrypt phone_number if present and not already encrypted
  IF NEW.phone_number IS NOT NULL AND NEW.phone_number NOT LIKE 'encrypted:%' THEN
    BEGIN
      NEW.phone_number := 'encrypted:' || public.encrypt_pii(NEW.phone_number, encryption_key);
    EXCEPTION WHEN OTHERS THEN
      RAISE WARNING 'Failed to encrypt phone_number: %', SQLERRM;
    END;
  END IF;

  -- Encrypt mpesa_receipt_number if present and not already encrypted
  IF NEW.mpesa_receipt_number IS NOT NULL AND NEW.mpesa_receipt_number NOT LIKE 'encrypted:%' THEN
    BEGIN
      NEW.mpesa_receipt_number := 'encrypted:' || public.encrypt_pii(NEW.mpesa_receipt_number, encryption_key);
    EXCEPTION WHEN OTHERS THEN
      RAISE WARNING 'Failed to encrypt mpesa_receipt_number: %', SQLERRM;
    END;
  END IF;

  RETURN NEW;
END;
$$;

-- Ensure mpesa_transactions is fully wired for realtime updates
ALTER TABLE public.mpesa_transactions REPLICA IDENTITY FULL;

-- Add mpesa_transactions to realtime publication
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables 
    WHERE pubname = 'supabase_realtime' 
    AND tablename = 'mpesa_transactions'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.mpesa_transactions;
  END IF;
END $$;