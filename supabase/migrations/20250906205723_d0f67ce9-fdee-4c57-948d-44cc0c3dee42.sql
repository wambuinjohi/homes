-- SECURITY FIX: Create secure Admin-only function for security dashboard statistics
-- This replaces any insecure views or functions that might expose security data

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
        'attempted_by', auth.uid()
      ),
      auth.uid(),
      inet(coalesce(current_setting('request.headers', true)::jsonb->>'x-forwarded-for', '127.0.0.1'))
    );
    
    RAISE EXCEPTION 'Access denied. Admin privileges required to view security statistics.';
  END IF;

  -- Return comprehensive security statistics for authorized Admins only
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
        )
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
        )
      )
      FROM (
        SELECT severity, COUNT(*) as severity_count
        FROM public.security_events 
        WHERE created_at >= now() - interval '24 hours'
        GROUP BY severity
        ORDER BY 
          CASE severity 
            WHEN 'critical' THEN 1 
            WHEN 'high' THEN 2 
            WHEN 'medium' THEN 3 
            WHEN 'low' THEN 4 
            ELSE 5 
          END
      ) severity_stats
    ),
    'recent_critical_events', (
      SELECT jsonb_agg(
        jsonb_build_object(
          'event_type', event_type,
          'severity', severity,
          'created_at', created_at,
          'details', details
        )
      )
      FROM (
        SELECT event_type, severity, created_at, details
        FROM public.security_events 
        WHERE created_at >= now() - interval '24 hours'
        AND severity IN ('critical', 'high')
        ORDER BY created_at DESC
        LIMIT 10
      ) recent_events
    ),
    'generated_at', now(),
    'generated_by', auth.uid()
  );
END;
$function$;

-- Ensure no residual permissions exist on any security views
-- This is a safety measure to revoke any potential grants
DO $$
DECLARE
    view_name text;
BEGIN
    -- Check for any views that might contain 'security' in the name
    FOR view_name IN 
        SELECT viewname FROM pg_views 
        WHERE schemaname = 'public' 
        AND viewname ILIKE '%security%'
    LOOP
        EXECUTE format('REVOKE ALL ON %I FROM public, authenticated', view_name);
    END LOOP;
END $$;