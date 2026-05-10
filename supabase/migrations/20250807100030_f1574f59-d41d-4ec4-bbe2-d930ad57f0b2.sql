-- Update billing_settings to harmonize trial configuration
UPDATE billing_settings 
SET setting_value = jsonb_build_object(
  'trial_period_days', 30,
  'grace_period_days', 7,
  'default_sms_credits', 100,
  'auto_invoice_generation', true,
  'payment_reminder_days', '[3, 1]',
  'sms_cost_per_unit', 0.05
)
WHERE setting_key = 'trial_settings';

-- Insert trial_settings if it doesn't exist
INSERT INTO billing_settings (setting_key, setting_value, description)
SELECT 
  'trial_settings',
  jsonb_build_object(
    'trial_period_days', 30,
    'grace_period_days', 7,
    'default_sms_credits', 100,
    'auto_invoice_generation', true,
    'payment_reminder_days', '[3, 1]',
    'sms_cost_per_unit', 0.05
  ),
  'Default trial configuration settings'
WHERE NOT EXISTS (
  SELECT 1 FROM billing_settings WHERE setting_key = 'trial_settings'
);

-- Update the create_default_landlord_subscription function to support custom trial configs
CREATE OR REPLACE FUNCTION public.create_default_landlord_subscription()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $function$
  DECLARE
    trial_plan_id uuid;
    new_user_id uuid;
    trial_period_days integer := 30;
    grace_period_days integer := 7;
    sms_credits_amount integer := 100;
    custom_config jsonb;
  BEGIN
    -- Store the user_id in a local variable
    new_user_id := NEW.user_id;
    
    -- Only create subscription for property-related roles
    IF NEW.role IN ('Landlord', 'Manager', 'Agent') THEN
      
      -- Check for custom trial configuration in user metadata
      custom_config := NEW.metadata::jsonb;
      
      -- Get trial settings from billing_settings table
      SELECT 
        COALESCE((setting_value->>'trial_period_days')::integer, 30),
        COALESCE((setting_value->>'grace_period_days')::integer, 7),
        COALESCE((setting_value->>'default_sms_credits')::integer, 100)
      INTO trial_period_days, grace_period_days, sms_credits_amount
      FROM public.billing_settings 
      WHERE setting_key = 'trial_settings'
      LIMIT 1;
      
      -- Apply custom trial configuration if provided
      IF custom_config IS NOT NULL AND custom_config ? 'trial_days' THEN
        trial_period_days := (custom_config->>'trial_days')::integer;
      END IF;
      
      IF custom_config IS NOT NULL AND custom_config ? 'grace_days' THEN
        grace_period_days := (custom_config->>'grace_days')::integer;
      END IF;
      
      -- Get the Free Trial billing plan
      SELECT id INTO trial_plan_id 
      FROM public.billing_plans 
      WHERE name = 'Free Trial' AND is_active = true
      LIMIT 1;
      
      -- Create subscription with actual billing plan
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
            'invoices', 100,
            'grace_period_days', grace_period_days
          )
        ) ON CONFLICT (landlord_id) DO NOTHING;
      END IF;
    END IF;
    
    RETURN NEW;
  END;
$function$;