-- Update the trigger function to set landlord_id automatically
CREATE OR REPLACE FUNCTION public.set_landlord_id()
RETURNS TRIGGER AS $$
BEGIN
  NEW.landlord_id := auth.uid();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Create trigger for landlord_mpesa_configs
DROP TRIGGER IF EXISTS set_landlord_id_trigger ON public.landlord_mpesa_configs;
CREATE TRIGGER set_landlord_id_trigger
  BEFORE INSERT ON public.landlord_mpesa_configs
  FOR EACH ROW EXECUTE FUNCTION public.set_landlord_id();