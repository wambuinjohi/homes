-- Update dmwangui@gmail.com user role from Admin to Landlord
UPDATE public.user_roles 
SET role = 'Landlord'
WHERE user_id = 'a53f69a5-104e-489b-9b0a-48a56d6b011d';