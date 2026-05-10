-- Step 1: Migrate Mazao Plus from inactive "Free Trial " to active "Free Trial" plan
-- First, get the IDs of both Free Trial plans
UPDATE landlord_subscriptions 
SET billing_plan_id = (
  SELECT id FROM billing_plans 
  WHERE name = 'Free Trial' AND is_active = true
  LIMIT 1
)
WHERE billing_plan_id = (
  SELECT id FROM billing_plans 
  WHERE name = 'Free Trial ' AND is_active = false
  LIMIT 1
);

-- Step 2: Fix Simon Gichuki's status back to trial
UPDATE landlord_subscriptions 
SET status = 'trial'
WHERE landlord_id = (
  SELECT id FROM profiles 
  WHERE first_name = 'Simon' AND last_name = 'Gichuki'
  LIMIT 1
)
AND billing_plan_id = (
  SELECT id FROM billing_plans 
  WHERE name = 'Free Trial' AND is_active = true
  LIMIT 1
);

-- Step 3: Delete the old inactive "Free Trial " plan (with trailing space)
DELETE FROM billing_plans 
WHERE name = 'Free Trial ' AND is_active = false;