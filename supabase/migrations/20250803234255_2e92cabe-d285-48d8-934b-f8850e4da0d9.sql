-- Update Zira Technologies to Super Admin role
-- Zira Technologies should be the overall Super Admin, not a partner to the Landlord
UPDATE public.user_roles 
SET role = 'Admin'
WHERE user_id = '0b178150-5f82-435a-a515-718ec79da646' AND role = 'Landlord';