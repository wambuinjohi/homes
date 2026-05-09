-- Critical Security Fixes (Fixed)

-- 1. Fix overpermissive RLS policy on approved_payment_methods
DROP POLICY IF EXISTS "Authenticated users can view payment methods" ON public.approved_payment_methods;
DROP POLICY IF EXISTS "Everyone can view active payment methods" ON public.approved_payment_methods;
DROP POLICY IF EXISTS "Users view enabled payment methods" ON public.approved_payment_methods;

-- Only authenticated users can view basic payment method info (no sensitive configs)
CREATE POLICY "Secure payment methods view" ON public.approved_payment_methods
FOR SELECT USING (
  auth.uid() IS NOT NULL 
  AND is_active = true
);

-- 2. Add M-Pesa credentials table for signature verification
CREATE TABLE IF NOT EXISTS public.mpesa_credentials (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  landlord_id uuid,
  consumer_key text NOT NULL,
  consumer_secret text NOT NULL,
  passkey text NOT NULL,
  shortcode text NOT NULL,
  is_sandbox boolean DEFAULT true,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE public.mpesa_credentials ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Landlords manage mpesa credentials" ON public.mpesa_credentials
FOR ALL USING (
  landlord_id = auth.uid() OR has_role(auth.uid(), 'Admin'::public.app_role)
);

-- 3. Add rate limiting table for security events
CREATE TABLE IF NOT EXISTS public.security_event_rate_limits (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ip_address inet NOT NULL,
  event_count integer DEFAULT 1,
  window_start timestamptz DEFAULT now(),
  created_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_security_rate_limits_ip_window 
ON public.security_event_rate_limits (ip_address, window_start);

-- 4. Update triggers for new tables
CREATE TRIGGER update_mpesa_credentials_updated_at 
  BEFORE UPDATE ON public.mpesa_credentials 
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();