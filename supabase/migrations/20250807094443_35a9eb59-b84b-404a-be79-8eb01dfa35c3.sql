-- Fix existing trial periods from 70 days to 30 days
UPDATE landlord_subscriptions 
SET trial_end_date = trial_start_date + INTERVAL '30 days'
WHERE status = 'trial' 
  AND trial_start_date IS NOT NULL 
  AND trial_end_date IS NOT NULL
  AND (trial_end_date - trial_start_date) > INTERVAL '35 days';

-- Ensure all property stakeholders have subscriptions with Free Trial plan
INSERT INTO landlord_subscriptions (
  landlord_id,
  billing_plan_id,
  status,
  trial_start_date,
  trial_end_date,
  created_at,
  updated_at
)
SELECT 
  ur.user_id,
  bp.id as billing_plan_id,
  'trial' as status,
  NOW() as trial_start_date,
  NOW() + INTERVAL '30 days' as trial_end_date,
  NOW() as created_at,
  NOW() as updated_at
FROM user_roles ur
CROSS JOIN billing_plans bp
WHERE ur.role IN ('Landlord', 'Manager', 'Agent')
  AND bp.name = 'Free Trial'
  AND NOT EXISTS (
    SELECT 1 FROM landlord_subscriptions ls 
    WHERE ls.landlord_id = ur.user_id
  );

-- Add trial period setting to billing_settings
INSERT INTO billing_settings (setting_key, setting_value, description, created_at, updated_at)
VALUES (
  'default_trial_period_days',
  '30',
  'Default trial period in days for new subscriptions',
  NOW(),
  NOW()
) ON CONFLICT (setting_key) DO UPDATE SET
  setting_value = EXCLUDED.setting_value,
  updated_at = NOW();