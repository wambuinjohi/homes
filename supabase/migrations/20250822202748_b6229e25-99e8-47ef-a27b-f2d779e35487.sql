
-- 1) Central tables for self-hosted visibility

-- Self-hosted deployments registry
CREATE TABLE IF NOT EXISTS public.self_hosted_instances (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  landlord_id UUID NOT NULL,                        -- do not FK to auth.users; keep decoupled
  name TEXT NOT NULL,
  domain TEXT,
  write_key_hash TEXT NOT NULL,                     -- store a SHA-256 (or similar) hash of the write key
  status TEXT NOT NULL DEFAULT 'active',            -- active | suspended
  last_seen_at TIMESTAMPTZ,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Heartbeats
CREATE TABLE IF NOT EXISTS public.telemetry_heartbeats (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  instance_id UUID NOT NULL REFERENCES public.self_hosted_instances(id) ON DELETE CASCADE,
  app_version TEXT,
  environment TEXT,
  online_users INTEGER,
  metrics JSONB NOT NULL DEFAULT '{}'::jsonb,       -- e.g., memory, CPU, queue sizes, etc.
  reported_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Usage / performance / security events
CREATE TABLE IF NOT EXISTS public.telemetry_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  instance_id UUID NOT NULL REFERENCES public.self_hosted_instances(id) ON DELETE CASCADE,
  event_type TEXT NOT NULL,                         -- e.g., feature_usage, api_call, performance_metric, security_event
  severity TEXT,                                    -- optional: info | warn | error | critical
  payload JSONB NOT NULL DEFAULT '{}'::jsonb,       -- anonymized event data
  occurred_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  dedupe_key TEXT                                   -- optional client-provided key for de-duplication
);

-- Error reports
CREATE TABLE IF NOT EXISTS public.telemetry_errors (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  instance_id UUID NOT NULL REFERENCES public.self_hosted_instances(id) ON DELETE CASCADE,
  message TEXT NOT NULL,
  stack TEXT,
  url TEXT,
  severity TEXT NOT NULL DEFAULT 'error',           -- error | warning | critical
  fingerprint TEXT,                                  -- for grouping
  user_id_hash TEXT,                                 -- optional hashed identifier
  context JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 2) Indexes for query performance
CREATE INDEX IF NOT EXISTS idx_self_hosted_instances_landlord ON public.self_hosted_instances(landlord_id);
CREATE INDEX IF NOT EXISTS idx_self_hosted_instances_last_seen ON public.self_hosted_instances(last_seen_at);

CREATE INDEX IF NOT EXISTS idx_telemetry_heartbeats_instance_time ON public.telemetry_heartbeats(instance_id, reported_at DESC);

CREATE INDEX IF NOT EXISTS idx_telemetry_events_instance_time ON public.telemetry_events(instance_id, occurred_at DESC);
CREATE INDEX IF NOT EXISTS idx_telemetry_events_type ON public.telemetry_events(event_type);
CREATE INDEX IF NOT EXISTS idx_telemetry_events_dedupe ON public.telemetry_events(dedupe_key);

CREATE INDEX IF NOT EXISTS idx_telemetry_errors_instance_time ON public.telemetry_errors(instance_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_telemetry_errors_fingerprint ON public.telemetry_errors(fingerprint);

-- 3) RLS and policies
ALTER TABLE public.self_hosted_instances ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.telemetry_heartbeats ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.telemetry_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.telemetry_errors ENABLE ROW LEVEL SECURITY;

-- Admins can see/manage everything
CREATE POLICY "Admins can view instances"
  ON public.self_hosted_instances
  FOR SELECT
  USING (has_role(auth.uid(), 'Admin'::app_role));

CREATE POLICY "Admins can manage instances"
  ON public.self_hosted_instances
  FOR ALL
  USING (has_role(auth.uid(), 'Admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'Admin'::app_role));

CREATE POLICY "Admins can view heartbeats"
  ON public.telemetry_heartbeats
  FOR SELECT
  USING (has_role(auth.uid(), 'Admin'::app_role));

CREATE POLICY "Admins can view events"
  ON public.telemetry_events
  FOR SELECT
  USING (has_role(auth.uid(), 'Admin'::app_role));

CREATE POLICY "Admins can view errors"
  ON public.telemetry_errors
  FOR SELECT
  USING (has_role(auth.uid(), 'Admin'::app_role));

-- Optional: landlords can see their own instances and telemetry
CREATE POLICY "Landlords can view their instances"
  ON public.self_hosted_instances
  FOR SELECT
  USING (landlord_id = auth.uid());

CREATE POLICY "Landlords can view their heartbeats"
  ON public.telemetry_heartbeats
  FOR SELECT
  USING (instance_id IN (SELECT id FROM public.self_hosted_instances WHERE landlord_id = auth.uid()));

CREATE POLICY "Landlords can view their events"
  ON public.telemetry_events
  FOR SELECT
  USING (instance_id IN (SELECT id FROM public.self_hosted_instances WHERE landlord_id = auth.uid()));

CREATE POLICY "Landlords can view their errors"
  ON public.telemetry_errors
  FOR SELECT
  USING (instance_id IN (SELECT id FROM public.self_hosted_instances WHERE landlord_id = auth.uid()));

-- System inserts via Edge Functions (trusted code)
CREATE POLICY "System can insert heartbeats"
  ON public.telemetry_heartbeats
  FOR INSERT
  WITH CHECK (true);

CREATE POLICY "System can insert events"
  ON public.telemetry_events
  FOR INSERT
  WITH CHECK (true);

CREATE POLICY "System can insert errors"
  ON public.telemetry_errors
  FOR INSERT
  WITH CHECK (true);

-- 4) Updated_at maintenance
-- Reuse existing update_updated_at_column() function to keep updated_at fresh on self_hosted_instances
DROP TRIGGER IF EXISTS set_updated_at_on_self_hosted_instances ON public.self_hosted_instances;
CREATE TRIGGER set_updated_at_on_self_hosted_instances
  BEFORE UPDATE ON public.self_hosted_instances
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();
