
-- 1) User sessions table to back "Sessions" feature
CREATE TABLE IF NOT EXISTS public.user_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  login_at timestamptz NOT NULL DEFAULT now(),
  logout_at timestamptz NULL,
  last_activity timestamptz NULL,
  ip_address inet NULL,
  user_agent text NULL,
  device_info jsonb NOT NULL DEFAULT '{}'::jsonb,
  location text NULL,
  is_active boolean NOT NULL DEFAULT true,
  session_token text NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.user_sessions ENABLE ROW LEVEL SECURITY;

-- Admins can manage sessions
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE schemaname = 'public' AND tablename = 'user_sessions' AND policyname = 'Admins can manage sessions'
  ) THEN
    CREATE POLICY "Admins can manage sessions"
    ON public.user_sessions
    FOR ALL
    USING (public.has_role(auth.uid(), 'Admin'::public.app_role))
    WITH CHECK (public.has_role(auth.uid(), 'Admin'::public.app_role));
  END IF;
END$$;

-- Users can view their own sessions
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE schemaname = 'public' AND tablename = 'user_sessions' AND policyname = 'Users can view own sessions'
  ) THEN
    CREATE POLICY "Users can view own sessions"
    ON public.user_sessions
    FOR SELECT
    USING (auth.uid() = user_id);
  END IF;
END$$;

-- Users can insert their own sessions (optional for client-side logging)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE schemaname = 'public' AND tablename = 'user_sessions' AND policyname = 'Users can insert own sessions'
  ) THEN
    CREATE POLICY "Users can insert own sessions"
    ON public.user_sessions
    FOR INSERT
    WITH CHECK (auth.uid() = user_id);
  END IF;
END$$;

-- Users can update their own sessions (e.g., set logout_at on sign-out)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE schemaname = 'public' AND tablename = 'user_sessions' AND policyname = 'Users can update own sessions'
  ) THEN
    CREATE POLICY "Users can update own sessions"
    ON public.user_sessions
    FOR UPDATE
    USING (auth.uid() = user_id)
    WITH CHECK (auth.uid() = user_id);
  END IF;
END$$;

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_user_sessions_user_login 
  ON public.user_sessions (user_id, login_at DESC);

-- updated_at trigger
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger 
    WHERE tgname = 'set_user_sessions_updated_at'
  ) THEN
    CREATE TRIGGER set_user_sessions_updated_at
    BEFORE UPDATE ON public.user_sessions
    FOR EACH ROW
    EXECUTE FUNCTION public.update_updated_at_column();
  END IF;
END$$;

-- 2) Impersonation sessions table for audit and control
CREATE TABLE IF NOT EXISTS public.impersonation_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  admin_user_id uuid NOT NULL,
  impersonated_user_id uuid NOT NULL,
  session_token text NOT NULL,
  is_active boolean NOT NULL DEFAULT true,
  started_at timestamptz NOT NULL DEFAULT now(),
  ended_at timestamptz NULL,
  ip_address inet NULL,
  user_agent text NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.impersonation_sessions ENABLE ROW LEVEL SECURITY;

-- Admins can manage impersonation sessions
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE schemaname = 'public' AND tablename = 'impersonation_sessions' AND policyname = 'Admins can manage impersonation sessions'
  ) THEN
    CREATE POLICY "Admins can manage impersonation sessions"
    ON public.impersonation_sessions
    FOR ALL
    USING (public.has_role(auth.uid(), 'Admin'::public.app_role))
    WITH CHECK (public.has_role(auth.uid(), 'Admin'::public.app_role));
  END IF;
END$$;

-- Indexes for convenience
CREATE INDEX IF NOT EXISTS idx_impersonation_admin ON public.impersonation_sessions (admin_user_id);
CREATE INDEX IF NOT EXISTS idx_impersonation_user ON public.impersonation_sessions (impersonated_user_id);

-- updated_at trigger
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger 
    WHERE tgname = 'set_impersonation_sessions_updated_at'
  ) THEN
    CREATE TRIGGER set_impersonation_sessions_updated_at
    BEFORE UPDATE ON public.impersonation_sessions
    FOR EACH ROW
    EXECUTE FUNCTION public.update_updated_at_column();
  END IF;
END$$;

-- 3) Read RPC for Activity modal: map performed_at to created_at
CREATE OR REPLACE FUNCTION public.get_user_audit_history(
  _user_id uuid,
  _limit integer DEFAULT 50,
  _offset integer DEFAULT 0
)
RETURNS TABLE(
  id uuid,
  action text,
  entity_type text,
  entity_id uuid,
  details jsonb,
  created_at timestamptz
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO ''
AS $function$
  SELECT
    ual.id,
    ual.action,
    ual.entity_type,
    ual.entity_id,
    ual.details,
    ual.performed_at AS created_at
  FROM public.user_activity_logs ual
  WHERE ual.user_id = _user_id
  ORDER BY ual.performed_at DESC
  LIMIT COALESCE(_limit, 50)
  OFFSET COALESCE(_offset, 0);
$function$;

-- 4) Write RPC for admin actions so we can include performed_by in details
CREATE OR REPLACE FUNCTION public.log_user_audit(
  _user_id uuid,
  _action text,
  _entity_type text DEFAULT NULL::text,
  _entity_id uuid DEFAULT NULL::uuid,
  _details jsonb DEFAULT NULL::jsonb,
  _performed_by uuid DEFAULT NULL::uuid,
  _ip_address inet DEFAULT NULL::inet,
  _user_agent text DEFAULT NULL::text
)
RETURNS void
LANGUAGE sql
SECURITY DEFINER
SET search_path TO ''
AS $function$
  INSERT INTO public.user_activity_logs (
    user_id, action, entity_type, entity_id, details, ip_address, user_agent
  ) VALUES (
    _user_id,
    _action,
    _entity_type,
    _entity_id,
    COALESCE(_details, '{}'::jsonb) || jsonb_build_object('performed_by', _performed_by),
    _ip_address,
    _user_agent
  );
$function$;
