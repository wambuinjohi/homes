
BEGIN;

-- 1) Ensure the "Free Trial" plan exists and is active
UPDATE public.billing_plans
SET name = 'Free Trial', price = 0, is_active = true
WHERE name = 'Trial Plan';

INSERT INTO public.billing_plans (name, description, price, billing_cycle, max_properties, max_units, sms_credits_included, features, is_active)
SELECT 'Free Trial', 'Free trial plan for new landlords', 0, 'monthly', 5, 25, 100, '["Basic property management","Email support"]'::jsonb, true
WHERE NOT EXISTS (SELECT 1 FROM public.billing_plans WHERE name = 'Free Trial');

-- 2) Create or replace the auto-provision function to prefer "Free Trial" and use settings
CREATE OR REPLACE FUNCTION public.create_default_landlord_subscription()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  trial_plan_id uuid;
  trial_days integer := 14;
  sms_default integer := 100;
BEGIN
  IF NEW.role = 'Landlord'::public.app_role THEN
    -- Read trial days from settings: prefer trial_settings, else trial_period_days, else 14
    SELECT COALESCE(
      (SELECT (setting_value->>'trial_period_days')::int FROM public.billing_settings WHERE setting_key = 'trial_settings' LIMIT 1),
      (SELECT (setting_value)::int FROM public.billing_settings WHERE setting_key = 'trial_period_days' LIMIT 1),
      14
    ) INTO trial_days;

    -- Read default SMS credits: prefer trial_settings, else default_sms_credits, else 100
    SELECT COALESCE(
      (SELECT (setting_value->>'default_sms_credits')::int FROM public.billing_settings WHERE setting_key = 'trial_settings' LIMIT 1),
      (SELECT (setting_value)::int FROM public.billing_settings WHERE setting_key = 'default_sms_credits' LIMIT 1),
      100
    ) INTO sms_default;

    -- Prefer "Free Trial" plan; fallback to any active plan by lowest price
    SELECT id INTO trial_plan_id
    FROM public.billing_plans
    WHERE name = 'Free Trial' AND is_active = true
    LIMIT 1;

    IF trial_plan_id IS NULL THEN
      SELECT id INTO trial_plan_id
      FROM public.billing_plans
      WHERE is_active = true
      ORDER BY price ASC, created_at ASC
      LIMIT 1;
    END IF;

    IF trial_plan_id IS NOT NULL THEN
      INSERT INTO public.landlord_subscriptions (
        landlord_id,
        billing_plan_id,
        status,
        trial_start_date,
        trial_end_date,
        subscription_start_date,
        sms_credits_balance,
        auto_renewal
      )
      VALUES (
        NEW.user_id,
        trial_plan_id,
        'trial',
        now(),
        now() + make_interval(days => trial_days),
        now(),
        sms_default,
        true
      )
      ON CONFLICT (landlord_id) DO NOTHING;
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

-- 3) Ensure the trigger exists on user_roles insert
DROP TRIGGER IF EXISTS auto_create_landlord_subscription ON public.user_roles;
CREATE TRIGGER auto_create_landlord_subscription
  AFTER INSERT ON public.user_roles
  FOR EACH ROW
  EXECUTE FUNCTION public.create_default_landlord_subscription();

-- 4) Backfill: create Free Trial subscriptions for Landlords missing a record
DO $$
DECLARE
  trial_plan_id uuid;
  trial_days integer := 14;
  sms_default integer := 100;
BEGIN
  SELECT COALESCE(
    (SELECT (setting_value->>'trial_period_days')::int FROM public.billing_settings WHERE setting_key = 'trial_settings' LIMIT 1),
    (SELECT (setting_value)::int FROM public.billing_settings WHERE setting_key = 'trial_period_days' LIMIT 1),
    14
  ) INTO trial_days;

  SELECT COALESCE(
    (SELECT (setting_value->>'default_sms_credits')::int FROM public.billing_settings WHERE setting_key = 'trial_settings' LIMIT 1),
    (SELECT (setting_value)::int FROM public.billing_settings WHERE setting_key = 'default_sms_credits' LIMIT 1),
    100
  ) INTO sms_default;

  SELECT id INTO trial_plan_id
  FROM public.billing_plans
  WHERE name = 'Free Trial' AND is_active = true
  LIMIT 1;

  IF trial_plan_id IS NULL THEN
    SELECT id INTO trial_plan_id
    FROM public.billing_plans
    WHERE is_active = true
    ORDER BY price ASC, created_at ASC
    LIMIT 1;
  END IF;

  IF trial_plan_id IS NOT NULL THEN
    INSERT INTO public.landlord_subscriptions (
      landlord_id,
      billing_plan_id,
      status,
      trial_start_date,
      trial_end_date,
      subscription_start_date,
      sms_credits_balance,
      auto_renewal
    )
    SELECT
      ur.user_id,
      trial_plan_id,
      'trial',
      now(),
      now() + make_interval(days => trial_days),
      now(),
      sms_default,
      true
    FROM public.user_roles ur
    LEFT JOIN public.landlord_subscriptions ls ON ls.landlord_id = ur.user_id
    WHERE ur.role = 'Landlord'::public.app_role
      AND ls.id IS NULL;
  END IF;
END $$;

COMMIT;
