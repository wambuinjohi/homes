-- 1) Add per-subscription grace period column
ALTER TABLE public.landlord_subscriptions
ADD COLUMN IF NOT EXISTS grace_period_days integer NOT NULL DEFAULT 7;

-- 2) Update create_default_landlord_subscription() to set grace_period_days from settings
CREATE OR REPLACE FUNCTION public.create_default_landlord_subscription()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
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

-- 3) Update get_trial_status() to respect per-subscription grace_period_days
CREATE OR REPLACE FUNCTION public.get_trial_status(_user_id uuid)
RETURNS text
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path TO ''
AS $function$
DECLARE
  subscription_record RECORD;
  v_grace_days integer := 7;
BEGIN
  -- Get subscription info
  SELECT * INTO subscription_record
  FROM public.landlord_subscriptions
  WHERE landlord_id = _user_id;
  
  -- If no subscription, return null
  IF subscription_record IS NULL THEN
    RETURN NULL;
  END IF;
  
  -- Return current status if not trial-related
  IF subscription_record.status NOT IN ('trial', 'trial_expired', 'suspended') THEN
    RETURN subscription_record.status;
  END IF;
  
  -- Determine grace period per subscription
  v_grace_days := COALESCE(subscription_record.grace_period_days, 7);
  
  -- Check trial status based on dates
  IF subscription_record.trial_end_date IS NULL THEN
    RETURN 'trial';
  END IF;
  
  -- Active trial
  IF now() <= subscription_record.trial_end_date THEN
    RETURN 'trial';
  END IF;
  
  -- Grace period
  IF now() <= (subscription_record.trial_end_date + make_interval(days => v_grace_days)) THEN
    RETURN 'trial_expired';
  END IF;
  
  -- Suspended after grace period
  RETURN 'suspended';
END;
$function$;

-- 4) Backfill helper to safely revert trial lengths around a cutoff
-- Parameters:
--  _cutoff: timestamp splitting old/new cohorts
--  _pre_cutoff_days: trial days to enforce for accounts created before cutoff
--  _post_cutoff_days: trial days to enforce for accounts created at/after cutoff
--  _include_active: whether to include 'active' subs (default false)
--  _dry_run: if true, only report what would change
CREATE OR REPLACE FUNCTION public.backfill_trial_periods(
  _cutoff timestamptz,
  _pre_cutoff_days integer,
  _post_cutoff_days integer,
  _include_active boolean DEFAULT false,
  _dry_run boolean DEFAULT true
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $function$
DECLARE
  updated_count int := 0;
  examined_count int := 0;
  to_update_count int := 0;
BEGIN
  -- Count examined rows
  SELECT COUNT(*) INTO examined_count
  FROM public.landlord_subscriptions ls
  WHERE ls.trial_start_date IS NOT NULL
    AND ls.trial_end_date IS NOT NULL
    AND (ls.status IN ('trial','trial_expired','suspended') OR (_include_active AND ls.status = 'active'));

  -- Rows that would be updated
  WITH candidates AS (
    SELECT 
      ls.id,
      ls.trial_start_date,
      ls.trial_end_date,
      ls.created_at,
      (EXTRACT(epoch FROM (ls.trial_end_date - ls.trial_start_date)) / 86400)::int AS current_days,
      CASE WHEN ls.created_at < _cutoff THEN _pre_cutoff_days ELSE _post_cutoff_days END AS desired_days
    FROM public.landlord_subscriptions ls
    WHERE ls.trial_start_date IS NOT NULL
      AND ls.trial_end_date IS NOT NULL
      AND (ls.status IN ('trial','trial_expired','suspended') OR (_include_active AND ls.status = 'active'))
  ),
  diffs AS (
    SELECT id, trial_start_date, created_at, current_days, desired_days
    FROM candidates
    WHERE current_days IN (_pre_cutoff_days, _post_cutoff_days)
      AND current_days <> desired_days
  )
  SELECT COUNT(*) INTO to_update_count FROM diffs;

  IF _dry_run THEN
    RETURN jsonb_build_object(
      'dry_run', true,
      'examined', examined_count,
      'would_update', to_update_count,
      'cutoff', _cutoff,
      'pre_cutoff_days', _pre_cutoff_days,
      'post_cutoff_days', _post_cutoff_days
    );
  END IF;

  -- Perform updates
  WITH diffs AS (
    SELECT 
      ls.id,
      ls.trial_start_date,
      CASE WHEN ls.created_at < _cutoff THEN _pre_cutoff_days ELSE _post_cutoff_days END AS desired_days
    FROM public.landlord_subscriptions ls
    WHERE ls.trial_start_date IS NOT NULL
      AND ls.trial_end_date IS NOT NULL
      AND (ls.status IN ('trial','trial_expired','suspended') OR (_include_active AND ls.status = 'active'))
      AND ((EXTRACT(epoch FROM (ls.trial_end_date - ls.trial_start_date)) / 86400)::int) IN (_pre_cutoff_days, _post_cutoff_days)
      AND ((EXTRACT(epoch FROM (ls.trial_end_date - ls.trial_start_date)) / 86400)::int) <> CASE WHEN ls.created_at < _cutoff THEN _pre_cutoff_days ELSE _post_cutoff_days END
  )
  UPDATE public.landlord_subscriptions ls
  SET trial_end_date = diffs.trial_start_date + make_interval(days => diffs.desired_days),
      updated_at = now()
  FROM diffs
  WHERE ls.id = diffs.id;

  GET DIAGNOSTICS updated_count = ROW_COUNT;

  RETURN jsonb_build_object(
    'dry_run', false,
    'examined', examined_count,
    'updated', updated_count,
    'cutoff', _cutoff,
    'pre_cutoff_days', _pre_cutoff_days,
    'post_cutoff_days', _post_cutoff_days
  );
END;
$function$;