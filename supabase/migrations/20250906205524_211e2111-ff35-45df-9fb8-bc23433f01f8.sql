-- SECURITY FIX: Remove publicly accessible security dashboard view
-- and replace with Admin-only secure function

-- Step 1: Drop the insecure view and revoke permissions
DROP VIEW IF EXISTS public.security_dashboard_stats;
REVOKE SELECT ON public.security_dashboard_stats FROM authenticated;

-- Step 2: Create secure Admin-only function for security dashboard
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
    INSERT INTO public.security_events (
      event_type, 
      severity, 
      details, 
      user_id, 
      ip_address
    ) VALUES (
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
    
    RAISE EXCEPTION 'Access denied. Admin privileges required to view security statistics.';
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
    'generated_at', now(),
    'generated_by', auth.uid()
  );
END;
$function$;