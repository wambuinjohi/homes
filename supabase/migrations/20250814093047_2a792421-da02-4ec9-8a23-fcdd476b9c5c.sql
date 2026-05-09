-- Fix database function security issues by adding proper search_path settings
-- This prevents SQL injection through search path manipulation

-- Update all existing functions to include SECURITY DEFINER SET search_path = ''
-- Functions with security implications

ALTER FUNCTION public.set_property_owner() SECURITY DEFINER SET search_path = '';
ALTER FUNCTION public.get_transaction_status(text) SECURITY DEFINER SET search_path = '';
ALTER FUNCTION public.has_permission(uuid, text) SECURITY DEFINER SET search_path = '';
ALTER FUNCTION public.set_expense_creator() SECURITY DEFINER SET search_path = '';
ALTER FUNCTION public.update_meter_readings_updated_at() SECURITY DEFINER SET search_path = '';
ALTER FUNCTION public.update_email_logs_updated_at() SECURITY DEFINER SET search_path = '';
ALTER FUNCTION public.set_announcement_creator() SECURITY DEFINER SET search_path = '';
ALTER FUNCTION public.is_user_tenant(uuid) SECURITY DEFINER SET search_path = '';
ALTER FUNCTION public.get_user_tenant_ids(uuid) SECURITY DEFINER SET search_path = '';
ALTER FUNCTION public.get_user_permissions(uuid) SECURITY DEFINER SET search_path = '';
ALTER FUNCTION public.can_user_manage_tenant(uuid, uuid) SECURITY DEFINER SET search_path = '';
ALTER FUNCTION public.update_updated_at_column() SECURITY DEFINER SET search_path = '';
ALTER FUNCTION public.log_user_activity(uuid, text, text, uuid, jsonb, inet, text) SECURITY DEFINER SET search_path = '';
ALTER FUNCTION public.create_service_charge_invoice(uuid, date, date, numeric, numeric, numeric) SECURITY DEFINER SET search_path = '';
ALTER FUNCTION public.check_trial_limitation(uuid, text, integer) SECURITY DEFINER SET search_path = '';
ALTER FUNCTION public.log_trial_status_change(uuid, text, text, text, jsonb) SECURITY DEFINER SET search_path = '';
ALTER FUNCTION public.get_trial_status(uuid) SECURITY DEFINER SET search_path = '';
ALTER FUNCTION public.create_default_landlord_subscription() SECURITY DEFINER SET search_path = 'public';
ALTER FUNCTION public.calculate_property_total_units() SECURITY DEFINER SET search_path = '';
ALTER FUNCTION public.backfill_trial_periods(timestamp with time zone, integer, integer, boolean, boolean) SECURITY DEFINER SET search_path = '';
ALTER FUNCTION public.create_user_with_role(text, text, text, text, app_role) SECURITY DEFINER SET search_path = '';
ALTER FUNCTION public.get_tenant_unit_ids(uuid) SECURITY DEFINER SET search_path = '';
ALTER FUNCTION public.get_tenant_property_ids(uuid) SECURITY DEFINER SET search_path = '';
ALTER FUNCTION public.generate_monthly_service_invoices() SECURITY DEFINER SET search_path = '';
ALTER FUNCTION public.log_maintenance_action(uuid, uuid, text, text, text, jsonb) SECURITY DEFINER SET search_path = '';
ALTER FUNCTION public.log_system_event(text, text, text, jsonb, uuid) SECURITY DEFINER SET search_path = '';
ALTER FUNCTION public.create_user_safe(text, text, text, text, app_role) SECURITY DEFINER SET search_path = '';
ALTER FUNCTION public.get_data_integrity_report() SECURITY DEFINER SET search_path = '';
ALTER FUNCTION public.log_user_audit(uuid, text, text, uuid, jsonb, uuid, inet, text) SECURITY DEFINER SET search_path = '';
ALTER FUNCTION public.get_user_audit_history(uuid, integer, integer) SECURITY DEFINER SET search_path = '';
ALTER FUNCTION public.suspend_user(uuid, text, uuid) SECURITY DEFINER SET search_path = '';
ALTER FUNCTION public.activate_user(uuid, uuid) SECURITY DEFINER SET search_path = '';
ALTER FUNCTION public.soft_delete_user(uuid, text, uuid) SECURITY DEFINER SET search_path = '';
ALTER FUNCTION public.has_role(uuid, app_role) SECURITY DEFINER SET search_path = '';
ALTER FUNCTION public.handle_new_user() SECURITY DEFINER SET search_path = '';

-- Move extensions from public schema to dedicated schema
-- Create extensions schema
CREATE SCHEMA IF NOT EXISTS extensions;

-- Note: Extension movement would require careful coordination with Supabase team
-- This is typically handled at the platform level for hosted databases

-- Create table for tracking system health and performance
CREATE TABLE IF NOT EXISTS public.system_health_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  service TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('healthy', 'degraded', 'down')),
  response_time_ms INTEGER,
  error_count INTEGER DEFAULT 0,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Enable RLS on system health logs
ALTER TABLE public.system_health_logs ENABLE ROW LEVEL SECURITY;

-- Create policy for system health logs (Admin only)
CREATE POLICY "Only admins can access system health logs" ON public.system_health_logs
FOR ALL USING (
  EXISTS (
    SELECT 1 FROM public.user_roles 
    WHERE user_id = auth.uid() AND role = 'Admin'
  )
);

-- Create function to log system health
CREATE OR REPLACE FUNCTION public.log_system_health(
  _service text,
  _status text,
  _response_time_ms integer DEFAULT NULL,
  _error_count integer DEFAULT 0,
  _metadata jsonb DEFAULT '{}'
)
RETURNS void
LANGUAGE sql
SECURITY DEFINER
SET search_path = ''
AS $$
  INSERT INTO public.system_health_logs (
    service, status, response_time_ms, error_count, metadata
  ) VALUES (
    _service, _status, _response_time_ms, _error_count, _metadata
  );
$$;