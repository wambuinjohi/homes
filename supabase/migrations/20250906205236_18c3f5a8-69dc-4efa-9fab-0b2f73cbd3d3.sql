-- SECURITY FIX: Address remaining function search path warnings
-- These functions need SET search_path TO '' to prevent search path manipulation

-- Fix any remaining functions that might not have proper search path set
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $function$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$function$;

-- Fix generate_invoice_number if it exists
CREATE OR REPLACE FUNCTION public.generate_invoice_number()
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $function$
DECLARE
    next_id bigint;
    invoice_number text;
BEGIN
    -- Get the next sequence value
    SELECT nextval('public.invoice_number_seq') INTO next_id;
    
    -- Generate invoice number with proper formatting
    invoice_number := 'INV-' || TO_CHAR(EXTRACT(YEAR FROM CURRENT_DATE), 'YYYY') || '-' || LPAD(next_id::text, 6, '0');
    
    RETURN invoice_number;
END;
$function$;

-- Fix generate_service_invoice_number
CREATE OR REPLACE FUNCTION public.generate_service_invoice_number()
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $function$
BEGIN
    RETURN public.generate_invoice_number();
END;
$function$;

-- Create security monitoring views for admin dashboard
CREATE OR REPLACE VIEW public.security_dashboard_stats AS
SELECT 
  COUNT(*) FILTER (WHERE created_at >= now() - interval '24 hours') as events_last_24h,
  COUNT(*) FILTER (WHERE created_at >= now() - interval '24 hours' AND severity = 'critical') as critical_last_24h,
  COUNT(*) FILTER (WHERE created_at >= now() - interval '24 hours' AND severity = 'high') as high_last_24h,
  COUNT(*) FILTER (WHERE created_at >= now() - interval '24 hours' AND event_type = 'unauthorized_access') as unauthorized_access_last_24h,
  COUNT(*) FILTER (WHERE created_at >= now() - interval '7 days') as events_last_7d
FROM public.security_events;

-- Grant access to security dashboard for admins
GRANT SELECT ON public.security_dashboard_stats TO authenticated;

-- Create RLS policy for security dashboard
CREATE POLICY "Admins can view security dashboard stats" ON public.security_events
FOR SELECT USING (
  EXISTS (
    SELECT 1 FROM public.user_roles ur 
    WHERE ur.user_id = auth.uid() 
    AND ur.role = 'Admin'
  )
);

-- Create index on security_events for better performance
CREATE INDEX IF NOT EXISTS idx_security_events_created_at_severity 
ON public.security_events (created_at DESC, severity);

CREATE INDEX IF NOT EXISTS idx_security_events_event_type_created_at 
ON public.security_events (event_type, created_at DESC);

-- Create function to clean up old security events (optional maintenance)
CREATE OR REPLACE FUNCTION public.cleanup_old_security_events()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $function$
BEGIN
  -- Keep only last 90 days of security events (configurable)
  DELETE FROM public.security_events 
  WHERE created_at < now() - interval '90 days';
END;
$function$;