-- Phase 2: Add encrypted credential columns to landlord_mpesa_configs
-- This allows storing encrypted credentials alongside plain text for migration period

-- Step 1: Add encrypted credential columns (nullable during migration)
ALTER TABLE landlord_mpesa_configs 
  ADD COLUMN IF NOT EXISTS consumer_key_encrypted TEXT,
  ADD COLUMN IF NOT EXISTS consumer_secret_encrypted TEXT,
  ADD COLUMN IF NOT EXISTS passkey_encrypted TEXT;

-- Step 2: Add shortcode type column if it doesn't exist
ALTER TABLE landlord_mpesa_configs
  ADD COLUMN IF NOT EXISTS shortcode_type TEXT DEFAULT 'paybill' CHECK (shortcode_type IN ('paybill', 'till'));

-- Step 3: Add indexes for performance
CREATE INDEX IF NOT EXISTS idx_landlord_mpesa_configs_landlord_id ON landlord_mpesa_configs(landlord_id);
CREATE INDEX IF NOT EXISTS idx_landlord_mpesa_configs_active ON landlord_mpesa_configs(landlord_id, is_active) WHERE is_active = true;

-- Step 4: Add security audit comment
COMMENT ON COLUMN landlord_mpesa_configs.consumer_key_encrypted IS 'AES-256-GCM encrypted M-Pesa consumer key';
COMMENT ON COLUMN landlord_mpesa_configs.consumer_secret_encrypted IS 'AES-256-GCM encrypted M-Pesa consumer secret';
COMMENT ON COLUMN landlord_mpesa_configs.passkey_encrypted IS 'AES-256-GCM encrypted M-Pesa passkey';

-- Step 5: Log the migration
DO $$ 
BEGIN
  RAISE NOTICE 'Phase 2 Security Migration: Added encrypted credential columns';
  RAISE NOTICE 'Landlords can now save encrypted credentials via secure form';
  RAISE NOTICE 'Plain text columns will be removed in Phase 3 after data migration';
END $$;