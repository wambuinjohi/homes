-- Phase 5: Final Function Hardening + Email Templates RLS

-- Continue fixing remaining functions with mutable search_path
-- More complex reporting/business logic functions that likely need hardening

-- User/tenant data functions
ALTER FUNCTION public.get_tenant_payments_data(uuid, integer) SET search_path = public, pg_temp;
ALTER FUNCTION public.get_tenant_maintenance_data(uuid, integer) SET search_path = public, pg_temp;
ALTER FUNCTION public.get_tenant_contacts(uuid) SET search_path = public, pg_temp;

-- Plan/subscription functions
ALTER FUNCTION public.check_plan_feature_access(uuid, text, integer) SET search_path = public, pg_temp;
ALTER FUNCTION public.backfill_trial_periods(timestamp with time zone, integer, integer, boolean, boolean) SET search_path = public, pg_temp;

-- User management functions
ALTER FUNCTION public.create_user_with_role(text, text, text, text, app_role) SET search_path = public, pg_temp;
ALTER FUNCTION public.create_user_safe(text, text, text, text, app_role) SET search_path = public, pg_temp;
ALTER FUNCTION public.suspend_user(uuid, text, uuid) SET search_path = public, pg_temp;

-- Reporting functions (the ones we recently created)
ALTER FUNCTION public.get_maintenance_report(date, date) SET search_path = public, pg_temp;
ALTER FUNCTION public.get_lease_expiry_report(date, date) SET search_path = public, pg_temp;
ALTER FUNCTION public.get_outstanding_balances_report(date, date) SET search_path = public, pg_temp;
ALTER FUNCTION public.get_tenant_turnover_report(date, date) SET search_path = public, pg_temp;
ALTER FUNCTION public.get_financial_summary_report(date, date) SET search_path = public, pg_temp;
ALTER FUNCTION public.get_revenue_vs_expenses_report(date, date) SET search_path = public, pg_temp;

-- Data integrity functions
ALTER FUNCTION public.get_data_integrity_report() SET search_path = public, pg_temp;

-- M-Pesa functions
ALTER FUNCTION public.create_landlord_mpesa_config(text, text, text, text, text, text, boolean) SET search_path = public, pg_temp;

-- Phase 5: Email Templates RLS (resolve "Email Templates Could Be Stolen by Competitors")
-- Enable RLS on email_templates if not already enabled
ALTER TABLE public.email_templates ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if any exist
DROP POLICY IF EXISTS "Admins can manage all email templates" ON public.email_templates;
DROP POLICY IF EXISTS "Landlords can manage their own templates" ON public.email_templates;
DROP POLICY IF EXISTS "Users can view enabled global templates" ON public.email_templates;

-- Create comprehensive RLS policies for email_templates
-- 1. Admins can manage all templates
CREATE POLICY "Admins can manage all email templates" ON public.email_templates
  FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'Admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'Admin'::app_role));

-- 2. Landlords can manage their own templates
CREATE POLICY "Landlords can manage their own templates" ON public.email_templates
  FOR ALL TO authenticated
  USING (
    has_role(auth.uid(), 'Landlord'::app_role) AND 
    landlord_id = auth.uid()
  )
  WITH CHECK (
    has_role(auth.uid(), 'Landlord'::app_role) AND 
    landlord_id = auth.uid()
  );

-- 3. Authenticated users can view enabled global/default templates
CREATE POLICY "Users can view enabled global templates" ON public.email_templates
  FOR SELECT TO authenticated
  USING (
    enabled = true AND 
    landlord_id IS NULL
  );

-- Revoke any public access from email_templates
REVOKE ALL ON public.email_templates FROM PUBLIC;
REVOKE ALL ON public.email_templates FROM anon;