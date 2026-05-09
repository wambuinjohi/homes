-- Add missing columns to tenants table
ALTER TABLE public.tenants 
ADD COLUMN IF NOT EXISTS date_of_birth date,
ADD COLUMN IF NOT EXISTS employer_contact text,
ADD COLUMN IF NOT EXISTS emergency_contact_relationship text,
ADD COLUMN IF NOT EXISTS previous_landlord_name text,
ADD COLUMN IF NOT EXISTS previous_landlord_contact text;

-- Add comments for documentation
COMMENT ON COLUMN public.tenants.date_of_birth IS 'Tenant date of birth';
COMMENT ON COLUMN public.tenants.employer_contact IS 'Tenant employer contact information';
COMMENT ON COLUMN public.tenants.emergency_contact_relationship IS 'Relationship of emergency contact to tenant';
COMMENT ON COLUMN public.tenants.previous_landlord_name IS 'Previous landlord name for reference';
COMMENT ON COLUMN public.tenants.previous_landlord_contact IS 'Previous landlord contact information';