-- Assign Admin role to the user profile we found
INSERT INTO public.user_roles (user_id, role)
VALUES ('a53f69a5-104e-489b-9b0a-48a56d6b011d', 'Admin'::app_role)
ON CONFLICT (user_id, role) DO NOTHING;