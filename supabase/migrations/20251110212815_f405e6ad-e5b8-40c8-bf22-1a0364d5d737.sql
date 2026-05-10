-- Make standard M-Pesa credential fields nullable to support multiple credential types
ALTER TABLE landlord_mpesa_configs
  ALTER COLUMN consumer_key_encrypted DROP NOT NULL,
  ALTER COLUMN consumer_secret_encrypted DROP NOT NULL,
  ALTER COLUMN passkey_encrypted DROP NOT NULL;

-- Add check constraints to ensure proper credentials based on shortcode_type
ALTER TABLE landlord_mpesa_configs
  DROP CONSTRAINT IF EXISTS check_mpesa_credentials_by_type;

ALTER TABLE landlord_mpesa_configs
  ADD CONSTRAINT check_mpesa_credentials_by_type CHECK (
    CASE 
      WHEN shortcode_type = 'till_kopokopo' THEN
        -- Kopo Kopo requires till_number, client_id, and client_secret
        till_number IS NOT NULL 
        AND kopokopo_client_id IS NOT NULL 
        AND kopokopo_client_secret_encrypted IS NOT NULL
      ELSE
        -- Paybill and Till Safaricom require standard M-Pesa credentials
        consumer_key_encrypted IS NOT NULL 
        AND consumer_secret_encrypted IS NOT NULL 
        AND passkey_encrypted IS NOT NULL
    END
  );