-- Create security events logging table
CREATE TABLE IF NOT EXISTS public.security_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_type text NOT NULL,
  severity text NOT NULL DEFAULT 'medium' CHECK (severity IN ('low', 'medium', 'high', 'critical')),
  user_id uuid,
  ip_address inet,
  user_agent text,
  details jsonb DEFAULT '{}',
  created_at timestamp with time zone DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.security_events ENABLE ROW LEVEL SECURITY;

-- Create policies
CREATE POLICY "Admins can view all security events" ON public.security_events
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.user_roles 
      WHERE user_id = auth.uid() AND role = 'Admin'::public.app_role
    )
  );

CREATE POLICY "System can insert security events" ON public.security_events
  FOR INSERT WITH CHECK (true);

-- Create security event logging function
CREATE OR REPLACE FUNCTION public.log_security_event(
  _event_type text,
  _severity text DEFAULT 'medium',
  _details jsonb DEFAULT '{}',
  _user_id uuid DEFAULT NULL,
  _ip_address text DEFAULT NULL
) RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $$
BEGIN
  INSERT INTO public.security_events (
    event_type, severity, user_id, ip_address, details
  ) VALUES (
    _event_type, _severity, _user_id, _ip_address::inet, _details
  );
END;
$$;

-- Create SMS usage logging table with proper security
CREATE TABLE IF NOT EXISTS public.sms_usage_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  landlord_id uuid NOT NULL,
  recipient_phone text NOT NULL,
  message_content text,
  cost numeric NOT NULL DEFAULT 0,
  status text NOT NULL CHECK (status IN ('pending', 'sent', 'failed', 'delivered')),
  provider_name text,
  sent_at timestamp with time zone DEFAULT now(),
  created_at timestamp with time zone DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.sms_usage_logs ENABLE ROW LEVEL SECURITY;

-- Create policies
CREATE POLICY "Landlords can view their SMS usage" ON public.sms_usage_logs
  FOR ALL USING (
    landlord_id = auth.uid() OR 
    EXISTS (
      SELECT 1 FROM public.user_roles 
      WHERE user_id = auth.uid() AND role = 'Admin'::public.app_role
    )
  );

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_security_events_type ON public.security_events(event_type);
CREATE INDEX IF NOT EXISTS idx_security_events_severity ON public.security_events(severity);
CREATE INDEX IF NOT EXISTS idx_sms_usage_logs_landlord ON public.sms_usage_logs(landlord_id);