-- Fix update_email_logs_updated_at function
DROP FUNCTION IF EXISTS public.update_email_logs_updated_at() CASCADE;

CREATE OR REPLACE FUNCTION public.update_email_logs_updated_at()
RETURNS TRIGGER 
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

-- Recreate the trigger
CREATE TRIGGER update_email_logs_updated_at
BEFORE UPDATE ON public.email_logs
FOR EACH ROW
EXECUTE FUNCTION public.update_email_logs_updated_at();