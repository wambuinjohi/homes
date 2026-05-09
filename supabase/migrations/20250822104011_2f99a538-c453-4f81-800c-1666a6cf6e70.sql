-- One-time SQL to backfill tenants.user_id by matching email addresses
-- This will help align tenant visibility for historical invoices without affecting landlord reports

UPDATE public.tenants 
SET user_id = auth_users.id
FROM (
  SELECT DISTINCT 
    au.id, 
    au.email
  FROM auth.users au
  WHERE au.email IS NOT NULL
) AS auth_users
WHERE tenants.user_id IS NULL 
  AND tenants.email IS NOT NULL
  AND LOWER(tenants.email) = LOWER(auth_users.email);