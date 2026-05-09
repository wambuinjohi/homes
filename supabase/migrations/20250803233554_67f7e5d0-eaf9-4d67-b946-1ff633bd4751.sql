-- Update Zira Technologies role from Admin to Partner (or remove entirely)
-- Since user wants them removed as co-admin, let's change to a Partner role

-- First, let's add Partner as a role option
ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'Partner';

-- Update Zira Technologies from Admin to Partner
UPDATE public.user_roles 
SET role = 'Partner'
WHERE user_id = '0b178150-5f82-435a-a515-718ec79da646' AND role = 'Admin';