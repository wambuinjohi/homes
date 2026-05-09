-- Create profile and role for the missing manager user
-- Insert profile for Mazao Plus (the manager that was created but missing profile)
INSERT INTO public.profiles (id, first_name, last_name, email, phone)
VALUES ('1b95861d-0bd3-4029-9841-28e5a7cc73a7', 'Mazao', 'Plus', 'mazaoplus@gmail.com', '+254723301508')
ON CONFLICT (id) DO NOTHING;

-- Insert user role for Mazao Plus
INSERT INTO public.user_roles (user_id, role)
VALUES ('1b95861d-0bd3-4029-9841-28e5a7cc73a7', 'Manager')
ON CONFLICT (user_id, role) DO NOTHING;