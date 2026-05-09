-- Update Zira Technologies from Admin to Landlord role
-- This removes them from the "Partner" administrative role
UPDATE public.user_roles 
SET role = 'Landlord'
WHERE user_id = '0b178150-5f82-435a-a515-718ec79da646' AND role = 'Admin';