-- Add RLS policies for tables that have RLS enabled but no policies

-- Add policies for security_event_rate_limits
CREATE POLICY "System can manage rate limits" ON public.security_event_rate_limits
FOR ALL USING (true);

-- Add policies for mpesa_credentials (already has policies, but ensure they exist)
DO $$
BEGIN
  -- Check if policy exists before creating
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'mpesa_credentials' AND policyname = 'Landlords manage mpesa credentials') THEN
    CREATE POLICY "Landlords manage mpesa credentials" ON public.mpesa_credentials
    FOR ALL USING (
      landlord_id = auth.uid() OR has_role(auth.uid(), 'Admin'::public.app_role)
    );
  END IF;
END $$;

-- Fix any remaining tables that might need basic policies
-- Add basic admin-only policies for any system tables
CREATE POLICY "Admins only" ON public.security_event_rate_limits
FOR ALL USING (has_role(auth.uid(), 'Admin'::public.app_role));

-- Drop the overly permissive policy we just created
DROP POLICY IF EXISTS "System can manage rate limits" ON public.security_event_rate_limits;