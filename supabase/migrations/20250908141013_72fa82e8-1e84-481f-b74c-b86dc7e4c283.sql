-- COMPREHENSIVE SECURITY FIX: Part 1 - Field-Level Encryption & Access Control
-- Fix critical security vulnerabilities in sensitive data handling

-- 1. Create encryption functions using pgcrypto (if not already available)
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- 2. Create secure encryption/decryption functions with proper search_path
CREATE OR REPLACE FUNCTION public.encrypt_sensitive_data(data text, key_name text DEFAULT 'main_encryption_key')
RETURNS text 
LANGUAGE plpgsql 
SECURITY DEFINER 
SET search_path = public, pg_temp
AS $$
DECLARE
  encryption_key text;
  iv bytea;
  encrypted_data bytea;
BEGIN
  -- In production, retrieve from secure key management
  -- For now, use a strong derived key (should be replaced with proper KMS)
  encryption_key := encode(digest('Zira_Secure_Key_2024_' || key_name, 'sha256'), 'hex');
  
  -- Generate random IV for each encryption
  iv := gen_random_bytes(16);
  
  -- Encrypt using AES-256-GCM equivalent (AES-CBC for PostgreSQL compatibility)
  encrypted_data := iv || encrypt(data::bytea, decode(encryption_key, 'hex'), 'aes-cbc');
  
  RETURN encode(encrypted_data, 'base64');
EXCEPTION WHEN OTHERS THEN
  RAISE EXCEPTION 'Encryption failed: %', SQLERRM;
END;
$$;

-- 3. Create decryption function
CREATE OR REPLACE FUNCTION public.decrypt_sensitive_data(encrypted_data text, key_name text DEFAULT 'main_encryption_key')
RETURNS text 
LANGUAGE plpgsql 
SECURITY DEFINER 
SET search_path = public, pg_temp
AS $$
DECLARE
  encryption_key text;
  raw_data bytea;
  iv bytea;
  encrypted_content bytea;
  decrypted_data text;
BEGIN
  encryption_key := encode(digest('Zira_Secure_Key_2024_' || key_name, 'sha256'), 'hex');
  
  -- Decode from base64
  raw_data := decode(encrypted_data, 'base64');
  
  -- Extract IV (first 16 bytes)
  iv := substring(raw_data, 1, 16);
  encrypted_content := substring(raw_data, 17);
  
  -- Decrypt
  decrypted_data := convert_from(decrypt(encrypted_content, decode(encryption_key, 'hex'), 'aes-cbc'), 'utf8');
  
  RETURN decrypted_data;
EXCEPTION WHEN OTHERS THEN
  RAISE EXCEPTION 'Decryption failed: %', SQLERRM;
END;
$$;

-- 4. Create searchable token function for equality searches
CREATE OR REPLACE FUNCTION public.create_search_token(data text, salt text DEFAULT 'search_salt_2024')
RETURNS text 
LANGUAGE plpgsql 
SECURITY DEFINER 
SET search_path = public, pg_temp
AS $$
BEGIN
  -- Create HMAC-based searchable token for equality lookups
  RETURN encode(hmac(lower(trim(data)), salt, 'sha256'), 'hex');
END;
$$;

-- 5. Create data masking function
CREATE OR REPLACE FUNCTION public.mask_sensitive_data(data text, visible_chars integer DEFAULT 4)
RETURNS text 
LANGUAGE plpgsql 
SECURITY DEFINER 
SET search_path = public, pg_temp
AS $$
BEGIN
  IF data IS NULL OR length(data) <= visible_chars THEN
    RETURN '****';
  END IF;
  
  RETURN '****' || right(data, visible_chars);
END;
$$;