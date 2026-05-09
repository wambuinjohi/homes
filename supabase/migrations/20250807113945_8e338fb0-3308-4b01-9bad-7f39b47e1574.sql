-- Make total_units optional in properties table and create auto-calculation trigger
ALTER TABLE public.properties ALTER COLUMN total_units SET DEFAULT 0;

-- Create function to calculate total units
CREATE OR REPLACE FUNCTION public.calculate_property_total_units()
RETURNS TRIGGER AS $$
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
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create triggers to auto-update total_units when units are added/removed/updated
CREATE TRIGGER update_property_total_units_on_insert
  AFTER INSERT ON public.units
  FOR EACH ROW
  EXECUTE FUNCTION public.calculate_property_total_units();

CREATE TRIGGER update_property_total_units_on_update
  AFTER UPDATE ON public.units
  FOR EACH ROW
  EXECUTE FUNCTION public.calculate_property_total_units();

CREATE TRIGGER update_property_total_units_on_delete
  AFTER DELETE ON public.units
  FOR EACH ROW
  EXECUTE FUNCTION public.calculate_property_total_units();