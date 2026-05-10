-- Fix null trial_period_days in billing_settings
UPDATE billing_settings
SET setting_value = jsonb_set(
  COALESCE(setting_value, '{}'::jsonb),
  '{trial_period_days}',
  '70'::jsonb
)
WHERE setting_key = 'trial_settings';

-- Update the trigger to use a better fallback (30 days instead of 14)
CREATE OR REPLACE FUNCTION create_default_landlord_subscription()
RETURNS TRIGGER
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  default_plan_id UUID;
  trial_days INTEGER;
  grace_days INTEGER;
  trial_settings JSONB;
  cutoff_date TIMESTAMPTZ;
  pre_cutoff_days INTEGER;
  post_cutoff_days INTEGER;
BEGIN
  -- Fetch trial settings from billing_settings
  SELECT setting_value INTO trial_settings
  FROM billing_settings
  WHERE setting_key = 'trial_settings';

  -- Extract values with proper fallbacks
  trial_days := COALESCE((trial_settings->>'trial_period_days')::INTEGER, 70);
  grace_days := COALESCE((trial_settings->>'grace_period_days')::INTEGER, 7);
  cutoff_date := (trial_settings->>'cutoff_date_utc')::TIMESTAMPTZ;
  pre_cutoff_days := (trial_settings->>'pre_cutoff_days')::INTEGER;
  post_cutoff_days := (trial_settings->>'post_cutoff_days')::INTEGER;

  -- Apply cutoff logic if configured
  IF cutoff_date IS NOT NULL AND pre_cutoff_days IS NOT NULL AND post_cutoff_days IS NOT NULL THEN
    IF NEW.created_at < cutoff_date THEN
      trial_days := pre_cutoff_days;
    ELSE
      trial_days := post_cutoff_days;
    END IF;
  END IF;

  -- Find the default/free trial plan
  SELECT id INTO default_plan_id
  FROM billing_plans
  WHERE name ILIKE '%free%' OR name ILIKE '%trial%'
  ORDER BY monthly_price ASC NULLS FIRST
  LIMIT 1;

  -- Create the subscription
  INSERT INTO landlord_subscriptions (
    landlord_id,
    plan_id,
    status,
    trial_start_date,
    trial_end_date,
    sms_credits_remaining,
    created_at,
    updated_at
  ) VALUES (
    NEW.user_id,
    default_plan_id,
    'trial',
    NOW(),
    NOW() + (trial_days || ' days')::INTERVAL,
    COALESCE((trial_settings->>'default_sms_credits')::INTEGER, 200),
    NOW(),
    NOW()
  );

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;