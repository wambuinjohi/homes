-- Create profile for admin user if it doesn't exist
INSERT INTO profiles (id, first_name, last_name, email)
SELECT 
    au.id,
    au.raw_user_meta_data ->> 'first_name' as first_name,
    au.raw_user_meta_data ->> 'last_name' as last_name,
    au.email
FROM auth.users au
WHERE au.email = 'ziratechnologies@gmail.com'
  AND NOT EXISTS (SELECT 1 FROM profiles p WHERE p.id = au.id)
ON CONFLICT (id) DO NOTHING;

-- Assign Admin role to the super admin user
INSERT INTO user_roles (user_id, role)
SELECT 
    au.id,
    'Admin'::app_role
FROM auth.users au
WHERE au.email = 'ziratechnologies@gmail.com'
ON CONFLICT (user_id, role) DO NOTHING;