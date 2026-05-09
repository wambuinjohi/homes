
-- 1) Function to sync unit.status from leases
CREATE OR REPLACE FUNCTION public.sync_unit_status(p_unit_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $function$
DECLARE
  v_has_active boolean := false;
  v_current_status text;
BEGIN
  IF p_unit_id IS NULL THEN
    RETURN;
  END IF;

  -- Determine if there is an active lease covering today
  SELECT EXISTS (
    SELECT 1
    FROM public.leases l
    WHERE l.unit_id = p_unit_id
      AND COALESCE(l.status, 'active') = 'active'
      AND l.lease_start_date <= current_date
      AND (l.lease_end_date IS NULL OR l.lease_end_date >= current_date)
  )
  INTO v_has_active;

  -- If the unit is under maintenance, do not override manual status
  SELECT u.status
  INTO v_current_status
  FROM public.units u
  WHERE u.id = p_unit_id;

  IF v_current_status = 'maintenance' THEN
    RETURN;
  END IF;

  -- Update to the computed occupancy
  UPDATE public.units
  SET status = CASE WHEN v_has_active THEN 'occupied' ELSE 'vacant' END,
      updated_at = now()
  WHERE id = p_unit_id;
END;
$function$;

-- 2) Trigger to call sync on lease changes
CREATE OR REPLACE FUNCTION public.trg_sync_unit_status_from_leases()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $function$
BEGIN
  PERFORM public.sync_unit_status(COALESCE(NEW.unit_id, OLD.unit_id));
  RETURN NULL;
END;
$function$;

-- 3) Create trigger on leases after changes
DROP TRIGGER IF EXISTS leases_sync_unit_status_aiud ON public.leases;
CREATE TRIGGER leases_sync_unit_status_aiud
AFTER INSERT OR UPDATE OR DELETE ON public.leases
FOR EACH ROW
EXECUTE FUNCTION public.trg_sync_unit_status_from_leases();

-- Note:
-- We intentionally do NOT block manual updates to units.status here,
-- so the UI can still set 'maintenance'. We will adjust the frontend
-- to stop manually setting 'occupied'/'vacant' and only toggle maintenance.
