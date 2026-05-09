-- Remove restrictive UNIQUE constraint that prevents multiple configs per landlord
ALTER TABLE public.landlord_mpesa_configs 
  DROP CONSTRAINT IF EXISTS landlord_mpesa_configs_landlord_unique;

-- Add partial UNIQUE index to allow multiple configs but only ONE active at a time
-- This allows landlords to have Paybill, Kopo Kopo, AND Till Safaricom configs
-- but only one can be active (is_active = true)
CREATE UNIQUE INDEX IF NOT EXISTS landlord_mpesa_configs_active_unique_idx
  ON public.landlord_mpesa_configs (landlord_id)
  WHERE is_active = true;

-- Add helpful comment
COMMENT ON INDEX landlord_mpesa_configs_active_unique_idx IS 
  'Ensures each landlord can have only ONE active M-Pesa config at a time, but allows multiple inactive configs for different payment types';