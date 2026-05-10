-- Phase 3 & 4: Move Extensions + Lock Public Schema + More Function Hardening

-- Phase 3: Move extensions out of public schema
CREATE SCHEMA IF NOT EXISTS db_extensions;

-- Move common extensions if they exist (use DO blocks to avoid errors)
DO $$
BEGIN
  -- Move pgcrypto extension if it exists
  IF EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pgcrypto') THEN
    ALTER EXTENSION pgcrypto SET SCHEMA db_extensions;
  END IF;
  
  -- Move uuid-ossp extension if it exists  
  IF EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'uuid-ossp') THEN
    ALTER EXTENSION "uuid-ossp" SET SCHEMA db_extensions;
  END IF;
  
  -- Move pg_stat_statements extension if it exists
  IF EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_stat_statements') THEN
    ALTER EXTENSION pg_stat_statements SET SCHEMA db_extensions;
  END IF;
  
  -- Move pgjwt extension if it exists
  IF EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pgjwt') THEN
    ALTER EXTENSION pgjwt SET SCHEMA db_extensions;
  END IF;
  
  -- Move http extension if it exists
  IF EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'http') THEN
    ALTER EXTENSION http SET SCHEMA db_extensions;
  END IF;
END $$;

-- Phase 4: Lock down public schema with least privilege
-- Revoke broad create permissions from roles
REVOKE CREATE ON SCHEMA public FROM PUBLIC;
REVOKE CREATE ON SCHEMA public FROM anon;
REVOKE CREATE ON SCHEMA public FROM authenticated;

-- Revoke all permissions from public and anon on public schema
REVOKE ALL ON SCHEMA public FROM PUBLIC;

-- Grant only essential permissions to authenticated users
GRANT USAGE ON SCHEMA public TO anon;
GRANT USAGE ON SCHEMA public TO authenticated;
GRANT USAGE ON SCHEMA public TO service_role;

-- Continue Function Search Path Hardening
-- Fix more functions that likely don't have search_path set

-- More trigger/utility functions  
ALTER FUNCTION public.set_mpesa_landlord_id() SET search_path = public, pg_temp;
ALTER FUNCTION public.set_landlord_id() SET search_path = public, pg_temp;

-- Log/audit functions
ALTER FUNCTION public.log_trial_status_change(uuid, text, text, text, jsonb) SET search_path = public, pg_temp;
ALTER FUNCTION public.log_maintenance_action(uuid, uuid, text, text, text, jsonb) SET search_path = public, pg_temp;
ALTER FUNCTION public.log_system_event(text, text, text, jsonb, uuid) SET search_path = public, pg_temp;
ALTER FUNCTION public.log_role_change() SET search_path = public, pg_temp;

-- Cleanup functions
ALTER FUNCTION public.cleanup_old_security_events() SET search_path = public, pg_temp;

-- Trigger functions for timestamp updates
ALTER FUNCTION public.update_meter_readings_updated_at() SET search_path = public, pg_temp;
ALTER FUNCTION public.update_email_logs_updated_at() SET search_path = public, pg_temp;
ALTER FUNCTION public.update_service_invoice_updated_at() SET search_path = public, pg_temp;

-- Notification/invoice trigger functions
ALTER FUNCTION public.create_invoice_notification() SET search_path = public, pg_temp;

-- Email/profile validation functions
ALTER FUNCTION public.check_email_uniqueness() SET search_path = public, pg_temp;

-- More comprehensive function hardening for remaining functions
-- Payment/invoice functions
ALTER FUNCTION public.reconcile_unallocated_payments_for_tenant(uuid) SET search_path = public, pg_temp;
ALTER FUNCTION public.get_transaction_status(text) SET search_path = public, pg_temp;
ALTER FUNCTION public.create_service_charge_invoice(uuid, date, date, numeric, numeric, numeric) SET search_path = public, pg_temp;
ALTER FUNCTION public.generate_monthly_service_invoices() SET search_path = public, pg_temp;
ALTER FUNCTION public.generate_monthly_invoices_for_landlord(uuid, date, boolean) SET search_path = public, pg_temp;