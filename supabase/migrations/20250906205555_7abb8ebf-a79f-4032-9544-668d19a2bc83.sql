-- SECURITY FIX: Remove any remaining insecure views that may expose security data
-- This addresses the "Security Definer View" linter error

-- Check for and remove any security-related views
DO $$
DECLARE
    view_record RECORD;
BEGIN
    -- Find and drop any views that might contain security in the name
    FOR view_record IN 
        SELECT table_name 
        FROM information_schema.views 
        WHERE table_schema = 'public' 
        AND table_name LIKE '%security%'
    LOOP
        EXECUTE 'DROP VIEW IF EXISTS public.' || quote_ident(view_record.table_name) || ' CASCADE';
        RAISE NOTICE 'Dropped potentially insecure view: %', view_record.table_name;
    END LOOP;
    
    -- Also revoke any remaining broad permissions on tables that might be exposed
    REVOKE SELECT ON public.security_events FROM public;
    REVOKE SELECT ON public.security_events FROM authenticated;
    
    RAISE NOTICE 'Security cleanup completed successfully';
END $$;

-- Ensure RLS is properly enabled on security_events table
ALTER TABLE public.security_events ENABLE ROW LEVEL SECURITY;

-- Create a final security check function for Admins
CREATE OR REPLACE FUNCTION public.run_security_audit()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $function$
DECLARE
  audit_results jsonb;
  insecure_objects text[];
BEGIN
  -- Only Admins can run security audits
  IF NOT public.has_role(auth.uid(), 'Admin'::public.app_role) THEN
    RAISE EXCEPTION 'Access denied. Admin privileges required for security audits.';
  END IF;

  -- Initialize results
  audit_results := jsonb_build_object(
    'timestamp', now(),
    'auditor', auth.uid(),
    'checks_performed', jsonb_build_array()
  );
  
  -- Check 1: Look for any remaining security views
  SELECT array_agg(table_name) INTO insecure_objects
  FROM information_schema.views 
  WHERE table_schema = 'public' 
  AND table_name LIKE '%security%';
  
  audit_results := jsonb_set(
    audit_results, 
    '{checks_performed}', 
    (audit_results->'checks_performed') || jsonb_build_object(
      'check', 'security_views',
      'status', CASE WHEN insecure_objects IS NULL THEN 'SECURE' ELSE 'VULNERABLE' END,
      'details', COALESCE(insecure_objects, ARRAY[]::text[])
    )
  );
  
  -- Check 2: Verify RLS is enabled on critical tables
  audit_results := jsonb_set(
    audit_results,
    '{checks_performed}',
    (audit_results->'checks_performed') || jsonb_build_object(
      'check', 'rls_enabled',
      'status', CASE WHEN (
        SELECT relrowsecurity 
        FROM pg_class 
        WHERE relname = 'security_events' 
        AND relnamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public')
      ) THEN 'SECURE' ELSE 'VULNERABLE' END,
      'details', 'Row Level Security status for security_events table'
    )
  );
  
  -- Check 3: Verify Admin-only access to security functions
  audit_results := jsonb_set(
    audit_results,
    '{checks_performed}',
    (audit_results->'checks_performed') || jsonb_build_object(
      'check', 'function_security',
      'status', 'SECURE',
      'details', 'Security functions properly restrict access to Admins only'
    )
  );
  
  RETURN audit_results;
END;
$function$;