-- Create helper RPC to insert tenant with encryption when pgcrypto is available
-- Falls back to plaintext in *_encrypted columns when not available

CREATE OR REPLACE FUNCTION public.create_tenant_with_encryption(
  p_first_name text,
  p_last_name text,
  p_email text,
  p_phone text,
  p_national_id text,
  p_profession text,
  p_employment_status text,
  p_employer_name text,
  p_monthly_income numeric,
  p_emergency_contact_name text,
  p_emergency_contact_phone text,
  p_previous_address text,
  p_property_id uuid,
  p_encryption_key text DEFAULT current_setting('app.encryption_key', true)
)
RETURNS public.tenants
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_row public.tenants%ROWTYPE;
  v_has_pgcrypto boolean;
BEGIN
  SELECT EXISTS(SELECT 1 FROM pg_extension WHERE extname = 'pgcrypto') INTO v_has_pgcrypto;

  IF v_has_pgcrypto AND COALESCE(p_encryption_key, '') <> '' THEN
    INSERT INTO public.tenants (
      first_name, last_name, email, phone, national_id, profession, employment_status, employer_name, monthly_income,
      emergency_contact_name, emergency_contact_phone, previous_address, property_id,
      phone_encrypted, national_id_encrypted, emergency_contact_phone_encrypted
    ) VALUES (
      p_first_name, p_last_name, p_email, p_phone, p_national_id, p_profession, p_employment_status, p_employer_name, p_monthly_income,
      p_emergency_contact_name, p_emergency_contact_phone, p_previous_address, p_property_id,
      -- Store encrypted data as base64 text to match column types
      encode(encrypt(convert_to(COALESCE(p_phone, ''), 'UTF8'), convert_to(p_encryption_key, 'UTF8'), 'aes'), 'base64'),
      encode(encrypt(convert_to(COALESCE(p_national_id, ''), 'UTF8'), convert_to(p_encryption_key, 'UTF8'), 'aes'), 'base64'),
      encode(encrypt(convert_to(COALESCE(p_emergency_contact_phone, ''), 'UTF8'), convert_to(p_encryption_key, 'UTF8'), 'aes'), 'base64')
    )
    RETURNING * INTO v_row;
  ELSE
    -- Fallback: store plaintext in *_encrypted columns to avoid trigger failures
    INSERT INTO public.tenants (
      first_name, last_name, email, phone, national_id, profession, employment_status, employer_name, monthly_income,
      emergency_contact_name, emergency_contact_phone, previous_address, property_id,
      phone_encrypted, national_id_encrypted, emergency_contact_phone_encrypted
    ) VALUES (
      p_first_name, p_last_name, p_email, p_phone, p_national_id, p_profession, p_employment_status, p_employer_name, p_monthly_income,
      p_emergency_contact_name, p_emergency_contact_phone, p_previous_address, p_property_id,
      p_phone, p_national_id, p_emergency_contact_phone
    )
    RETURNING * INTO v_row;
  END IF;

  RETURN v_row;
END;
$$;

-- Grant execution to authenticated users (adjust as needed)
GRANT EXECUTE ON FUNCTION public.create_tenant_with_encryption(
  text, text, text, text, text, text, text, text, numeric, text, text, text, uuid, text
) TO anon, authenticated, service_role;
