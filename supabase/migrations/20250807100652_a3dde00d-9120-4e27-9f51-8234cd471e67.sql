-- Consolidate Free Trial plans and fix trial settings
-- Keep the newer Free Trial plan and deactivate the older one
UPDATE billing_plans 
SET is_active = false 
WHERE id = '3a717c3b-6443-4b4a-a8d2-06c4788b3023';

-- Update the active Free Trial plan to have consistent settings
UPDATE billing_plans 
SET 
  max_units = 50,
  sms_credits_included = 200,
  description = 'Free trial plan for new landlords with enhanced limits'
WHERE id = '045aa292-c722-4791-8f4d-5b9f760a4200';

-- Remove the old trial_period_days setting to eliminate confusion
DELETE FROM billing_settings 
WHERE setting_key = 'trial_period_days';

-- Update trial_settings to be the single source of truth
UPDATE billing_settings 
SET setting_value = jsonb_build_object(
  'trial_period_days', 30,
  'grace_period_days', 7,
  'payment_reminder_days', ARRAY[3, 1],
  'auto_invoice_generation', true,
  'default_sms_credits', 200,
  'sms_cost_per_unit', 0.05
)
WHERE setting_key = 'trial_settings';