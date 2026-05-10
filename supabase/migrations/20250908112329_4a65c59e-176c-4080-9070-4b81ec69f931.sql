-- Phase 1: Database Security Hardening (Fixed)

-- 1. Add encrypted columns for PII data  
ALTER TABLE public.tenants 
ADD COLUMN IF NOT EXISTS phone_encrypted TEXT,
ADD COLUMN IF NOT EXISTS emergency_contact_phone_encrypted TEXT,
ADD COLUMN IF NOT EXISTS national_id_encrypted TEXT;

-- Add encrypted columns to other tables with PII
ALTER TABLE public.mpesa_transactions
ADD COLUMN IF NOT EXISTS phone_number_encrypted TEXT;

-- 2. Standardize and secure function search paths
-- Update existing functions to use secure search paths

-- Fix get_occupancy_report function
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

-- Fix get_maintenance_report function  
CREATE OR REPLACE FUNCTION public.get_maintenance_report(p_start_date date DEFAULT NULL::date, p_end_date date DEFAULT NULL::date)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY INVOKER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_start date := COALESCE(p_start_date, (now() - interval '6 months')::date);
  v_end   date := COALESCE(p_end_date, now()::date);
  v_result jsonb;
BEGIN
  -- Check user permissions first
  IF NOT (
    EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role IN ('Admin', 'Landlord', 'Manager'))
  ) THEN
    RAISE EXCEPTION 'Insufficient privileges';
  END IF;

  WITH relevant AS (
    SELECT 
      mr.*,
      pr.name AS property_name
    FROM public.maintenance_requests mr
    JOIN public.properties pr ON pr.id = mr.property_id
    WHERE (pr.owner_id = auth.uid() OR pr.manager_id = auth.uid())
      AND mr.submitted_date::date >= v_start
      AND mr.submitted_date::date <= v_end
  ),
  kpis AS (
    SELECT
      COUNT(*)::int AS total_requests,
      SUM(CASE WHEN LOWER(status) = 'completed' THEN 1 ELSE 0 END)::int AS completed_requests,
      ROUND(AVG(
        CASE 
          WHEN completed_date IS NOT NULL THEN EXTRACT(EPOCH FROM (completed_date - submitted_date)) / 86400
          ELSE NULL
        END
      )::numeric, 1) AS avg_resolution_days,
      COALESCE(SUM(cost), 0)::numeric AS total_cost
    FROM relevant
  ),
  requests_by_status AS (
    SELECT COALESCE(NULLIF(status,''), 'unknown')::text AS name, COUNT(*)::int AS value
    FROM relevant
    GROUP BY 1
  ),
  monthly_requests AS (
    SELECT 
      to_char(date_trunc('month', d), 'Mon') AS month,
      COALESCE((
        SELECT COUNT(*) FROM relevant r
        WHERE r.submitted_date >= date_trunc('month', d)
          AND r.submitted_date < (date_trunc('month', d) + interval '1 month')
      ), 0)::int AS requests
    FROM generate_series(date_trunc('month', v_start), date_trunc('month', v_end), interval '1 month') d
  ),
  table_rows AS (
    SELECT 
      property_name,
      category,
      status,
      submitted_date::date AS created_date,
      COALESCE(cost, 0)::numeric AS cost
    FROM relevant
    ORDER BY submitted_date DESC
  )
  SELECT jsonb_build_object(
    'kpis', jsonb_build_object(
      'total_requests', (SELECT total_requests FROM kpis),
      'completed_requests', (SELECT completed_requests FROM kpis),
      'avg_resolution_time', (SELECT COALESCE(avg_resolution_days, 0) FROM kpis),
      'total_cost', (SELECT total_cost FROM kpis)
    ),
    'charts', jsonb_build_object(
      'requests_by_status', COALESCE((
        SELECT jsonb_agg(jsonb_build_object('name', name, 'value', value))
        FROM requests_by_status
      ), '[]'::jsonb),
      'monthly_requests', COALESCE((
        SELECT jsonb_agg(jsonb_build_object('month', month, 'requests', requests))
        FROM monthly_requests
      ), '[]'::jsonb)
    ),
    'table', COALESCE((
      SELECT jsonb_agg(jsonb_build_object(
        'property_name', property_name,
        'category', category,
        'status', status,
        'created_date', created_date,
        'cost', cost
      ))
      FROM table_rows
    ), '[]'::jsonb)
  ) INTO v_result;

  RETURN v_result;
