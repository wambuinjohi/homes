-- SECURITY FIX: Create secure Admin-only function for security dashboard
-- This replaces any insecure view that may expose security statistics

-- Revoke any broad permissions that may exist (ignore errors if doesn't exist)
DO $$
BEGIN
  EXECUTE 'REVOKE SELECT ON public.security_dashboard_stats FROM authenticated';
EXCEPTION 
  WHEN undefined_table THEN NULL;
  WHEN others THEN NULL;
END $$;

-- Create secure Admin-only function for security dashboard
CREATE OR REPLACE FUNCTION public.get_security_dashboard_stats()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $function$
BEGIN
  -- SECURITY CHECK: Only allow Admins to access security statistics
  IF NOT public.has_role(auth.uid(), 'Admin'::public.app_role) THEN
    -- Log unauthorized access attempt
    PERFORM public.log_security_event(
      'unauthorized_access',
      'high',
      jsonb_build_object(
        'action', 'security_dashboard_access_denied',
        'resource', 'security_statistics',
        'user_id', auth.uid()
      ),
      auth.uid(),
      inet(coalesce(current_setting('request.headers', true)::jsonb->>'x-forwarded-for', '127.0.0.1'))
    );
    
    RAISE EXCEPTION 'Access denied. Admin privileges required to view security statistics.'
      USING ERRCODE = '42501'; -- insufficient_privilege
  END IF;

  -- Return security statistics for authorized Admins only
  RETURN jsonb_build_object(
    'events_last_24h', (
      SELECT COUNT(*) 
      FROM public.security_events 
      WHERE created_at >= now() - interval '24 hours'
    ),
    'critical_last_24h', (
      SELECT COUNT(*) 
      FROM public.security_events 
      WHERE created_at >= now() - interval '24 hours' 
      AND severity = 'critical'
    ),
    'high_last_24h', (
      SELECT COUNT(*) 
      FROM public.security_events 
      WHERE created_at >= now() - interval '24 hours' 
      AND severity = 'high'
    ),
    'unauthorized_access_last_24h', (
      SELECT COUNT(*) 
      FROM public.security_events 
      WHERE created_at >= now() - interval '24 hours' 
      AND event_type = 'unauthorized_access'
    ),
    'events_last_7d', (
      SELECT COUNT(*) 
      FROM public.security_events 
      WHERE created_at >= now() - interval '7 days'
    ),
    'top_event_types_24h', (
      SELECT jsonb_agg(
        jsonb_build_object(
          'event_type', event_type,
          'count', event_count
        ) ORDER BY event_count DESC
      )
      FROM (
        SELECT event_type, COUNT(*) as event_count
        FROM public.security_events 
        WHERE created_at >= now() - interval '24 hours'
        GROUP BY event_type
        ORDER BY COUNT(*) DESC
        LIMIT 5
      ) top_events
    ),
    'severity_breakdown_24h', (
      SELECT jsonb_agg(
        jsonb_build_object(
          'severity', severity,
          'count', severity_count
        ) ORDER BY severity_order
      )
      FROM (
        SELECT 
          severity, 
          COUNT(*) as severity_count,
          CASE severity 
            WHEN 'critical' THEN 1 
            WHEN 'high' THEN 2 
            WHEN 'medium' THEN 3 
            WHEN 'low' THEN 4 
            ELSE 5 
          END as severity_order
        FROM public.security_events 
        WHERE created_at >= now() - interval '24 hours'
        GROUP BY severity
        ORDER BY severity_order
      ) severity_stats
    ),
    'generated_at', now(),
    'generated_by', auth.uid()
  );
END;
$function$;

-- Create a helper function to check if any security views exist and warn about them
CREATE OR REPLACE FUNCTION public.audit_security_exposure()
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER  
SET search_path TO ''
AS $function$
DECLARE
  view_count integer;
  warning_text text := '';
BEGIN
  -- Check if the user is admin (only admins should run security audits)
  IF NOT public.has_role(auth.uid(), 'Admin'::public.app_role) THEN
    RETURN 'Access denied: Admin privileges required';
  END IF;

  -- Check for any views that might expose security data
  SELECT COUNT(*) INTO view_count
  FROM information_schema.views 
  WHERE table_schema = 'public' 
  AND table_name LIKE '%security%';
  
  IF view_count > 0 THEN
    warning_text := 'WARNING: Found ' || view_count || ' security-related views. Review permissions.';
  ELSE
    warning_text := 'SECURE: No security-related views detected.';
  END IF;
  
  RETURN warning_text;
END;
$function$;