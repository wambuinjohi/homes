-- Add M-Pesa configuration preference to landlord_payment_preferences
ALTER TABLE landlord_payment_preferences 
ADD COLUMN IF NOT EXISTS mpesa_config_preference TEXT DEFAULT 'platform_default' CHECK (mpesa_config_preference IN ('custom', 'platform_default'));

COMMENT ON COLUMN landlord_payment_preferences.mpesa_config_preference IS 'Whether to use custom M-Pesa credentials or platform defaults for payments';

-- Update existing rows to use platform_default by default
UPDATE landlord_payment_preferences 
SET mpesa_config_preference = 'platform_default' 
WHERE mpesa_config_preference IS NULL;