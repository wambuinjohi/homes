-- Cleanup: Fix tenant role assignments - exclude Admin users
-- Only fix users who are in tenants table AND don't have Admin role

BEGIN;

-- Step 1: Remove Landlord, Manager, Agent roles from tenant users (excluding Admins)
DELETE FROM public.user_roles ur
USING public.tenants t
WHERE ur.user_id = t.user_id
  AND ur.role IN ('Landlord', 'Manager', 'Agent')
  AND NOT EXISTS (
    SELECT 1 FROM public.user_roles ur2
    WHERE ur2.user_id = t.user_id AND ur2.role = 'Admin'
  );

-- Step 2: Add Tenant role to tenant users who don't have it and don't have Admin role
INSERT INTO public.user_roles (user_id, role)
SELECT DISTINCT t.user_id, 'Tenant'::app_role
FROM public.tenants t
WHERE t.user_id IS NOT NULL
  AND NOT EXISTS (
    SELECT 1 FROM public.user_roles ur
    WHERE ur.user_id = t.user_id AND ur.role IN ('Tenant', 'Admin')
  );

-- Step 3: Remove landlord subscriptions from tenant users (excluding Admins)
DELETE FROM public.landlord_subscriptions ls
USING public.tenants t
WHERE ls.landlord_id = t.user_id
  AND NOT EXISTS (
    SELECT 1 FROM public.user_roles ur
    WHERE ur.user_id = t.user_id AND ur.role = 'Admin'
  );

COMMIT;