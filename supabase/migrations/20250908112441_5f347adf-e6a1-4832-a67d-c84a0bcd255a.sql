-- Phase 1: Database Security Hardening (Update existing and add missing)

-- Check and add missing encrypted columns
DO $$
BEGIN
    -- Add columns only if they don't exist
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name='tenants' AND column_name='emergency_contact_phone_encrypted') THEN
        ALTER TABLE public.tenants ADD COLUMN emergency_contact_phone_encrypted TEXT;
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name='tenants' AND column_name='national_id_encrypted') THEN
        ALTER TABLE public.tenants ADD COLUMN national_id_encrypted TEXT;
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name='mpesa_transactions' AND column_name='phone_number_encrypted') THEN
        ALTER TABLE public.mpesa_transactions ADD COLUMN phone_number_encrypted TEXT;
    END IF;
END
$$;

-- Enable pgcrypto extension if not already enabled
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- Drop existing insecure functions and recreate with SECURITY INVOKER
DROP FUNCTION IF EXISTS public.get_occupancy_report(date, date);
DROP FUNCTION IF EXISTS public.get_maintenance_report(date, date);
DROP FUNCTION IF EXISTS public.get_financial_summary_report(date, date, uuid);
DROP FUNCTION IF EXISTS public.get_lease_expiry_report(date, date);
DROP FUNCTION IF EXISTS public.get_tenant_turnover_report(date, date);
DROP FUNCTION IF EXISTS public.get_outstanding_balances_report(date, date);

-- Create secure encryption/decryption functions
CREATE OR REPLACE FUNCTION public.encrypt_pii(data TEXT, key TEXT)
RETURNS TEXT
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path TO 'public'
AS $$
DECLARE
  encrypted_data TEXT;
  iv BYTEA;
BEGIN
  -- Generate random IV for each encryption
  iv := gen_random_bytes(16);
  
  -- Use pgcrypto for AES-256-CBC encryption with random IV
  SELECT encode(
    iv || encrypt(
      data::bytea,
      digest(key, 'sha256'),
      'aes-cbc'
    ),
    'base64'
  ) INTO encrypted_data;
  
  RETURN encrypted_data;
EXCEPTION WHEN OTHERS THEN
  -- Log error but don't expose sensitive details
  RAISE EXCEPTION 'Encryption failed';
END;
$$;

CREATE OR REPLACE FUNCTION public.decrypt_pii(encrypted_data TEXT, key TEXT)
RETURNS TEXT
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path TO 'public'
AS $$
DECLARE
  decrypted_data TEXT;
  raw_data BYTEA;
  iv BYTEA;
  encrypted_content BYTEA;
BEGIN
  -- Decode from base64
  raw_data := decode(encrypted_data, 'base64');
  
  -- Extract IV (first 16 bytes) and encrypted content
  iv := substring(raw_data, 1, 16);
  encrypted_content := substring(raw_data, 17);
  
  -- Decrypt using extracted IV
  SELECT convert_from(
    decrypt(
      encrypted_content,
      digest(key, 'sha256'),
      'aes-cbc'
    ),
    'utf8'
  ) INTO decrypted_data;
  
  RETURN decrypted_data;
EXCEPTION WHEN OTHERS THEN
  -- Log error but don't expose sensitive details
  RAISE EXCEPTION 'Decryption failed';
END;
$$;

-- Recreate report functions with SECURITY INVOKER and proper access controls
CREATE OR REPLACE FUNCTION public.get_occupancy_report(p_start_date date DEFAULT NULL::date, p_end_date date DEFAULT NULL::date)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY INVOKER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_start date := COALESCE(p_start_date, date_trunc('month', now())::date);
  v_end   date := COALESCE(p_end_date, now()::date);
  v_total_units integer := 0;
  v_result jsonb;
