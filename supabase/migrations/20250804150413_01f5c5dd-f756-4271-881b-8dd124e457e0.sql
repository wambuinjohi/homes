-- First, let's create a default billing plan if none exists
INSERT INTO public.billing_plans (name, description, price, billing_cycle, features, is_active)
VALUES (
  'Trial Plan', 
  'Free trial plan for new landlords', 
  0, 
  'monthly', 
  '["Basic property management", "Up to 5 properties", "Email support"]'::jsonb, 
  true
) ON CONFLICT DO NOTHING;

-- Get the trial plan ID for the subscription and create subscription for existing landlord
DO $$
DECLARE
  trial_plan_id uuid;
  target_landlord_id uuid := 'a53f69a5-104e-489b-9b0a-48a56d6b011d';
BEGIN
  -- Get the trial plan ID
  SELECT id INTO trial_plan_id FROM public.billing_plans WHERE name = 'Trial Plan' LIMIT 1;
  
  -- Create subscription for existing landlord if not exists
  INSERT INTO public.landlord_subscriptions (
    landlord_id,
    billing_plan_id,
    status,
    trial_start_date,
    trial_end_date,
    sms_credits_balance,
    auto_renewal
  )
  VALUES (
    target_landlord_id,
    trial_plan_id,
    'trial',
    now(),
    now() + interval '30 days',
    100,
    true
  ) ON CONFLICT (landlord_id) DO NOTHING;
END $$;

-- Create default billing settings if none exist
INSERT INTO public.billing_settings (setting_key, setting_value, description)
VALUES 
  ('default_currency', '"USD"'::jsonb, 'Default currency for billing'),
  ('trial_period_days', '30'::jsonb, 'Default trial period in days'),
  ('default_sms_credits', '100'::jsonb, 'Default SMS credits for new subscriptions')
ON CONFLICT (setting_key) DO UPDATE SET
  setting_value = EXCLUDED.setting_value,
  updated_at = now();

-- Create function to auto-create subscriptions for new landlords
CREATE OR REPLACE FUNCTION public.create_default_landlord_subscription()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  trial_plan_id uuid;
  new_landlord_id uuid;
BEGIN
  -- Store the user_id in a local variable to avoid ambiguity
  new_landlord_id := NEW.user_id;
  
  -- Only create subscription for landlord role
  IF NEW.role = 'Landlord'::public.app_role THEN
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
        auto_renewal
      )
      VALUES (
        new_landlord_id,
        trial_plan_id,
        'trial',
        now(),
        now() + interval '30 days',
        100,
        true
      ) ON CONFLICT (landlord_id) DO NOTHING;
    END IF;
  END IF;
  
  RETURN NEW;
END;
$$;

-- Create trigger to auto-create subscriptions when user roles are assigned
DROP TRIGGER IF EXISTS auto_create_landlord_subscription ON public.user_roles;
CREATE TRIGGER auto_create_landlord_subscription
  AFTER INSERT ON public.user_roles
  FOR EACH ROW
  EXECUTE FUNCTION public.create_default_landlord_subscription();