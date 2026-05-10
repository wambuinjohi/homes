-- Phase 3.1: Update Database Schema for Kopo Kopo OAuth credentials
-- Add new columns for OAuth-based authentication

ALTER TABLE public.landlord_mpesa_configs 
  ADD COLUMN IF NOT EXISTS kopokopo_client_id TEXT,
  ADD COLUMN IF NOT EXISTS kopokopo_client_secret_encrypted TEXT;

-- Add comment explaining the schema
COMMENT ON COLUMN public.landlord_mpesa_configs.kopokopo_client_id IS 'Kopo Kopo OAuth Client ID (public identifier)';
COMMENT ON COLUMN public.landlord_mpesa_configs.kopokopo_client_secret_encrypted IS 'Encrypted Kopo Kopo OAuth Client Secret';

-- Note: Keeping old kopokopo_api_key_encrypted and kopokopo_merchant_id columns for backward compatibility
-- They can be deprecated in a future migration after all users have migrated