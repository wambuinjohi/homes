-- 1) Ensure "Free Trial" billing plan exists and is active with price 0
-- Create it if missing
INSERT INTO public.billing_plans (
  id, name, price, billing_cycle, description, billing_model, features, sms_credits_included, currency, is_active
)
SELECT
  gen_random_uuid(), 'Free Trial', 0, 'monthly', 'Free 14-day trial plan', 'percentage', '["Core features during trial"]'::jsonb, 100, 'USD', true
WHERE NOT EXISTS (
  SELECT 1 FROM public.billing_plans WHERE name = 'Free Trial'
);

-- Ensure existing "Free Trial" (if any) is active and free
UPDATE public.billing_plans
SET is_active = true,
    price = 0
WHERE name = 'Free Trial';

-- 2) Create trigger to auto-provision default landlord subscription on role assignment
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger WHERE tgname = 'trigger_create_default_landlord_subscription'
  ) THEN
    EXECUTE $$
      CREATE TRIGGER trigger_create_default_landlord_subscription
      AFTER INSERT ON public.user_roles
      FOR EACH ROW
      WHEN (NEW.role = 'Landlord'::public.app_role)
      EXECUTE FUNCTION public.create_default_landlord_subscription();
    $$;
  END IF;
END$$;

-- 3) Backfill: Create trial subscriptions for existing Landlords without a subscription
DO $$
DECLARE
  trial_days integer := 14;
  sms_default integer := 100;
  trial_plan_id uuid;
BEGIN
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
  ORDER BY created_at ASC
  LIMIT 1;

  IF trial_plan_id IS NULL THEN
    SELECT id INTO trial_plan_id
    FROM public.billing_plans
    WHERE is_active = true
    ORDER BY price ASC, created_at ASC
    LIMIT 1;
  END IF;

  -- Insert trial subscriptions for Landlords missing one
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
    AND ls.landlord_id IS NULL;
END$$;