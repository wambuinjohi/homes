-- Fix SMS Usage Table Security: Harden access to prevent phone number harvesting
-- Remove any default permissions for anon/public and ensure strict authenticated-only access

-- Explicitly revoke all permissions from public and anon roles
REVOKE ALL PRIVILEGES ON public.sms_usage FROM PUBLIC;
REVOKE ALL PRIVILEGES ON public.sms_usage FROM anon;

-- Grant only necessary permissions to authenticated users
-- (RLS policies will further restrict based on landlord_id)
GRANT SELECT, INSERT, UPDATE, DELETE ON public.sms_usage TO authenticated;

-- Ensure the RLS policy is restrictive (replace if needed)
DROP POLICY IF EXISTS "Secure SMS access v2" ON public.sms_usage;

CREATE POLICY "Secure SMS access - landlord only"
  ON public.sms_usage
  FOR ALL
  TO authenticated
  USING (
    -- Only allow access if user is Admin OR owns the SMS record
    has_role(auth.uid(), 'Admin'::app_role) 
    OR landlord_id = auth.uid()
  )
  WITH CHECK (
    -- Only allow creation/update if user is Admin OR setting their own landlord_id
    has_role(auth.uid(), 'Admin'::app_role) 
    OR landlord_id = auth.uid()
  );

-- Add additional protection: ensure landlord_id is always set for new records
CREATE OR REPLACE FUNCTION public.set_sms_landlord_id()
RETURNS TRIGGER AS $$
BEGIN
  -- For non-admins, force landlord_id to be the authenticated user
  IF NOT public.has_role(auth.uid(), 'Admin'::app_role) THEN
    NEW.landlord_id := auth.uid();
  END IF;
  
  -- Ensure landlord_id is never null
  IF NEW.landlord_id IS NULL THEN
    RAISE EXCEPTION 'landlord_id cannot be null';
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp;

-- Apply the trigger for INSERT and UPDATE
DROP TRIGGER IF EXISTS set_sms_landlord_id_trigger ON public.sms_usage;
CREATE TRIGGER set_sms_landlord_id_trigger
  BEFORE INSERT OR UPDATE ON public.sms_usage
  FOR EACH ROW
  EXECUTE FUNCTION public.set_sms_landlord_id();