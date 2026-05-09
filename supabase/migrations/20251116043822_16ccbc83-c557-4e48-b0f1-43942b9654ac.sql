
-- Fix create_tenant_and_optional_lease to match actual tenants table schema
CREATE OR REPLACE FUNCTION public.create_tenant_and_optional_lease(
  p_first_name text,
  p_last_name text,
  p_email text,
  p_phone text DEFAULT NULL,
  p_national_id text DEFAULT NULL,
  p_employment_status text DEFAULT NULL,
  p_profession text DEFAULT NULL,
  p_employer_name text DEFAULT NULL,
  p_monthly_income numeric DEFAULT NULL,
  p_emergency_contact_name text DEFAULT NULL,
  p_emergency_contact_phone text DEFAULT NULL,
  p_previous_address text DEFAULT NULL,
  p_property_id uuid DEFAULT NULL,
  p_unit_id uuid DEFAULT NULL,
  p_lease_start_date date DEFAULT NULL,
  p_lease_end_date date DEFAULT NULL,
  p_monthly_rent numeric DEFAULT NULL,
  p_security_deposit numeric DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_tenant_id uuid;
  v_lease_id uuid;
  v_current_user_id uuid;
  v_auth_user_id uuid;
  v_temp_password text;
  v_formatted_phone text;
  v_signup_data jsonb;
BEGIN
  -- Get current user's ID
  v_current_user_id := auth.uid();
  
  IF v_current_user_id IS NULL THEN
    RAISE EXCEPTION 'User must be authenticated';
  END IF;

  -- Validate phone format if provided
  IF p_phone IS NOT NULL AND p_phone != '' THEN
    v_formatted_phone := p_phone;
    IF v_formatted_phone !~ '^\+[1-9][0-9]{7,14}$' THEN
      RAISE EXCEPTION 'Invalid phone number format. Please use international format (e.g., +254712345678)';
    END IF;
  ELSE
    v_formatted_phone := NULL;
  END IF;

  -- Validate required fields
  IF p_first_name IS NULL OR TRIM(p_first_name) = '' THEN
    RAISE EXCEPTION 'First name is required';
  END IF;

  IF p_last_name IS NULL OR TRIM(p_last_name) = '' THEN
    RAISE EXCEPTION 'Last name is required';
  END IF;

  IF p_email IS NULL OR TRIM(p_email) = '' THEN
    RAISE EXCEPTION 'Email is required';
  END IF;

  -- Check for duplicate email in tenants table
  IF EXISTS (SELECT 1 FROM public.tenants WHERE LOWER(email) = LOWER(TRIM(p_email))) THEN
    RAISE EXCEPTION 'A tenant with this email already exists';
  END IF;

  -- Check for duplicate phone if provided
  IF v_formatted_phone IS NOT NULL AND EXISTS (
    SELECT 1 FROM public.tenants WHERE phone = v_formatted_phone
  ) THEN
    RAISE EXCEPTION 'A tenant with this phone number already exists';
  END IF;

  -- Validate lease data if unit is provided
  IF p_unit_id IS NOT NULL THEN
    IF p_lease_start_date IS NULL OR p_lease_end_date IS NULL OR p_monthly_rent IS NULL THEN
      RAISE EXCEPTION 'Lease start date, end date, and monthly rent are required when assigning a unit';
    END IF;

    -- Check if unit exists and user has access to it
    IF NOT EXISTS (
      SELECT 1 FROM public.units u
      JOIN public.properties p ON u.property_id = p.id
      WHERE u.id = p_unit_id 
      AND (p.owner_id = v_current_user_id OR p.manager_id = v_current_user_id)
    ) THEN
      RAISE EXCEPTION 'Invalid unit or you do not have access to this property';
    END IF;

    -- Check if unit is already occupied
    IF EXISTS (
      SELECT 1 FROM public.leases
      WHERE unit_id = p_unit_id AND status = 'Active'
    ) THEN
      RAISE EXCEPTION 'Unit is already occupied';
    END IF;
  END IF;

  -- Create auth user for tenant first (this will trigger handle_new_user)
  BEGIN
    -- Generate temporary password
    v_temp_password := encode(gen_random_bytes(12), 'base64');
    
    -- Create auth user with metadata
    v_signup_data := jsonb_build_object(
      'email', LOWER(TRIM(p_email)),
      'password', v_temp_password,
      'email_confirm', true,
      'user_metadata', jsonb_build_object(
        'first_name', TRIM(p_first_name),
        'last_name', TRIM(p_last_name),
        'role', 'Tenant'
      )
    );

    -- Use admin API to create user
    SELECT id INTO v_auth_user_id
    FROM auth.users
    WHERE email = LOWER(TRIM(p_email));

    IF v_auth_user_id IS NULL THEN
      -- Insert into auth.users (simplified - in production use Supabase Admin API)
      INSERT INTO auth.users (
        instance_id,
        id,
        aud,
        role,
        email,
        encrypted_password,
        email_confirmed_at,
        raw_user_meta_data,
        created_at,
        updated_at,
        confirmation_token,
        email_change,
        email_change_token_new,
        recovery_token
      ) VALUES (
        '00000000-0000-0000-0000-000000000000',
        gen_random_uuid(),
        'authenticated',
        'authenticated',
        LOWER(TRIM(p_email)),
        crypt(v_temp_password, gen_salt('bf')),
        NOW(),
        jsonb_build_object('first_name', TRIM(p_first_name), 'last_name', TRIM(p_last_name)),
        NOW(),
        NOW(),
        '',
        '',
        '',
        ''
      )
      RETURNING id INTO v_auth_user_id;
    END IF;

    RAISE NOTICE 'Created auth user with ID: %', v_auth_user_id;

  EXCEPTION WHEN OTHERS THEN
    -- Check if user already exists
    SELECT id INTO v_auth_user_id
    FROM auth.users
    WHERE email = LOWER(TRIM(p_email));
    
    IF v_auth_user_id IS NULL THEN
      RAISE EXCEPTION 'Failed to create auth user: %', SQLERRM;
    END IF;
    
    RAISE NOTICE 'Auth user already exists with ID: %', v_auth_user_id;
  END;

  -- Create tenant record with user_id linking to auth user
  INSERT INTO public.tenants (
    user_id,
    first_name,
    last_name,
    email,
    phone,
    national_id,
    employment_status,
    profession,
    employer_name,
    monthly_income,
    emergency_contact_name,
    emergency_contact_phone,
    previous_address,
    property_id
  ) VALUES (
    v_auth_user_id,
    TRIM(p_first_name),
    TRIM(p_last_name),
    LOWER(TRIM(p_email)),
    v_formatted_phone,
    p_national_id,
    p_employment_status,
    p_profession,
    p_employer_name,
    p_monthly_income,
    p_emergency_contact_name,
    p_emergency_contact_phone,
    p_previous_address,
    p_property_id
  )
  RETURNING id INTO v_tenant_id;

  RAISE NOTICE 'Created tenant with ID: %', v_tenant_id;

  -- Create lease if unit is provided
  IF p_unit_id IS NOT NULL THEN
    INSERT INTO public.leases (
      tenant_id,
      unit_id,
      lease_start_date,
      lease_end_date,
      monthly_rent,
      security_deposit,
      status
    ) VALUES (
      v_tenant_id,
      p_unit_id,
      p_lease_start_date,
      p_lease_end_date,
      p_monthly_rent,
      COALESCE(p_security_deposit, 0),
      'Active'
    )
    RETURNING id INTO v_lease_id;

    -- Update unit status to occupied
    UPDATE public.units
    SET status = 'Occupied'
    WHERE id = p_unit_id;

    RAISE NOTICE 'Created lease with ID: %', v_lease_id;
  END IF;

  -- Return success response
  RETURN jsonb_build_object(
    'success', true,
    'tenant_id', v_tenant_id,
    'lease_id', v_lease_id,
    'auth_user_id', v_auth_user_id,
    'message', 'Tenant created successfully'
  );

EXCEPTION WHEN OTHERS THEN
  -- Return error response
  RAISE EXCEPTION 'Error creating tenant: %', SQLERRM;
END;
$$;

-- Grant execute permission to authenticated users
GRANT EXECUTE ON FUNCTION public.create_tenant_and_optional_lease TO authenticated;
