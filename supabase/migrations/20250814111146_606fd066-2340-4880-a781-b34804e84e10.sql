-- Fix the remaining function that needs proper search_path
CREATE OR REPLACE FUNCTION public.create_default_landlord_subscription()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $function$
DECLARE
  trial_plan_id uuid;
  trial_days integer := 14;
  sms_default integer := 100;
  grace_days integer := 7;
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

    -- Read grace period days: prefer trial_settings, else automated_billing_settings, else 7
    SELECT COALESCE(
      (SELECT (setting_value->>'grace_period_days')::int FROM public.billing_settings WHERE setting_key = 'trial_settings' LIMIT 1),
      (SELECT grace_period_days FROM public.automated_billing_settings LIMIT 1),
      7
    ) INTO grace_days;

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
        auto_renewal,
        grace_period_days
      )
      VALUES (
        NEW.user_id,
        trial_plan_id,
        'trial',
        now(),
        now() + make_interval(days => trial_days),
        now(),
        sms_default,
        true,
        grace_days
      )
      ON CONFLICT (landlord_id) DO NOTHING;
    END IF;
  END IF;

  RETURN NEW;
END;
$function$;

-- Also fix generate_service_invoice_number to add proper security
CREATE OR REPLACE FUNCTION public.generate_service_invoice_number()
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $function$
BEGIN
    RETURN public.generate_invoice_number();
END;
$function$;