END;
$function$;

-- Enable pgcrypto extension if not already enabled
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- 3. Create encryption/decryption functions
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
  -- Generate a random IV for each encryption
  iv := gen_random_bytes(16);
  
  -- Use pgcrypto for AES-256-CBC encryption
  SELECT encode(
    iv || encrypt_iv(
      data::bytea,
      digest(key, 'sha256'),
      iv,
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
  decoded BYTEA;
  iv BYTEA;
  ciphertext BYTEA;
BEGIN
  -- Decode the base64 data
  decoded := decode(encrypted_data, 'base64');
  
  -- Extract IV (first 16 bytes) and ciphertext
  iv := substring(decoded from 1 for 16);
  ciphertext := substring(decoded from 17);
  
  -- Use pgcrypto for AES-256-CBC decryption
  SELECT convert_from(
    decrypt_iv(
      ciphertext,
      digest(key, 'sha256'),
      iv,
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

-- Create indexes for encrypted columns (without CONCURRENTLY in migration)
CREATE INDEX IF NOT EXISTS idx_tenants_phone_encrypted ON public.tenants(phone_encrypted);
CREATE INDEX IF NOT EXISTS idx_mpesa_phone_encrypted ON public.mpesa_transactions(phone_number_encrypted);

-- Create trigger to automatically encrypt PII on insert/update
CREATE OR REPLACE FUNCTION public.encrypt_tenant_pii()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path TO 'public'
AS $$
BEGIN
  -- Only encrypt if we have the encryption key and data is not already encrypted
  IF NEW.phone IS NOT NULL AND NEW.phone_encrypted IS NULL THEN
    NEW.phone_encrypted := public.encrypt_pii(NEW.phone, COALESCE(current_setting('app.encryption_key', true), 'default_key'));
  END IF;
  
  IF NEW.emergency_contact_phone IS NOT NULL AND NEW.emergency_contact_phone_encrypted IS NULL THEN
    NEW.emergency_contact_phone_encrypted := public.encrypt_pii(NEW.emergency_contact_phone, COALESCE(current_setting('app.encryption_key', true), 'default_key'));
  END IF;
  
  IF NEW.national_id IS NOT NULL AND NEW.national_id_encrypted IS NULL THEN
    NEW.national_id_encrypted := public.encrypt_pii(NEW.national_id, COALESCE(current_setting('app.encryption_key', true), 'default_key'));
  END IF;
  
  RETURN NEW;
END;
$$;

-- Drop existing trigger if it exists
DROP TRIGGER IF EXISTS encrypt_tenant_pii_trigger ON public.tenants;

-- Create new trigger
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
BEGIN
  -- Only encrypt if we have the encryption key and data is not already encrypted
  IF NEW.phone_number IS NOT NULL AND NEW.phone_number_encrypted IS NULL THEN
    NEW.phone_number_encrypted := public.encrypt_pii(NEW.phone_number, COALESCE(current_setting('app.encryption_key', true), 'default_key'));
  END IF;
  
  RETURN NEW;
END;
$$;

-- Drop existing trigger if it exists
DROP TRIGGER IF EXISTS encrypt_mpesa_pii_trigger ON public.mpesa_transactions;

-- Create new trigger
CREATE TRIGGER encrypt_mpesa_pii_trigger
  BEFORE INSERT OR UPDATE ON public.mpesa_transactions
  FOR EACH ROW
  EXECUTE FUNCTION public.encrypt_mpesa_pii();