BEGIN
  -- Check user permissions first
  IF NOT (
    EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role IN ('Admin', 'Landlord', 'Manager'))
  ) THEN
    RAISE EXCEPTION 'Insufficient privileges';
  END IF;

  -- Total units in portfolio
  SELECT COALESCE(COUNT(u.id), 0)
  INTO v_total_units
  FROM public.units u
  JOIN public.properties p ON p.id = u.property_id
  WHERE (p.owner_id = auth.uid() OR p.manager_id = auth.uid());

  WITH occupied_units AS (
    SELECT DISTINCT u.id, u.property_id
    FROM public.units u
    JOIN public.properties p ON p.id = u.property_id
    JOIN public.leases l ON l.unit_id = u.id
    WHERE (p.owner_id = auth.uid() OR p.manager_id = auth.uid())
      AND l.lease_start_date <= v_end
      AND l.lease_end_date >= v_start
      AND COALESCE(l.status, 'active') <> 'terminated'
  ),
  occupied_count AS (
    SELECT COUNT(*)::int AS occupied_units
    FROM occupied_units
  ),
  property_stats AS (
    SELECT 
      pr.id AS property_id,
      pr.name AS property_name,
      COUNT(u.id)::int AS total_units,
      COALESCE(SUM(CASE WHEN ou.id IS NOT NULL THEN 1 ELSE 0 END), 0)::int AS occupied_units
    FROM public.properties pr
    JOIN public.units u ON u.property_id = pr.id
    LEFT JOIN occupied_units ou ON ou.id = u.id
    WHERE (pr.owner_id = auth.uid() OR pr.manager_id = auth.uid())
    GROUP BY pr.id, pr.name
  ),
  occupancy_trend AS (
    SELECT 
      to_char(date_trunc('month', d), 'Mon') AS month,
      CASE 
        WHEN v_total_units > 0 THEN
          ROUND(
            (
              SELECT COUNT(DISTINCT u2.id)::numeric
              FROM public.units u2
              JOIN public.properties p2 ON p2.id = u2.property_id
              JOIN public.leases l2 ON l2.unit_id = u2.id
              WHERE (p2.owner_id = auth.uid() OR p2.manager_id = auth.uid())
                AND l2.lease_start_date <= (date_trunc('month', d) + interval '1 month' - interval '1 day')
                AND l2.lease_end_date >= date_trunc('month', d)
                AND COALESCE(l2.status, 'active') <> 'terminated'
            ) / v_total_units::numeric * 100, 1
          )
        ELSE 0
      END AS occupancy_rate
    FROM generate_series(date_trunc('month', v_start), date_trunc('month', v_end), interval '1 month') d
  ),
  per_property AS (
    SELECT
      property_name AS property,
      occupied_units AS occupied,
      (total_units - occupied_units) AS vacant
    FROM property_stats
  ),
  table_rows AS (
    SELECT 
      property_name,
      total_units,
      occupied_units,
      CASE WHEN total_units > 0 THEN ROUND((occupied_units::numeric / total_units::numeric) * 100, 1) ELSE 0 END AS occupancy_rate
    FROM property_stats
  )
  SELECT jsonb_build_object(
    'kpis', jsonb_build_object(
      'occupancy_rate', CASE WHEN v_total_units > 0 THEN ROUND(((SELECT occupied_units FROM occupied_count)::numeric / v_total_units::numeric) * 100, 1) ELSE 0 END,
      'total_units', v_total_units,
      'occupied_units', COALESCE((SELECT occupied_units FROM occupied_count), 0),
      'vacant_units', GREATEST(v_total_units - COALESCE((SELECT occupied_units FROM occupied_count), 0), 0)
    ),
    'charts', jsonb_build_object(
      'occupancy_trend', COALESCE((
        SELECT jsonb_agg(jsonb_build_object(
          'month', month,
          'occupancy_rate', occupancy_rate
        ))
        FROM occupancy_trend
      ), '[]'::jsonb),
      'property_occupancy', COALESCE((
        SELECT jsonb_agg(jsonb_build_object(
          'property', property,
          'occupied', occupied,
          'vacant', vacant
        ))
        FROM per_property
      ), '[]'::jsonb)
    ),
    'table', COALESCE((
      SELECT jsonb_agg(jsonb_build_object(
        'property_name', property_name,
        'total_units', total_units,
        'occupied_units', occupied_units,
        'occupancy_rate', occupancy_rate
      ) ORDER BY property_name)
      FROM table_rows
    ), '[]'::jsonb)
  ) INTO v_result;

  RETURN v_result;
