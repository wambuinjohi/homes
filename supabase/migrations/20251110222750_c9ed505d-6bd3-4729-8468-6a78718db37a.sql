-- Add credentials_verified field to track successfully tested Kopo Kopo configs
ALTER TABLE public.landlord_mpesa_configs 
ADD COLUMN IF NOT EXISTS credentials_verified BOOLEAN DEFAULT false;

-- Add last_verified_at timestamp to track when credentials were last tested
ALTER TABLE public.landlord_mpesa_configs 
ADD COLUMN IF NOT EXISTS last_verified_at TIMESTAMP WITH TIME ZONE;

-- Create index for quick filtering of verified configs
CREATE INDEX IF NOT EXISTS idx_landlord_mpesa_configs_verified 
ON public.landlord_mpesa_configs(credentials_verified) 
WHERE credentials_verified = true;

COMMENT ON COLUMN public.landlord_mpesa_configs.credentials_verified IS 'Indicates if credentials have been successfully tested';
COMMENT ON COLUMN public.landlord_mpesa_configs.last_verified_at IS 'Timestamp of last successful credential verification';