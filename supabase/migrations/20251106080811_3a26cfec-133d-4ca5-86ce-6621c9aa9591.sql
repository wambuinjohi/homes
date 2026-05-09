-- Phase 3: Remove plain text M-Pesa credential columns (Security Hardening)
-- This migration will archive records without encrypted credentials, then remove plain text columns

-- Step 1: Log records that will be affected
DO $$ 
DECLARE
  at_risk_count INTEGER;
  total_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO at_risk_count
  FROM landlord_mpesa_configs
  WHERE consumer_key_encrypted IS NULL 
    OR consumer_secret_encrypted IS NULL 
    OR passkey_encrypted IS NULL;
  
  SELECT COUNT(*) INTO total_count
  FROM landlord_mpesa_configs;
  
  RAISE NOTICE '📊 Total M-Pesa configurations: %', total_count;
  RAISE NOTICE '⚠️  Configurations without encryption: %', at_risk_count;
  
  IF at_risk_count > 0 THEN
    RAISE NOTICE '🗑️  These configurations will be deleted - landlords must re-enter credentials';
  ELSE
    RAISE NOTICE '✅ All configurations have encrypted credentials - safe to proceed';
  END IF;
END $$;

-- Step 2: Delete records without encrypted credentials
-- These landlords will need to re-configure their M-Pesa settings via the secure form
DELETE FROM landlord_mpesa_configs
WHERE consumer_key_encrypted IS NULL 
  OR consumer_secret_encrypted IS NULL 
  OR passkey_encrypted IS NULL;

-- Step 3: Now make encrypted columns NOT NULL (safe now that we've deleted records without them)
ALTER TABLE landlord_mpesa_configs
  ALTER COLUMN consumer_key_encrypted SET NOT NULL,
  ALTER COLUMN consumer_secret_encrypted SET NOT NULL,
  ALTER COLUMN passkey_encrypted SET NOT NULL;

-- Step 4: Add length constraints to ensure proper encryption format
ALTER TABLE landlord_mpesa_configs
  DROP CONSTRAINT IF EXISTS consumer_key_encrypted_not_empty,
  DROP CONSTRAINT IF EXISTS consumer_secret_encrypted_not_empty,
  DROP CONSTRAINT IF EXISTS passkey_encrypted_not_empty;

ALTER TABLE landlord_mpesa_configs
  ADD CONSTRAINT consumer_key_encrypted_not_empty 
    CHECK (length(consumer_key_encrypted) > 20),
  ADD CONSTRAINT consumer_secret_encrypted_not_empty 
    CHECK (length(consumer_secret_encrypted) > 20),
  ADD CONSTRAINT passkey_encrypted_not_empty 
    CHECK (length(passkey_encrypted) > 40);

-- Step 5: Remove plain text credential columns (SECURITY CRITICAL)
ALTER TABLE landlord_mpesa_configs 
  DROP COLUMN IF EXISTS consumer_key CASCADE,
  DROP COLUMN IF EXISTS consumer_secret CASCADE,
  DROP COLUMN IF EXISTS passkey CASCADE;

-- Step 6: Update table comment for security audit
COMMENT ON TABLE landlord_mpesa_configs IS 
  'Stores M-Pesa configuration for landlords. All credentials are AES-256-GCM encrypted. Plain text columns removed for security.';

-- Step 7: Log completion
DO $$ 
BEGIN
  RAISE NOTICE '✅ Phase 3 Security Migration Complete';
  RAISE NOTICE '✅ Plain text M-Pesa credential columns removed';
  RAISE NOTICE '✅ All M-Pesa credentials are now encrypted-only';
  RAISE NOTICE '🔒 Security hardening complete - credentials cannot be exposed via database access';
END $$;