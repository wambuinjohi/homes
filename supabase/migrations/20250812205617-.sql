-- Upsert trial_settings with cutoff and policy days
DO $$
DECLARE
  v_exists BOOLEAN;
BEGIN
  -- Update existing trial_settings if present
  UPDATE public.billing_settings
  SET 
    setting_value = COALESCE(setting_value, '{}'::jsonb) || jsonb_build_object(
      'cutoff_date_utc', '2025-08-07T09:00:08.306142Z',
      'pre_cutoff_days', 30,
      'post_cutoff_days', 70
    ),
    description = COALESCE(description, 'Trial settings with historical policy cutoff')
  WHERE setting_key = 'trial_settings';

  GET DIAGNOSTICS v_exists = ROW_COUNT > 0;

  -- If no row existed, insert a sensible default including the cutoff
  IF NOT v_exists THEN
    INSERT INTO public.billing_settings (setting_key, setting_value, description)
    VALUES (
      'trial_settings',
      jsonb_build_object(
        'trial_period_days', 70,
        'default_sms_credits', 100,
        'grace_period_days', 7,
        'cutoff_date_utc', '2025-08-07T09:00:08.306142Z',
        'pre_cutoff_days', 30,
        'post_cutoff_days', 70
      ),
      'Trial settings with historical policy cutoff (pre: 30 days, post: 70 days)'
    );
  END IF;
END$$;
