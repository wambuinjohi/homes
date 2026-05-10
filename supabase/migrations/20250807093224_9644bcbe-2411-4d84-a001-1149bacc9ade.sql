-- Unified Subscription Management Implementation

-- 1. First, get the Free Trial billing plan ID
DO $$
DECLARE
  free_trial_plan_id uuid;
BEGIN
  -- Get or create Free Trial plan
  SELECT id INTO free_trial_plan_id 
  FROM public.billing_plans 
  WHERE name = 'Free Trial' 
  LIMIT 1;
  
  -- If no Free Trial plan exists, create one
  IF free_trial_plan_id IS NULL THEN
    INSERT INTO public.billing_plans (
      name, 
      description, 
      price, 
      billing_cycle, 
      billing_model,
      max_properties,
      max_units,
      sms_credits_included,
      features,
      is_active,
      currency
    ) VALUES (
      'Free Trial',
      'Free trial with limited features for new property stakeholders',
      0,
      'trial',
      'percentage',
      2,
      10,
      100,
      '["Property Management", "Tenant Management", "Basic Reporting", "SMS Notifications"]'::jsonb,
      true,
      'KES'
    ) RETURNING id INTO free_trial_plan_id;
  END IF;
  
  -- 2. Update trigger function to assign actual Free Trial billing plan
  -- Drop existing trigger first
  DROP TRIGGER IF EXISTS trigger_create_default_landlord_subscription ON public.user_roles;
  
  -- Update the function to use actual billing plan
  CREATE OR REPLACE FUNCTION public.create_default_landlord_subscription()
  RETURNS trigger
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path TO ''
  AS $function$
  DECLARE
    trial_plan_id uuid;
    new_user_id uuid;
    trial_period_days integer := 30;
    sms_credits_amount integer := 100;
  BEGIN
    -- Store the user_id in a local variable
    new_user_id := NEW.user_id;
    
    -- Only create subscription for property-related roles
    IF NEW.role IN ('Landlord', 'Manager', 'Agent') THEN
      
      -- Get trial settings from billing_settings table
      SELECT 
        COALESCE((setting_value->>'trial_period_days')::integer, 30),
        COALESCE((setting_value->>'default_sms_credits')::integer, 100)
      INTO trial_period_days, sms_credits_amount
      FROM public.billing_settings 
      WHERE setting_key = 'trial_settings'
      LIMIT 1;
      
      -- Get the Free Trial billing plan
      SELECT id INTO trial_plan_id 
      FROM public.billing_plans 
      WHERE name = 'Free Trial' AND is_active = true
      LIMIT 1;
      
      -- Create subscription with actual billing plan
      IF trial_plan_id IS NOT NULL THEN
        INSERT INTO public.landlord_subscriptions (
          landlord_id,
          billing_plan_id,
          status,
          trial_start_date,
          trial_end_date,
          sms_credits_balance,
          auto_renewal,
          trial_limitations
        )
        VALUES (
          new_user_id,
          trial_plan_id,
          'trial',
          now(),
          now() + (trial_period_days || ' days')::interval,
          sms_credits_amount,
          true,
          jsonb_build_object(
            'properties', 2,
            'units_per_property', 10,
            'tenants', 20,
            'maintenance_requests', 50,
            'invoices', 100
          )
        ) ON CONFLICT (landlord_id) DO NOTHING;
      END IF;
    END IF;
    
    RETURN NEW;
  END;
  $function$;
  
  -- Recreate the trigger
  CREATE TRIGGER trigger_create_default_landlord_subscription
    AFTER INSERT ON public.user_roles
    FOR EACH ROW
    EXECUTE FUNCTION public.create_default_landlord_subscription();
  
  -- 3. Fix existing property stakeholders without proper subscriptions
  -- Create subscriptions for all property-related users who don't have them
  INSERT INTO public.landlord_subscriptions (
    landlord_id,
    billing_plan_id,
    status,
    trial_start_date,
    trial_end_date,
    sms_credits_balance,
    auto_renewal,
    trial_limitations
  )
  SELECT 
    ur.user_id,
    free_trial_plan_id,
    'trial',
    now(),
    now() + interval '30 days',
    100,
    true,
    jsonb_build_object(
      'properties', 2,
      'units_per_property', 10,
      'tenants', 20,
      'maintenance_requests', 50,
      'invoices', 100
    )
  FROM public.user_roles ur
  WHERE ur.role IN ('Landlord', 'Manager', 'Agent')
    AND NOT EXISTS (
      SELECT 1 FROM public.landlord_subscriptions ls 
      WHERE ls.landlord_id = ur.user_id
    );
  
  -- 4. Update existing subscriptions that don't have a billing plan
  UPDATE public.landlord_subscriptions 
  SET 
    billing_plan_id = free_trial_plan_id,
    updated_at = now()
  WHERE billing_plan_id IS NULL;
  
  -- 5. Ensure trial settings exist in billing_settings
  INSERT INTO public.billing_settings (setting_key, setting_value, description)
  VALUES (
    'trial_settings',
    jsonb_build_object(
      'trial_period_days', 30,
      'default_sms_credits', 100,
      'grace_period_days', 7
    ),
    'Trial subscription configuration settings'
  ) ON CONFLICT (setting_key) DO NOTHING;
  
  RAISE NOTICE 'Unified subscription management implementation completed successfully';
  
END $$;