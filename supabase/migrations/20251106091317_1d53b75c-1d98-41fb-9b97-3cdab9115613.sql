-- Add new columns for Till Number types and Kopo Kopo integration
ALTER TABLE landlord_mpesa_configs 
ADD COLUMN IF NOT EXISTS till_provider TEXT CHECK (till_provider IN ('safaricom', 'kopokopo'));

ALTER TABLE landlord_mpesa_configs 
ADD COLUMN IF NOT EXISTS kopokopo_api_key_encrypted TEXT;

ALTER TABLE landlord_mpesa_configs 
ADD COLUMN IF NOT EXISTS kopokopo_merchant_id TEXT;

-- Update shortcode_type check constraint to include new till types
ALTER TABLE landlord_mpesa_configs 
DROP CONSTRAINT IF EXISTS landlord_mpesa_configs_shortcode_type_check;

ALTER TABLE landlord_mpesa_configs 
ADD CONSTRAINT landlord_mpesa_configs_shortcode_type_check 
CHECK (shortcode_type IN ('paybill', 'till', 'till_safaricom', 'till_kopokopo'));

-- Migrate existing 'till' records to 'till_safaricom' for backward compatibility
UPDATE landlord_mpesa_configs 
SET shortcode_type = 'till_safaricom', till_provider = 'safaricom' 
WHERE shortcode_type = 'till';

-- Add indexes for better query performance
CREATE INDEX IF NOT EXISTS idx_landlord_mpesa_configs_till_provider 
ON landlord_mpesa_configs(till_provider);

-- Add comment for documentation
COMMENT ON COLUMN landlord_mpesa_configs.till_provider IS 'Provider for till numbers: safaricom (direct) or kopokopo (payment gateway)';
COMMENT ON COLUMN landlord_mpesa_configs.kopokopo_api_key_encrypted IS 'Encrypted Kopo Kopo API key for till payment processing';
COMMENT ON COLUMN landlord_mpesa_configs.kopokopo_merchant_id IS 'Kopo Kopo merchant identifier';