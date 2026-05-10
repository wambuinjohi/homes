-- Fresh 70-day trial for all landlords starting today
-- This gives everyone a new trial period regardless of when they signed up

-- Step 1: Create missing subscription records for landlords without them
INSERT INTO landlord_subscriptions (
  landlord_id,
  billing_plan_id,
  status,
  trial_start_date,
  trial_end_date,
  subscription_start_date,
  sms_credits_balance,
  auto_renewal,
  trial_usage_data
)
SELECT 
  p.id,
  (SELECT id FROM billing_plans WHERE is_active = true ORDER BY created_at ASC LIMIT 1),
  'trial',
  NOW(), -- Fresh trial starts today
  NOW() + INTERVAL '70 days', -- 70 days from today
  NOW(),
  200, -- Default SMS credits
  true,
  jsonb_build_object(
    'trial_restored', true,
    'restoration_date', NOW(),
    'restoration_type', 'fresh_trial',
    'original_signup_date', p.created_at
  )
FROM profiles p
INNER JOIN user_roles ur ON ur.user_id = p.id AND ur.role = 'Landlord'
LEFT JOIN landlord_subscriptions ls ON ls.landlord_id = p.id
WHERE ls.id IS NULL;

-- Step 2: Reset trial dates for ALL existing subscriptions
UPDATE landlord_subscriptions
SET 
  trial_start_date = NOW(),
  trial_end_date = NOW() + INTERVAL '70 days',
  status = 'trial',
  subscription_start_date = COALESCE(subscription_start_date, NOW()),
  sms_credits_balance = GREATEST(sms_credits_balance, 200), -- Ensure at least 200 SMS credits
  trial_usage_data = COALESCE(trial_usage_data, '{}'::jsonb) || jsonb_build_object(
    'trial_restored', true,
    'restoration_date', NOW(),
    'restoration_type', 'fresh_trial',
    'previous_trial_start', trial_start_date,
    'previous_trial_end', trial_end_date,
    'previous_status', status
  ),
  updated_at = NOW()
WHERE landlord_id IN (
  SELECT user_id FROM user_roles WHERE role = 'Landlord'
);