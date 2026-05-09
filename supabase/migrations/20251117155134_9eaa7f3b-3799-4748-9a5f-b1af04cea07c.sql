-- Add constraint to ensure only one active M-Pesa config per landlord
-- This prevents multiple active payment configurations which could cause confusion

CREATE UNIQUE INDEX IF NOT EXISTS idx_one_active_mpesa_config_per_landlord 
ON landlord_mpesa_configs (landlord_id) 
WHERE is_active = true;

COMMENT ON INDEX idx_one_active_mpesa_config_per_landlord IS 
'Ensures only one active M-Pesa configuration per landlord at any time';