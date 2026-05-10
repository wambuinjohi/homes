-- Security fixes: RLS policy tightening and search path hardening (fixed)

-- 1. Fix email_templates RLS policies to prevent access to system templates
DROP POLICY IF EXISTS "Admins can manage all email templates" ON public.email_templates;
DROP POLICY IF EXISTS "Landlords can manage their SMS templates" ON public.email_templates;
DROP POLICY IF EXISTS "Users can view published email templates" ON public.email_templates;

CREATE POLICY "Admins manage all email templates" ON public.email_templates
FOR ALL USING (has_role(auth.uid(), 'Admin'::app_role));

CREATE POLICY "Landlords manage their own email templates" ON public.email_templates  
FOR ALL USING (
  has_role(auth.uid(), 'Landlord'::app_role) 
  AND landlord_id = auth.uid()
);

CREATE POLICY "Users view enabled email templates" ON public.email_templates
FOR SELECT USING (
  enabled = true 
  AND (
    has_role(auth.uid(), 'Admin'::app_role)
    OR (has_role(auth.uid(), 'Landlord'::app_role) AND (landlord_id = auth.uid() OR landlord_id IS NULL))
  )
);

-- 2. Fix sms_templates RLS policies to prevent access to system templates  
DROP POLICY IF EXISTS "Landlords can manage their SMS templates" ON public.sms_templates;

CREATE POLICY "Admins manage all SMS templates" ON public.sms_templates
FOR ALL USING (has_role(auth.uid(), 'Admin'::app_role));

CREATE POLICY "Landlords manage their own SMS templates" ON public.sms_templates
FOR ALL USING (
  has_role(auth.uid(), 'Landlord'::app_role)
  AND landlord_id = auth.uid()  
);

CREATE POLICY "Users view enabled SMS templates" ON public.sms_templates
FOR SELECT USING (
  enabled = true
  AND (
    has_role(auth.uid(), 'Admin'::app_role)
    OR (has_role(auth.uid(), 'Landlord'::app_role) AND (landlord_id = auth.uid() OR landlord_id IS NULL))
  )
);

-- 3. Secure approved_payment_methods table - limit public access to basic info only
ALTER TABLE public.approved_payment_methods ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins manage payment methods" ON public.approved_payment_methods
FOR ALL USING (has_role(auth.uid(), 'Admin'::app_role));

CREATE POLICY "Users view enabled payment methods" ON public.approved_payment_methods
FOR SELECT USING (
  is_active = true 
  AND auth.role() = 'authenticated'
);

-- 4. Secure unit_types table - restrict to property owners and admins
ALTER TABLE public.unit_types ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins manage unit types" ON public.unit_types
FOR ALL USING (has_role(auth.uid(), 'Admin'::app_role));

CREATE POLICY "Property stakeholders view unit types" ON public.unit_types
FOR SELECT USING (
  has_role(auth.uid(), 'Landlord'::app_role) 
  OR has_role(auth.uid(), 'Manager'::app_role)
  OR has_role(auth.uid(), 'Agent'::app_role)
);

-- 5. Add logging for security events
CREATE OR REPLACE FUNCTION public.log_security_event(_event_type text, _details jsonb DEFAULT NULL, _user_id uuid DEFAULT auth.uid(), _ip_address inet DEFAULT NULL)
RETURNS void
LANGUAGE sql
SECURITY DEFINER
SET search_path TO ''
AS $function$
  INSERT INTO public.user_activity_logs (user_id, action, entity_type, details, ip_address, performed_at)
  VALUES (COALESCE(_user_id, '00000000-0000-0000-0000-000000000000'::uuid), _event_type, 'security', _details, _ip_address, now());
$function$;

-- 6. Create rate limiting table for API calls
CREATE TABLE IF NOT EXISTS public.api_rate_limits (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  identifier text NOT NULL, -- IP address or user ID
  endpoint text NOT NULL,
  request_count integer NOT NULL DEFAULT 1,
  window_start timestamp with time zone NOT NULL DEFAULT now(),
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  UNIQUE(identifier, endpoint, window_start)
);

ALTER TABLE public.api_rate_limits ENABLE ROW LEVEL SECURITY;

CREATE POLICY "System manages rate limits" ON public.api_rate_limits
FOR ALL USING (true);

-- Create index for rate limiting queries
CREATE INDEX IF NOT EXISTS idx_api_rate_limits_lookup 
ON public.api_rate_limits (identifier, endpoint, window_start);

-- 7. Create function to check rate limits
CREATE OR REPLACE FUNCTION public.check_rate_limit(_identifier text, _endpoint text, _max_requests integer DEFAULT 60, _window_minutes integer DEFAULT 1)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $function$
DECLARE
  v_window_start timestamp with time zone;
  v_current_count integer;
BEGIN
  -- Calculate window start (truncate to minute)
  v_window_start := date_trunc('minute', now());
  
  -- Get or create rate limit record
  INSERT INTO public.api_rate_limits (identifier, endpoint, request_count, window_start)
  VALUES (_identifier, _endpoint, 1, v_window_start)
  ON CONFLICT (identifier, endpoint, window_start) 
  DO UPDATE SET 
    request_count = api_rate_limits.request_count + 1,
    created_at = now()
  RETURNING request_count INTO v_current_count;
  
  -- Check if limit exceeded
  IF v_current_count > _max_requests THEN
    -- Log rate limit violation
    PERFORM public.log_security_event(
      'rate_limit_exceeded',
      jsonb_build_object(
        'identifier', _identifier,
        'endpoint', _endpoint,
        'request_count', v_current_count,
        'max_requests', _max_requests
      )
    );
    
    RETURN jsonb_build_object(
      'allowed', false,
      'remaining', 0,
      'reset_time', v_window_start + make_interval(mins => _window_minutes)
    );
  END IF;
  
  RETURN jsonb_build_object(
    'allowed', true,
    'remaining', _max_requests - v_current_count,
    'reset_time', v_window_start + make_interval(mins => _window_minutes)
  );
END;
$function$;