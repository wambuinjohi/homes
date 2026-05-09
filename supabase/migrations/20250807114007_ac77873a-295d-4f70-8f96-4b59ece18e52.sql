-- Fix search path security issues for functions
CREATE OR REPLACE FUNCTION public.calculate_property_total_units()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $$
BEGIN
  -- Update the property's total_units based on actual units count
  UPDATE public.properties 
  SET total_units = (
    SELECT COUNT(*) 
    FROM public.units 
    WHERE property_id = COALESCE(NEW.property_id, OLD.property_id)
  )
  WHERE id = COALESCE(NEW.property_id, OLD.property_id);
  
  RETURN COALESCE(NEW, OLD);
END;
$$;