END;
$function$;

-- Create triggers for automatic PII encryption
CREATE OR REPLACE FUNCTION public.encrypt_tenant_pii()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path TO 'public'
AS $$
DECLARE
  encryption_key TEXT;
BEGIN
  -- Get encryption key from environment
  encryption_key := current_setting('app.data_encryption_key', true);
  IF encryption_key IS NULL OR encryption_key = '' THEN
    encryption_key := 'fallback_key_change_in_production';
  END IF;
  
  -- Encrypt phone number if provided and not already encrypted
  IF NEW.phone IS NOT NULL AND (NEW.phone_encrypted IS NULL OR NEW.phone_encrypted = '') THEN
    NEW.phone_encrypted := public.encrypt_pii(NEW.phone, encryption_key);
  END IF;
  
  -- Encrypt emergency contact phone if provided and not already encrypted
  IF NEW.emergency_contact_phone IS NOT NULL AND (NEW.emergency_contact_phone_encrypted IS NULL OR NEW.emergency_contact_phone_encrypted = '') THEN
    NEW.emergency_contact_phone_encrypted := public.encrypt_pii(NEW.emergency_contact_phone, encryption_key);
  END IF;
  
  -- Encrypt national ID if provided and not already encrypted
  IF NEW.national_id IS NOT NULL AND (NEW.national_id_encrypted IS NULL OR NEW.national_id_encrypted = '') THEN
    NEW.national_id_encrypted := public.encrypt_pii(NEW.national_id, encryption_key);
  END IF;
  
  RETURN NEW;
END;
$$;

-- Drop existing trigger if exists and recreate
DROP TRIGGER IF EXISTS encrypt_tenant_pii_trigger ON public.tenants;
CREATE TRIGGER encrypt_tenant_pii_trigger
  BEFORE INSERT OR UPDATE ON public.tenants
  FOR EACH ROW
  EXECUTE FUNCTION public.encrypt_tenant_pii();

-- Create trigger for mpesa transactions
CREATE OR REPLACE FUNCTION public.encrypt_mpesa_pii()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path TO 'public'
AS $$
DECLARE
  encryption_key TEXT;
BEGIN
  -- Get encryption key from environment
  encryption_key := current_setting('app.data_encryption_key', true);
  IF encryption_key IS NULL OR encryption_key = '' THEN
    encryption_key := 'fallback_key_change_in_production';
  END IF;
  
  -- Encrypt phone number if provided and not already encrypted
  IF NEW.phone_number IS NOT NULL AND (NEW.phone_number_encrypted IS NULL OR NEW.phone_number_encrypted = '') THEN
    NEW.phone_number_encrypted := public.encrypt_pii(NEW.phone_number, encryption_key);
  END IF;
  
  RETURN NEW;
END;
$$;

-- Drop existing trigger if exists and recreate
DROP TRIGGER IF EXISTS encrypt_mpesa_pii_trigger ON public.mpesa_transactions;
CREATE TRIGGER encrypt_mpesa_pii_trigger
  BEFORE INSERT OR UPDATE ON public.mpesa_transactions
  FOR EACH ROW
  EXECUTE FUNCTION public.encrypt_mpesa_pii();

-- Create indexes for encrypted columns (only if they don't exist)
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'idx_tenants_phone_encrypted') THEN
        CREATE INDEX idx_tenants_phone_encrypted ON public.tenants(phone_encrypted);
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'idx_mpesa_phone_encrypted') THEN
        CREATE INDEX idx_mpesa_phone_encrypted ON public.mpesa_transactions(phone_number_encrypted);
    END IF;
END
$$;