-- Create RPC function for tenant and optional lease creation
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
  v_landlord_id uuid;
  v_auth_user_id uuid;
  v_temp_password text;
  v_formatted_phone text;
BEGIN
  -- Get current user's ID (landlord)
  v_landlord_id := auth.uid();
  
  IF v_landlord_id IS NULL THEN
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
  IF EXISTS (SELECT 1 FROM public.tenants WHERE email = p_email AND landlord_id = v_landlord_id) THEN
    RAISE EXCEPTION 'A tenant with this email already exists';
  END IF;

  -- Check for duplicate phone if provided
  IF v_formatted_phone IS NOT NULL AND EXISTS (
    SELECT 1 FROM public.tenants 
    WHERE phone = v_formatted_phone AND landlord_id = v_landlord_id
  ) THEN
    RAISE EXCEPTION 'A tenant with this phone number already exists';
  END IF;

  -- Validate lease data if unit is provided
  IF p_unit_id IS NOT NULL THEN
    IF p_lease_start_date IS NULL OR p_lease_end_date IS NULL OR p_monthly_rent IS NULL THEN
      RAISE EXCEPTION 'Lease start date, end date, and monthly rent are required when assigning a unit';
    END IF;

    -- Check if unit exists and belongs to landlord's property
    IF NOT EXISTS (
      SELECT 1 FROM public.units u
      JOIN public.properties p ON u.property_id = p.id
      WHERE u.id = p_unit_id AND p.owner_id = v_landlord_id
    ) THEN
      RAISE EXCEPTION 'Invalid unit or property access';
    END IF;

    -- Check if unit is already occupied
    IF EXISTS (
      SELECT 1 FROM public.leases
      WHERE unit_id = p_unit_id AND status = 'Active'
    ) THEN
      RAISE EXCEPTION 'Unit is already occupied';
    END IF;
  END IF;

  -- Create tenant record
  INSERT INTO public.tenants (
    landlord_id,
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
    v_landlord_id,
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

  -- Create auth user for tenant if email is provided
  BEGIN
    -- Generate temporary password
    v_temp_password := encode(gen_random_bytes(12), 'base64');
    
    -- Create auth user (this will trigger handle_new_user which creates profile and role)
    INSERT INTO auth.users (
      instance_id,
      id,
      aud,
      role,
      email,
      encrypted_password,
      email_confirmed_at,
      raw_app_meta_data,
      raw_user_meta_data,
      created_at,
      updated_at,
      confirmation_token,
      recovery_token,
      email_change_token_new,
      email_change
    ) VALUES (
      '00000000-0000-0000-0000-000000000000',
      v_tenant_id,
      'authenticated',
      'authenticated',
      LOWER(TRIM(p_email)),
      crypt(v_temp_password, gen_salt('bf')),
      now(),
      jsonb_build_object('provider', 'email', 'providers', ARRAY['email']),
      jsonb_build_object(
        'first_name', TRIM(p_first_name),
        'last_name', TRIM(p_last_name),
        'phone', v_formatted_phone,
        'role', 'Tenant'
      ),
      now(),
      now(),
      '',
      '',
      '',
      ''
    )
    ON CONFLICT (id) DO NOTHING;
    
    v_auth_user_id := v_tenant_id;
    RAISE NOTICE 'Created auth user for tenant: %', p_email;
  EXCEPTION WHEN OTHERS THEN
    RAISE WARNING 'Failed to create auth user for tenant: %', SQLERRM;
    -- Continue even if auth user creation fails - tenant record is created
  END;

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

    RAISE NOTICE 'Created lease with ID: %', v_lease_id;
  END IF;

  -- Return success with tenant and lease IDs
  RETURN jsonb_build_object(
    'success', true,
    'tenant_id', v_tenant_id,
    'lease_id', v_lease_id,
    'auth_user_created', v_auth_user_id IS NOT NULL
  );

EXCEPTION WHEN OTHERS THEN
  -- Log error and re-raise
  RAISE EXCEPTION 'Failed to create tenant: %', SQLERRM;
END;
$$;

COMMENT ON FUNCTION public.create_tenant_and_optional_lease IS 'Creates a tenant record and optionally a lease in a single transaction. Also creates auth user account. Requires authenticated landlord.';