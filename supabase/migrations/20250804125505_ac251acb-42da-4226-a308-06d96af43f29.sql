-- Fix security warning for update_meter_readings_updated_at function
DROP FUNCTION IF EXISTS public.update_meter_readings_updated_at();

CREATE OR REPLACE FUNCTION public.update_meter_readings_updated_at()
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