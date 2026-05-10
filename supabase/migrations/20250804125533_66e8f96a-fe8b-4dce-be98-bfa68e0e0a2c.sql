-- Fix security warning by recreating the function with proper search_path
DROP FUNCTION IF EXISTS public.update_meter_readings_updated_at() CASCADE;

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

-- Recreate the trigger
CREATE TRIGGER update_meter_readings_updated_at
BEFORE UPDATE ON public.meter_readings
FOR EACH ROW
EXECUTE FUNCTION public.update_meter_readings_updated_at();