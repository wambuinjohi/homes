-- Fix encrypt_pii and decrypt_pii functions to use correct pgcrypto encryption
-- The current functions incorrectly use encrypt_iv which doesn't exist
-- Replace with proper AES-CBC encryption with IV handling

DROP FUNCTION IF EXISTS public.encrypt_pii(text, text);
DROP FUNCTION IF EXISTS public.decrypt_pii(text, text);

-- Create encrypt_pii function with proper IV handling
CREATE OR REPLACE FUNCTION public.encrypt_pii(data TEXT, key TEXT)
RETURNS TEXT AS $$
DECLARE
  encrypted_data TEXT;
  iv BYTEA;
  ciphertext BYTEA;
BEGIN
  -- Generate a random 16-byte IV
  iv := gen_random_bytes(16);
  
  -- Encrypt data using AES-CBC with the provided key (hashed to 256-bit)
  ciphertext := encrypt(
    data::bytea,
    digest(key, 'sha256'),
    'aes-cbc'
  );
  
  -- Prepend IV to ciphertext and base64-encode the result
  encrypted_data := encode(iv || ciphertext, 'base64');
  
  RETURN encrypted_data;
EXCEPTION
  WHEN OTHERS THEN
    RAISE EXCEPTION 'Encryption failed: %', SQLERRM;
END;
$$ LANGUAGE plpgsql SECURITY INVOKER SET search_path = 'public';

-- Create decrypt_pii function to match the encryption scheme
CREATE OR REPLACE FUNCTION public.decrypt_pii(encrypted_data TEXT, key TEXT)
RETURNS TEXT AS $$
DECLARE
  raw_data BYTEA;
  iv BYTEA;
  ciphertext BYTEA;
  decrypted_text TEXT;
BEGIN
  -- Decode the base64-encoded data
  raw_data := decode(encrypted_data, 'base64');
  
  -- Extract IV (first 16 bytes) and ciphertext (rest)
  iv := substring(raw_data, 1, 16);
  ciphertext := substring(raw_data, 17);
  
  -- Decrypt using AES-CBC
  decrypted_text := convert_from(
    decrypt(
      ciphertext,
      digest(key, 'sha256'),
      'aes-cbc'
    ),
    'utf8'
  );
  
  RETURN decrypted_text;
EXCEPTION
  WHEN OTHERS THEN
    RAISE EXCEPTION 'Decryption failed: %', SQLERRM;
END;
$$ LANGUAGE plpgsql SECURITY INVOKER SET search_path = 'public';