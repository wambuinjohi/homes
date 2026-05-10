-- First, clean up existing duplicate active leases (keep the most recent one)
WITH duplicate_leases AS (
  SELECT 
    l.id,
    l.unit_id,
    l.created_at,
    ROW_NUMBER() OVER (
      PARTITION BY l.unit_id 
      ORDER BY l.created_at DESC
    ) as rn
  FROM public.leases l
  WHERE l.status = 'active'
)
UPDATE public.leases 
SET status = 'terminated'
WHERE id IN (
  SELECT id FROM duplicate_leases WHERE rn > 1
);

-- Now add the unique constraint to prevent future duplicates
CREATE UNIQUE INDEX idx_unique_active_lease_per_unit 
ON public.leases (unit_id) 
WHERE status = 'active';

-- Add function to update unit status when lease is created/updated
CREATE OR REPLACE FUNCTION public.update_unit_status_on_lease_change()
RETURNS TRIGGER AS $$
BEGIN
  -- If new lease is active, set unit to occupied
  IF NEW.status = 'active' THEN
    UPDATE public.units 
    SET status = 'occupied' 
    WHERE id = NEW.unit_id;
  END IF;
  
  -- If lease is terminated, check if unit should be vacant
  IF OLD IS NOT NULL AND OLD.status = 'active' AND NEW.status = 'terminated' THEN
    -- Set unit to vacant if no other active leases exist
    IF NOT EXISTS (
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

-- Create trigger for lease status changes
CREATE TRIGGER trigger_update_unit_status_on_lease_change
  AFTER INSERT OR UPDATE ON public.leases
  FOR EACH ROW
  EXECUTE FUNCTION public.update_unit_status_on_lease_change();

-- Update unit statuses based on current active leases
UPDATE public.units 
SET status = CASE 
  WHEN EXISTS (
    SELECT 1 FROM public.leases 
    WHERE unit_id = units.id 
    AND status = 'active'
  ) THEN 'occupied'
  ELSE 'vacant'
END;