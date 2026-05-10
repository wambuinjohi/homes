-- COMPREHENSIVE SECURITY FIX: Part 5 - Fix All Remaining Functions & Create Encryption Triggers
-- Complete the security hardening by fixing all remaining functions

-- Fix remaining critical functions with proper search_path
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger 
LANGUAGE plpgsql 
SECURITY DEFINER 
SET search_path = public, pg_temp
AS $$
BEGIN
  INSERT INTO public.profiles (id, first_name, last_name, phone, email)
  VALUES (
    NEW.id, 
    NEW.raw_user_meta_data ->> 'first_name', 
    NEW.raw_user_meta_data ->> 'last_name',
    COALESCE(NEW.raw_user_meta_data ->> 'phone', NEW.phone, '+254700000000'),
    NEW.email
  );
  
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

CREATE OR REPLACE FUNCTION public.create_default_landlord_subscription()
RETURNS trigger 
LANGUAGE plpgsql 
SECURITY DEFINER 
SET search_path = public, pg_temp
AS $$
DECLARE
  trial_plan_id uuid;
  trial_days integer := 14;
  sms_default integer := 100;
  grace_days integer := 7;
BEGIN
  IF NEW.role = 'Landlord'::public.app_role THEN
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

    SELECT COALESCE(
      (SELECT (setting_value->>'grace_period_days')::int FROM public.billing_settings WHERE setting_key = 'trial_settings' LIMIT 1),
      (SELECT grace_period_days FROM public.automated_billing_settings LIMIT 1),
      7
    ) INTO grace_days;

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
        landlord_id, billing_plan_id, status, trial_start_date, trial_end_date,
        subscription_start_date, sms_credits_balance, auto_renewal, grace_period_days
      )
      VALUES (
        NEW.user_id, trial_plan_id, 'trial', now(),
        now() + make_interval(days => trial_days), now(),
        sms_default, true, grace_days
      )
      ON CONFLICT (landlord_id) DO NOTHING;
    END IF;
  END IF;

  RETURN NEW;
END;
$$;