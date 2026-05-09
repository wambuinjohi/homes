-- Fix create_tenant_and_optional_lease to work without auth.users creation
-- This removes the problematic auth user creation logic that was causing silent failures

CREATE OR REPLACE FUNCTION public.create_tenant_and_optional_lease(
  p_first_name text,
  p_last_name text,
  p_email text,
  p_phone text,
  p_national_id text DEFAULT NULL,
  p_date_of_birth date DEFAULT NULL,
  p_employment_status text DEFAULT NULL,
  p_employer_name text DEFAULT NULL,
  p_employer_contact text DEFAULT NULL,
  p_emergency_contact_name text DEFAULT NULL,
  p_emergency_contact_phone text DEFAULT NULL,
  p_emergency_contact_relationship text DEFAULT NULL,
  p_previous_address text DEFAULT NULL,
  p_previous_landlord_name text DEFAULT NULL,
  p_previous_landlord_contact text DEFAULT NULL,
  p_unit_id uuid DEFAULT NULL,
  p_lease_start_date date DEFAULT NULL,
  p_lease_end_date date DEFAULT NULL,
  p_monthly_rent numeric DEFAULT NULL,
  p_security_deposit numeric DEFAULT NULL,
  p_lease_terms text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_tenant_id uuid;
  v_lease_id uuid;
  v_current_user_id uuid;
  v_property_id uuid;
  v_unit_status text;
  v_owner_id uuid;
  v_manager_id uuid;
BEGIN
  -- Get current authenticated user
  v_current_user_id := auth.uid();
  IF v_current_user_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  -- Validate required fields
  IF TRIM(p_first_name) = '' OR p_first_name IS NULL THEN
    RAISE EXCEPTION 'First name is required';
  END IF;
  
  IF TRIM(p_last_name) = '' OR p_last_name IS NULL THEN
    RAISE EXCEPTION 'Last name is required';
  END IF;
  
  IF TRIM(p_email) = '' OR p_email IS NULL THEN
    RAISE EXCEPTION 'Email is required';
  END IF;

  -- Validate email format
  IF p_email !~ '^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$' THEN
    RAISE EXCEPTION 'Invalid email format';
  END IF;

  -- Validate phone format (E.164 if provided)
  IF p_phone IS NOT NULL AND TRIM(p_phone) != '' THEN
    IF p_phone !~ '^\+[1-9]\d{1,14}$' THEN
      RAISE EXCEPTION 'Phone must be in E.164 format (e.g., +254712345678)';
    END IF;
  END IF;

  -- If unit is provided, validate lease details and unit ownership
  IF p_unit_id IS NOT NULL THEN
    -- Check if unit exists and get its details
    SELECT u.property_id, u.status, p.owner_id, p.manager_id
    INTO v_property_id, v_unit_status, v_owner_id, v_manager_id
    FROM public.units u
    JOIN public.properties p ON u.property_id = p.id
    WHERE u.id = p_unit_id;

    IF v_property_id IS NULL THEN
      RAISE EXCEPTION 'Unit not found';
    END IF;

    -- Verify the unit belongs to the current landlord
    IF v_owner_id != v_current_user_id AND (v_manager_id IS NULL OR v_manager_id != v_current_user_id) THEN
      RAISE EXCEPTION 'You do not have permission to assign this unit';
    END IF;

    -- Check if unit is available
    IF v_unit_status = 'occupied' THEN
      RAISE EXCEPTION 'Unit is already occupied';
    END IF;

    -- Validate lease details
    IF p_lease_start_date IS NULL THEN
      RAISE EXCEPTION 'Lease start date is required when assigning a unit';
    END IF;

    IF p_lease_end_date IS NULL THEN
      RAISE EXCEPTION 'Lease end date is required when assigning a unit';
    END IF;

    IF p_monthly_rent IS NULL OR p_monthly_rent <= 0 THEN
      RAISE EXCEPTION 'Monthly rent must be greater than 0';
    END IF;

    IF p_lease_end_date <= p_lease_start_date THEN
      RAISE EXCEPTION 'Lease end date must be after start date';
    END IF;
  END IF;

  -- Create tenant record (user_id is NULL - no auth user yet)
  INSERT INTO public.tenants (
    user_id,
    first_name,
    last_name,
    email,
    phone,
    national_id,
    date_of_birth,
    employment_status,
    employer_name,
    employer_contact,
    emergency_contact_name,
    emergency_contact_phone,
    emergency_contact_relationship,
    previous_address,
    previous_landlord_name,
    previous_landlord_contact
  ) VALUES (
    NULL,  -- No auth user initially
    TRIM(p_first_name),
    TRIM(p_last_name),
    LOWER(TRIM(p_email)),
    NULLIF(TRIM(p_phone), ''),
    NULLIF(TRIM(p_national_id), ''),
    p_date_of_birth,
    NULLIF(TRIM(p_employment_status), ''),
    NULLIF(TRIM(p_employer_name), ''),
    NULLIF(TRIM(p_employer_contact), ''),
    NULLIF(TRIM(p_emergency_contact_name), ''),
    NULLIF(TRIM(p_emergency_contact_phone), ''),
    NULLIF(TRIM(p_emergency_contact_relationship), ''),
    NULLIF(TRIM(p_previous_address), ''),
    NULLIF(TRIM(p_previous_landlord_name), ''),
    NULLIF(TRIM(p_previous_landlord_contact), '')
  )
  RETURNING id INTO v_tenant_id;

  -- If unit is provided, create the lease
  IF p_unit_id IS NOT NULL THEN
    INSERT INTO public.leases (
      tenant_id,
      unit_id,
      lease_start_date,
      lease_end_date,
      monthly_rent,
      security_deposit,
      lease_terms,
      status
    ) VALUES (
      v_tenant_id,
      p_unit_id,
      p_lease_start_date,
      p_lease_end_date,
      p_monthly_rent,
      COALESCE(p_security_deposit, 0),
      NULLIF(TRIM(p_lease_terms), ''),
      'active'
    )
    RETURNING id INTO v_lease_id;

    -- Update unit status to occupied
    UPDATE public.units
    SET status = 'occupied',
        updated_at = now()
    WHERE id = p_unit_id;
  END IF;

  -- Return success with IDs
  RETURN jsonb_build_object(
    'success', true,
    'tenant_id', v_tenant_id,
    'lease_id', v_lease_id,
    'message', 'Tenant created successfully'
  );

EXCEPTION
  WHEN OTHERS THEN
    -- Return error details
    RETURN jsonb_build_object(
      'success', false,
      'error', SQLERRM,
      'detail', SQLSTATE
    );
END;
$$;