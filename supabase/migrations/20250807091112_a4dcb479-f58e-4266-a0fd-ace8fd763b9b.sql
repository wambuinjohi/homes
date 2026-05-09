-- Update the create_default_landlord_subscription function to:
-- 1. Read trial period from billing_settings instead of hardcoded 30 days
-- 2. Expand role coverage to include Landlord, Manager, Agent roles
-- 3. Make SMS credits dynamic from settings

CREATE OR REPLACE FUNCTION public.create_default_landlord_subscription()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  trial_plan_id uuid;
  new_user_id uuid;
  trial_period_days integer := 30; -- Default fallback
  sms_credits_amount integer := 100; -- Default fallback
BEGIN
  -- Store the user_id in a local variable to avoid ambiguity
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
    
    -- Get the first active billing plan (trial plan)
    SELECT id INTO trial_plan_id 
    FROM public.billing_plans 
    WHERE is_active = true 
    ORDER BY created_at ASC 
    LIMIT 1;
    
    -- Create subscription if plan exists
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
$$;

-- Fix Simon Gichuki's trial period to 70 days instead of 30
-- First, find Simon's user ID and update his trial period
UPDATE public.landlord_subscriptions 
SET 
  trial_end_date = trial_start_date + interval '70 days',
  updated_at = now()
WHERE landlord_id IN (
  SELECT p.id 
  FROM public.profiles p 
  WHERE p.email = 'gichukisimon@gmail.com'
) AND status = 'trial';

-- Ensure billing settings exist for trial configuration
INSERT INTO public.billing_settings (setting_key, setting_value, description)
VALUES (
  'trial_settings',
  jsonb_build_object(
    'trial_period_days', 70,
    'grace_period_days', 7,
    'default_sms_credits', 100,
    'trial_limitations', jsonb_build_object(
      'properties', 2,
      'units_per_property', 10,
      'tenants', 20,
      'maintenance_requests', 50,
      'invoices', 100
    )
  ),
  'Trial subscription configuration settings'
) ON CONFLICT (setting_key) DO UPDATE SET
  setting_value = EXCLUDED.setting_value,
  updated_at = now();