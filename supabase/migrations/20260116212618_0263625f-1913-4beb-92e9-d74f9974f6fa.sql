-- Update create_default_landlord_subscription function to handle account_type from user metadata
CREATE OR REPLACE FUNCTION public.create_default_landlord_subscription()
RETURNS TRIGGER AS $$
DECLARE
  v_plan_id uuid;
  v_trial_days integer := 30;
  v_user_created_at timestamptz;
  v_account_type text;
  v_plan_category text;
  trial_settings jsonb;
BEGIN
  -- Only create subscription for landlord role rows
  IF NEW.role != 'Landlord'::public.app_role THEN
    RETURN NEW;
  END IF;

  -- Get account_type from user metadata (defaults to 'landlord')
  SELECT COALESCE(raw_user_meta_data ->> 'account_type', 'landlord')
  INTO v_account_type
  FROM auth.users
  WHERE id = NEW.user_id;

  -- Map account_type to plan_category for finding appropriate default plan
  v_plan_category := CASE 
    WHEN v_account_type = 'agency' THEN 'agency'
    ELSE 'landlord'
  END;

  -- Try to get user's auth creation time (not critical if null)
  SELECT created_at INTO v_user_created_at FROM auth.users WHERE id = NEW.user_id;

  -- Optional settings source (do not fail if missing)
  SELECT setting_value INTO trial_settings
  FROM public.billing_settings
  WHERE setting_key = 'trial_settings';

  -- Extract trial days if present in trial_settings or fallback
  v_trial_days := COALESCE(
    NULLIF((trial_settings ->> 'trial_period_days')::integer, 0),
    30
  );

  -- Pick an active plan matching the account type, prefer cheapest by price
  SELECT id INTO v_plan_id
  FROM public.billing_plans
  WHERE is_active IS TRUE
    AND (plan_category = v_plan_category OR plan_category IS NULL)
  ORDER BY 
    CASE WHEN plan_category = v_plan_category THEN 0 ELSE 1 END,
    price ASC NULLS FIRST, 
    created_at ASC
  LIMIT 1;

  -- Create subscription if a plan exists and one doesn't already exist for landlord
  IF v_plan_id IS NOT NULL THEN
    INSERT INTO public.landlord_subscriptions (
      landlord_id,
      billing_plan_id,
      status,
      trial_start_date,
      trial_end_date,
      sms_credits_balance,
      auto_renewal,
      account_type,
      created_at,
      updated_at
    ) VALUES (
      NEW.user_id,
      v_plan_id,
      'trial',
      now(),
      now() + (v_trial_days || ' days')::interval,
      100,
      true,
      v_account_type,
      now(),
      now()
    )
    ON CONFLICT (landlord_id) DO NOTHING;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;