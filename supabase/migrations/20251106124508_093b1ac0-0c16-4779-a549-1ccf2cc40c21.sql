-- Backfill payment preferences for landlords without explicit preferences
-- This ensures all existing landlords using platform defaults have a proper database record

INSERT INTO landlord_payment_preferences (
  landlord_id,
  mpesa_config_preference,
  preferred_payment_method,
  auto_payment_enabled,
  payment_reminders_enabled,
  created_at,
  updated_at
)
SELECT DISTINCT
  pr.owner_id as landlord_id,
  'platform_default'::text as mpesa_config_preference,
  'mpesa'::text as preferred_payment_method,
  false as auto_payment_enabled,
  true as payment_reminders_enabled,
  now() as created_at,
  now() as updated_at
FROM properties pr
WHERE pr.owner_id NOT IN (
  SELECT landlord_id 
  FROM landlord_payment_preferences
)
ON CONFLICT (landlord_id) DO NOTHING;