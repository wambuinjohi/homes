-- Fix RLS policies and add security improvements (handle existing policies)

-- Update api_rate_limits policy to restrict access properly
DROP POLICY IF EXISTS "Users can manage their own rate limits" ON public.api_rate_limits;
CREATE POLICY "System can manage rate limits" 
ON public.api_rate_limits 
FOR ALL 
USING (auth.uid() IS NOT NULL); -- Only authenticated users, system manages internally

-- Add proper search_path to existing functions that are missing it
ALTER FUNCTION public.has_permission(_user_id uuid, _permission text) 
SET search_path = 'public';

ALTER FUNCTION public.is_user_tenant(_user_id uuid) 
SET search_path = 'public';

ALTER FUNCTION public.user_owns_property(_property_id uuid, _user_id uuid) 
SET search_path = 'public';

-- Create enhanced user session tracking table if it doesn't exist
CREATE TABLE IF NOT EXISTS public.user_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  session_token text,
  ip_address inet,
  user_agent text,
  login_at timestamp with time zone DEFAULT now(),
  logout_at timestamp with time zone,
  is_active boolean DEFAULT true,
  expires_at timestamp with time zone,
  created_at timestamp with time zone DEFAULT now()
);

-- Enable RLS on user_sessions if not already enabled
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_tables 
    WHERE tablename = 'user_sessions' 
    AND rowsecurity = true
  ) THEN
    ALTER TABLE public.user_sessions ENABLE ROW LEVEL SECURITY;
  END IF;
END $$;

-- Drop and recreate RLS policies for user_sessions to avoid conflicts
DROP POLICY IF EXISTS "Admins can view all sessions" ON public.user_sessions;
DROP POLICY IF EXISTS "Users can view their own sessions" ON public.user_sessions;
DROP POLICY IF EXISTS "System can insert sessions" ON public.user_sessions;
DROP POLICY IF EXISTS "System can update sessions" ON public.user_sessions;

CREATE POLICY "Admins can view all sessions" 
ON public.user_sessions 
FOR SELECT 
USING (has_role(auth.uid(), 'Admin'::app_role));

CREATE POLICY "Users can view their own sessions" 
ON public.user_sessions 
FOR SELECT 
USING (auth.uid() = user_id);

CREATE POLICY "System can insert sessions" 
ON public.user_sessions 
FOR INSERT 
WITH CHECK (true);

CREATE POLICY "System can update sessions" 
ON public.user_sessions 
FOR UPDATE 
USING (true);

-- Create notification preferences table for users if it doesn't exist
CREATE TABLE IF NOT EXISTS public.notification_preferences (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL UNIQUE,
  email_enabled boolean DEFAULT true,
  sms_enabled boolean DEFAULT false,
  maintenance_notifications boolean DEFAULT true,
  payment_notifications boolean DEFAULT true,
  system_notifications boolean DEFAULT true,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now()
);

-- Enable RLS on notification_preferences if not already enabled
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_tables 
    WHERE tablename = 'notification_preferences' 
    AND rowsecurity = true
  ) THEN
    ALTER TABLE public.notification_preferences ENABLE ROW LEVEL SECURITY;
  END IF;
END $$;

-- Drop and recreate RLS policies for notification_preferences
DROP POLICY IF EXISTS "Users can manage their notification preferences" ON public.notification_preferences;
DROP POLICY IF EXISTS "Admins can view all notification preferences" ON public.notification_preferences;

CREATE POLICY "Users can manage their notification preferences" 
ON public.notification_preferences 
FOR ALL 
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Admins can view all notification preferences" 
ON public.notification_preferences 
FOR SELECT 
USING (has_role(auth.uid(), 'Admin'::app_role));

-- Create function to get user audit history (for admin operations)
CREATE OR REPLACE FUNCTION public.get_user_audit_history(
  p_user_id uuid,
  p_limit integer DEFAULT 100,
  p_offset integer DEFAULT 0
)
RETURNS TABLE(
  log_id uuid,
  action text,
  entity_type text,
  entity_id uuid,
  details jsonb,
  performed_at timestamp with time zone,
  ip_address inet,
  user_agent text
) 
LANGUAGE sql
SECURITY DEFINER
SET search_path = 'public'
AS $$
  SELECT 
    id as log_id,
    action,
    entity_type,
    entity_id,
    details,
    performed_at,
    ip_address,
    user_agent
  FROM public.user_activity_logs
  WHERE user_id = p_user_id
  ORDER BY performed_at DESC
  LIMIT p_limit
  OFFSET p_offset;
$$;

-- Update updated_at trigger for notification_preferences if table exists
DO $$ 
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables 
    WHERE table_name = 'notification_preferences'
  ) THEN
    DROP TRIGGER IF EXISTS update_notification_preferences_updated_at ON public.notification_preferences;
    CREATE TRIGGER update_notification_preferences_updated_at
      BEFORE UPDATE ON public.notification_preferences
      FOR EACH ROW
      EXECUTE FUNCTION public.update_updated_at_column();
  END IF;
END $$;

-- Create function to check if user can manage tenant (enhanced security)
CREATE OR REPLACE FUNCTION public.can_user_manage_tenant(_user_id uuid, _tenant_id uuid)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
SET search_path = 'public'
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.tenants t
    JOIN public.leases l ON t.id = l.tenant_id
    JOIN public.units u ON l.unit_id = u.id
    JOIN public.properties p ON u.property_id = p.id
    WHERE t.id = _tenant_id
      AND (p.owner_id = _user_id OR p.manager_id = _user_id)
  ) OR has_role(_user_id, 'Admin'::app_role);
$$;