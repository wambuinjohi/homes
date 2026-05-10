-- Helper RPC to lookup tenant in landlord's portfolio
CREATE OR REPLACE FUNCTION public.lookup_tenant_in_portfolio(
  p_email text DEFAULT NULL,
  p_phone text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_current_user_id uuid;
  v_tenant_record record;
  v_unit_count int;
BEGIN
  v_current_user_id := auth.uid();
  
  IF v_current_user_id IS NULL THEN
    RETURN NULL;
  END IF;

  -- Find tenant in current landlord's portfolio by email or phone
  SELECT DISTINCT t.*
  INTO v_tenant_record
  FROM public.tenants t
  JOIN public.leases l ON l.tenant_id = t.id
  JOIN public.units u ON l.unit_id = u.id
  JOIN public.properties p ON u.property_id = p.id
  WHERE (p.owner_id = v_current_user_id OR p.manager_id = v_current_user_id)
    AND (
      (p_email IS NOT NULL AND LOWER(t.email) = LOWER(TRIM(p_email)))
      OR (p_phone IS NOT NULL AND t.phone = p_phone)
    )
  LIMIT 1;

  IF v_tenant_record IS NULL THEN
    RETURN NULL;
  END IF;

  -- Count current active units
  SELECT COUNT(DISTINCT l.unit_id)::int
  INTO v_unit_count
  FROM public.leases l
  JOIN public.units u ON l.unit_id = u.id
  JOIN public.properties p ON u.property_id = p.id
  WHERE l.tenant_id = v_tenant_record.id
    AND l.status = 'active'
    AND (p.owner_id = v_current_user_id OR p.manager_id = v_current_user_id);

  -- Return tenant info
  RETURN jsonb_build_object(
    'id', v_tenant_record.id,
    'first_name', v_tenant_record.first_name,
    'last_name', v_tenant_record.last_name,
    'email', v_tenant_record.email,
    'phone', v_tenant_record.phone,
    'current_units', v_unit_count
  );
END;
$$;

-- New RPC for creating or attaching tenant lease
CREATE OR REPLACE FUNCTION public.create_or_attach_tenant_lease(
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
  p_security_deposit numeric DEFAULT NULL,
  p_existing_tenant_id uuid DEFAULT NULL,
  p_allow_attach boolean DEFAULT true
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
  v_tenant_created boolean := false;
  v_lease_created boolean := false;
BEGIN
  v_current_user_id := auth.uid();
  
  IF v_current_user_id IS NULL THEN
    RAISE EXCEPTION 'User must be authenticated';
  END IF;

  -- Format phone number
  IF p_phone IS NOT NULL AND p_phone != '' THEN
    v_formatted_phone := p_phone;
    IF v_formatted_phone !~ '^\+[1-9][0-9]{7,14}$' THEN
      RAISE EXCEPTION 'Invalid phone number format. Please use international format (e.g., +254712345678)';
    END IF;
  ELSE
    v_formatted_phone := NULL;
  END IF;

  -- Handle existing tenant attachment
  IF p_existing_tenant_id IS NOT NULL AND p_allow_attach THEN
    -- Verify tenant exists and belongs to landlord's portfolio
    IF NOT EXISTS (
      SELECT 1
      FROM public.tenants t
      JOIN public.leases l ON l.tenant_id = t.id
      JOIN public.units u ON l.unit_id = u.id
      JOIN public.properties p ON u.property_id = p.id
      WHERE t.id = p_existing_tenant_id
        AND (p.owner_id = v_current_user_id OR p.manager_id = v_current_user_id)
    ) THEN
      RAISE EXCEPTION 'Tenant not found in your portfolio';
    END IF;
    
    v_tenant_id := p_existing_tenant_id;
    v_tenant_created := false;
  ELSE
    -- Validate required fields for new tenant
    IF p_first_name IS NULL OR TRIM(p_first_name) = '' THEN
      RAISE EXCEPTION 'First name is required';
    END IF;

    IF p_last_name IS NULL OR TRIM(p_last_name) = '' THEN
      RAISE EXCEPTION 'Last name is required';
    END IF;

    IF p_email IS NULL OR TRIM(p_email) = '' THEN
      RAISE EXCEPTION 'Email is required';
    END IF;

    -- Check for duplicate in current landlord's portfolio (scoped check)
    SELECT t.id INTO v_tenant_id
    FROM public.tenants t
    JOIN public.leases l ON l.tenant_id = t.id
    JOIN public.units u ON l.unit_id = u.id
    JOIN public.properties p ON u.property_id = p.id
    WHERE (p.owner_id = v_current_user_id OR p.manager_id = v_current_user_id)
      AND (
        LOWER(t.email) = LOWER(TRIM(p_email))
        OR (v_formatted_phone IS NOT NULL AND t.phone = v_formatted_phone)
      )
    LIMIT 1;

    IF v_tenant_id IS NOT NULL THEN
      RAISE EXCEPTION 'A tenant with this email/phone already exists in your portfolio';
    END IF;

    -- Create auth user
    BEGIN
      v_temp_password := encode(gen_random_bytes(12), 'base64');
      
      SELECT id INTO v_auth_user_id
      FROM auth.users
      WHERE email = LOWER(TRIM(p_email));

      IF v_auth_user_id IS NULL THEN
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
    EXCEPTION WHEN OTHERS THEN
      SELECT id INTO v_auth_user_id
      FROM auth.users
      WHERE email = LOWER(TRIM(p_email));
      
      IF v_auth_user_id IS NULL THEN
        RAISE EXCEPTION 'Failed to create auth user: %', SQLERRM;
      END IF;
    END;

    -- Create tenant record
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
    
    v_tenant_created := true;
  END IF;

  -- Create lease if unit is provided
  IF p_unit_id IS NOT NULL THEN
    IF p_lease_start_date IS NULL OR p_lease_end_date IS NULL OR p_monthly_rent IS NULL THEN
      RAISE EXCEPTION 'Lease start date, end date, and monthly rent are required when assigning a unit';
    END IF;

    -- Verify unit belongs to landlord's property
    IF NOT EXISTS (
      SELECT 1 FROM public.units u
      JOIN public.properties p ON u.property_id = p.id
      WHERE u.id = p_unit_id 
        AND (p.owner_id = v_current_user_id OR p.manager_id = v_current_user_id)
    ) THEN
      RAISE EXCEPTION 'Invalid unit or you do not have access to this property';
    END IF;

    -- Check if unit is already occupied (case-insensitive)
    IF EXISTS (
      SELECT 1 FROM public.leases
      WHERE unit_id = p_unit_id AND LOWER(status) = 'active'
    ) THEN
      RAISE EXCEPTION 'Unit is already occupied';
    END IF;

    -- Create lease
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
      'active'
    )
    RETURNING id INTO v_lease_id;

    -- Update unit status to occupied
    UPDATE public.units
    SET status = 'occupied'
    WHERE id = p_unit_id;
    
    v_lease_created := true;
  END IF;

  -- Return success response
  RETURN jsonb_build_object(
    'success', true,
    'tenant_id', v_tenant_id,
    'lease_id', v_lease_id,
    'tenant_created', v_tenant_created,
    'lease_created', v_lease_created,
    'message', CASE 
      WHEN v_tenant_created THEN 'Tenant and lease created successfully'
      WHEN v_lease_created THEN 'Lease added to existing tenant successfully'
      ELSE 'Tenant created successfully'
    END
  );

EXCEPTION WHEN OTHERS THEN
  RAISE EXCEPTION 'Error: %', SQLERRM;
END;
$$;