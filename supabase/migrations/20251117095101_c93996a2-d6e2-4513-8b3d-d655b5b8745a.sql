-- Add RLS policy to allow property stakeholders to manage leases
CREATE POLICY "Property stakeholders can manage leases"
ON public.leases
FOR ALL
TO authenticated
USING (
  has_role(auth.uid(), 'Admin'::app_role)
  OR EXISTS (
    SELECT 1
    FROM public.units u
    JOIN public.properties p ON p.id = u.property_id
    WHERE u.id = leases.unit_id
      AND (p.owner_id = auth.uid() OR p.manager_id = auth.uid())
  )
)
WITH CHECK (
  has_role(auth.uid(), 'Admin'::app_role)
  OR EXISTS (
    SELECT 1
    FROM public.units u
    JOIN public.properties p ON p.id = u.property_id
    WHERE u.id = leases.unit_id
      AND (p.owner_id = auth.uid() OR p.manager_id = auth.uid())
  )
);

-- Allow landlords to insert tenants directly
CREATE POLICY "Landlords can insert tenants"
ON public.tenants
FOR INSERT
TO authenticated
WITH CHECK (has_role(auth.uid(), 'Landlord'::app_role) OR has_role(auth.uid(), 'Admin'::app_role));

-- Create RPC function for attaching lease to existing tenant
CREATE OR REPLACE FUNCTION public.attach_lease_and_occupy_unit(
  p_tenant_id uuid,
  p_unit_id uuid,
  p_lease_start_date date,
  p_lease_end_date date,
  p_monthly_rent numeric,
  p_security_deposit numeric DEFAULT NULL,
  p_lease_terms text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_current_user_id uuid;
  v_unit_status text;
  v_owner_id uuid;
  v_manager_id uuid;
  v_lease_id uuid;
BEGIN
  v_current_user_id := auth.uid();
  IF v_current_user_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  -- Get unit status and property ownership
  SELECT u.status, p.owner_id, p.manager_id
  INTO v_unit_status, v_owner_id, v_manager_id
  FROM public.units u
  JOIN public.properties p ON p.id = u.property_id
  WHERE u.id = p_unit_id;

  IF v_unit_status IS NULL THEN
    RAISE EXCEPTION 'Unit not found';
  END IF;

  -- Verify ownership/management
  IF v_owner_id != v_current_user_id AND (v_manager_id IS NULL OR v_manager_id != v_current_user_id) THEN
    RAISE EXCEPTION 'You do not have permission to assign this unit';
  END IF;

  -- Check unit availability
  IF v_unit_status = 'occupied' THEN
    RAISE EXCEPTION 'Unit is already occupied';
  END IF;

  -- Validate dates
  IF p_lease_start_date IS NULL OR p_lease_end_date IS NULL OR p_lease_end_date <= p_lease_start_date THEN
    RAISE EXCEPTION 'Invalid lease dates';
  END IF;

  -- Validate rent
  IF p_monthly_rent IS NULL OR p_monthly_rent <= 0 THEN
    RAISE EXCEPTION 'Monthly rent must be greater than 0';
  END IF;

  -- Insert lease
  INSERT INTO public.leases (
    tenant_id, unit_id, lease_start_date, lease_end_date, monthly_rent,
    security_deposit, lease_terms, status
  ) VALUES (
    p_tenant_id, p_unit_id, p_lease_start_date, p_lease_end_date, p_monthly_rent,
    COALESCE(p_security_deposit, 0), NULLIF(TRIM(p_lease_terms), ''), 'active'
  )
  RETURNING id INTO v_lease_id;

  -- Update unit status
  UPDATE public.units
  SET status = 'occupied', updated_at = now()
  WHERE id = p_unit_id;

  RETURN jsonb_build_object('success', true, 'lease_id', v_lease_id);
EXCEPTION
  WHEN OTHERS THEN
    RETURN jsonb_build_object('success', false, 'error', SQLERRM, 'detail', SQLSTATE);
END;
$$;

GRANT EXECUTE ON FUNCTION public.attach_lease_and_occupy_unit TO authenticated;