-- Phase 2: Function Search Path Hardening + Final invoice_overview security

-- First, let's enable RLS on invoice_overview and add policies
-- Note: RLS on views requires underlying tables to have RLS (which they do)
-- ALTER TABLE public.invoice_overview ENABLE ROW LEVEL SECURITY;

-- Create a policy for invoice_overview access (if RLS works on views in this version)
-- CREATE POLICY "Authenticated users view invoice overview" ON public.invoice_overview
--   FOR SELECT TO authenticated
--   USING (true);

-- Since RLS might not work on views, let's ensure complete access control
-- by revoking any remaining access and ensuring clean permissions
REVOKE ALL ON public.invoice_overview FROM PUBLIC;
REVOKE ALL ON public.invoice_overview FROM anon;
GRANT SELECT ON public.invoice_overview TO authenticated;
GRANT SELECT ON public.invoice_overview TO service_role;

-- Phase 2: Function Search Path Hardening
-- Set secure search_path for database roles to prevent hijacking
ALTER ROLE authenticated SET search_path = pg_catalog, public;
ALTER ROLE anon SET search_path = pg_catalog, public;

-- Fix functions with mutable search_path by setting them explicitly
-- Update key functions that don't have safe search_path

-- Function: update_updated_at_column (commonly used trigger function)
ALTER FUNCTION public.update_updated_at_column() SET search_path = public, pg_temp;

-- Function: generate_invoice_number 
ALTER FUNCTION public.generate_invoice_number() SET search_path = public, pg_temp;

-- Function: generate_service_invoice_number
ALTER FUNCTION public.generate_service_invoice_number() SET search_path = public, pg_temp;

-- Function: set_property_owner (trigger function)
ALTER FUNCTION public.set_property_owner() SET search_path = public, pg_temp;

-- Function: set_expense_creator (trigger function) 
ALTER FUNCTION public.set_expense_creator() SET search_path = public, pg_temp;

-- Function: set_announcement_creator (trigger function)
ALTER FUNCTION public.set_announcement_creator() SET search_path = public, pg_temp;

-- Function: calculate_property_total_units (trigger function)
ALTER FUNCTION public.calculate_property_total_units() SET search_path = public, pg_temp;

-- Function: create_default_landlord_subscription (trigger function)
ALTER FUNCTION public.create_default_landlord_subscription() SET search_path = public, pg_temp;

-- Function: sync_unit_status 
ALTER FUNCTION public.sync_unit_status(uuid) SET search_path = public, pg_temp;

-- Function: has_role (security critical function)
ALTER FUNCTION public.has_role(uuid, app_role) SET search_path = public, pg_temp;

-- Function: has_permission (security critical function)  
ALTER FUNCTION public.has_permission(uuid, text) SET search_path = public, pg_temp;

-- Function: user_owns_property (security function)
ALTER FUNCTION public.user_owns_property(uuid, uuid) SET search_path = public, pg_temp;

-- Function: can_remove_role (security function)
ALTER FUNCTION public.can_remove_role(uuid, uuid, app_role) SET search_path = public, pg_temp;

-- Function: is_user_tenant 
ALTER FUNCTION public.is_user_tenant(uuid) SET search_path = public, pg_temp;

-- Function: get_tenant_unit_ids
ALTER FUNCTION public.get_tenant_unit_ids(uuid) SET search_path = public, pg_temp;

-- Function: get_tenant_property_ids  
ALTER FUNCTION public.get_tenant_property_ids(uuid) SET search_path = public, pg_temp;

-- Function: get_user_profile_safe
ALTER FUNCTION public.get_user_profile_safe(uuid) SET search_path = public, pg_temp;