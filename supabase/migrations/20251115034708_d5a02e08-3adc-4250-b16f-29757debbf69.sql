-- Replace create_default_landlord_subscription with schema-correct version
CREATE OR REPLACE FUNCTION public.create_default_landlord_subscription()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_plan_id uuid;
  v_trial_days integer := 30; -- safe default
  v_user_created_at timestamptz;
  trial_settings jsonb;
BEGIN
  -- Only create subscription for landlord role rows
  IF NEW.role != 'Landlord'::public.app_role THEN
    RETURN NEW;
  END IF;

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

  -- Pick an active plan, prefer cheapest by current schema column `price`
  SELECT id INTO v_plan_id
  FROM public.billing_plans
  WHERE is_active IS TRUE
  ORDER BY price ASC NULLS FIRST, created_at ASC
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
      created_at,
      updated_at
    ) VALUES (
      NEW.user_id,
      v_plan_id,
      'trial',
      now(),
      now() + (v_trial_days || ' days')::interval,
      100,              -- default SMS credits
      true,             -- default auto-renewal
      now(),
      now()
    )
    ON CONFLICT (landlord_id) DO NOTHING;
  END IF;

  RETURN NEW;
END;
$$;

-- Ensure trigger remains attached to user_roles
DROP TRIGGER IF EXISTS auto_create_landlord_subscription ON public.user_roles;
CREATE TRIGGER auto_create_landlord_subscription
  AFTER INSERT ON public.user_roles
  FOR EACH ROW
  EXECUTE FUNCTION public.create_default_landlord_subscription();