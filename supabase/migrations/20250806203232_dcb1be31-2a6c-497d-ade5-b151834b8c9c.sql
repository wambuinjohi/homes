-- Fix search path security for all functions without proper search_path setting
-- This prevents SQL injection attacks through search_path manipulation

-- Fix generate_service_invoice_number function
CREATE OR REPLACE FUNCTION public.generate_service_invoice_number()
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $$
DECLARE
  invoice_number TEXT;
  current_year TEXT;
  counter INTEGER;
BEGIN
  current_year := EXTRACT(YEAR FROM now())::TEXT;
  
  -- Get the next counter for this year
  SELECT COALESCE(MAX(
    CASE 
      WHEN invoice_number ~ ('^SRV-' || current_year || '-\d+$') 
      THEN (regexp_split_to_array(invoice_number, '-'))[3]::INTEGER
      ELSE 0
    END
  ), 0) + 1
  INTO counter
  FROM public.service_charge_invoices
  WHERE invoice_number LIKE 'SRV-' || current_year || '-%';
  
  invoice_number := 'SRV-' || current_year || '-' || LPAD(counter::TEXT, 6, '0');
  
  RETURN invoice_number;
END;
$$;

-- Fix create_user_with_role function
CREATE OR REPLACE FUNCTION public.create_user_with_role(p_email text, p_first_name text, p_last_name text, p_phone text, p_role app_role)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $$
DECLARE
  new_user_id uuid;
  temp_password text;
BEGIN
  -- Generate a temporary password
  temp_password := 'TempPass' || floor(random() * 10000)::text || '!';
  
  -- For now, we'll create a profile entry and user role
  -- In production, this would integrate with Supabase Auth API
  new_user_id := gen_random_uuid();
  
  -- Insert profile
  INSERT INTO public.profiles (id, first_name, last_name, email, phone)
  VALUES (new_user_id, p_first_name, p_last_name, p_email, p_phone);
  
  -- Assign role
  INSERT INTO public.user_roles (user_id, role)
  VALUES (new_user_id, p_role);
  
  -- Return success with user info
  RETURN jsonb_build_object(
    'success', true,
    'user_id', new_user_id,
    'email', p_email,
    'temporary_password', temp_password,
    'message', 'User created successfully. They will need to complete signup with their email.'
  );
  
EXCEPTION WHEN OTHERS THEN
  RETURN jsonb_build_object(
    'success', false,
    'error', SQLERRM
  );
END;
$$;

-- Fix create_default_landlord_subscription function  
CREATE OR REPLACE FUNCTION public.create_default_landlord_subscription()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $$
DECLARE
  trial_plan_id uuid;
  new_landlord_id uuid;
BEGIN
  -- Store the user_id in a local variable to avoid ambiguity
  new_landlord_id := NEW.user_id;
  
  -- Only create subscription for landlord role
  IF NEW.role = 'Landlord'::public.app_role THEN
    -- Get the first active billing plan (trial plan)
    SELECT id INTO trial_plan_id 
    FROM public.billing_plans 
    WHERE is_active = true 
    ORDER BY created_at ASC 
    LIMIT 1;
    
    -- Create subscription if plan exists
    IF trial_plan_id IS NOT NULL THEN
      INSERT INTO public.landlord_subscriptions (
        landlord_id,
        billing_plan_id,
        status,
        trial_start_date,
        trial_end_date,
        sms_credits_balance,
        auto_renewal
      )
      VALUES (
        new_landlord_id,
        trial_plan_id,
        'trial',
        now(),
        now() + interval '30 days',
        100,
        true
      ) ON CONFLICT (landlord_id) DO NOTHING;
    END IF;
  END IF;
  
  RETURN NEW;
END;
$$;

-- Fix handle_new_user function
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $$
BEGIN
  -- Insert into profiles table
  INSERT INTO public.profiles (id, first_name, last_name, phone, email)
  VALUES (
    NEW.id, 
    NEW.raw_user_meta_data ->> 'first_name', 
    NEW.raw_user_meta_data ->> 'last_name',
    NEW.raw_user_meta_data ->> 'phone',
    NEW.email
  );
  
  -- Assign role based on user metadata, default to 'Agent' if not specified
  INSERT INTO public.user_roles (user_id, role)
  VALUES (
    NEW.id, 
    COALESCE(
      (NEW.raw_user_meta_data ->> 'role')::public.app_role,
      'Agent'::public.app_role
    )
  );
  
  RETURN NEW;
END;
$$;

-- Fix log_maintenance_action function
CREATE OR REPLACE FUNCTION public.log_maintenance_action(_maintenance_request_id uuid, _user_id uuid, _action_type text, _old_value text DEFAULT NULL::text, _new_value text DEFAULT NULL::text, _details jsonb DEFAULT NULL::jsonb)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $$
BEGIN
  INSERT INTO public.maintenance_action_logs (
    maintenance_request_id, user_id, action_type, old_value, new_value, details
  ) VALUES (
    _maintenance_request_id, _user_id, _action_type, _old_value, _new_value, _details
  );
END;
$$;