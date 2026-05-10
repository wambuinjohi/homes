-- Assign Admin role to the super admin user
INSERT INTO user_roles (user_id, role)
SELECT id, 'Admin'::app_role
FROM profiles 
WHERE email = 'ziratechnologies@gmail.com'
ON CONFLICT (user_id, role) DO NOTHING;