-- Fix unit status update trigger to respect maintenance status
-- The trigger should not override maintenance status when managing lease changes

DROP TRIGGER IF EXISTS trigger_update_unit_status_on_lease_change ON public.leases;
DROP FUNCTION IF EXISTS public.update_unit_status_on_lease_change();

-- Create improved function that respects maintenance status
CREATE OR REPLACE FUNCTION public.update_unit_status_on_lease_change()
RETURNS TRIGGER AS $$
DECLARE
  current_unit_status TEXT;
BEGIN
  -- Get current unit status
  SELECT status INTO current_unit_status
  FROM public.units
  WHERE id = NEW.unit_id;
  
  -- If new lease is active, set unit to occupied ONLY if not in maintenance
  IF NEW.status = 'active' THEN
    -- Only update if unit is not in maintenance
    IF current_unit_status != 'maintenance' THEN
      UPDATE public.units 
      SET status = 'occupied' 
      WHERE id = NEW.unit_id;
    END IF;
  END IF;
  
  -- If lease is terminated, check if unit should be vacant
  IF OLD IS NOT NULL AND OLD.status = 'active' AND NEW.status = 'terminated' THEN
    -- Set unit to vacant if no other active leases exist AND not in maintenance
    IF current_unit_status != 'maintenance' AND NOT EXISTS (
      SELECT 1 FROM public.leases 
      WHERE unit_id = NEW.unit_id 
      AND status = 'active' 
      AND id != NEW.id
    ) THEN
      UPDATE public.units 
      SET status = 'vacant' 
      WHERE id = NEW.unit_id;
    END IF;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Recreate trigger
CREATE TRIGGER trigger_update_unit_status_on_lease_change
  AFTER INSERT OR UPDATE ON public.leases
  FOR EACH ROW
  EXECUTE FUNCTION public.update_unit_status_on_lease_change();

-- Add comment to document the behavior
COMMENT ON FUNCTION public.update_unit_status_on_lease_change() IS 
  'Updates unit status based on lease changes. Preserves maintenance status and only updates to occupied/vacant when appropriate.';