-- Now add Landlord role to hawijeremiah after fixing constraints

BEGIN;

-- Add Landlord role to hawijeremiah (Tenant already exists)
INSERT INTO public.user_roles (user_id, role)
VALUES ('48a2a4ae-ded3-4c3e-966b-c26711a6d3a9', 'Landlord')
ON CONFLICT (user_id, role) DO NOTHING;

-- Create landlord subscription
INSERT INTO public.landlord_subscriptions (
  landlord_id,
  status,
  trial_start_date,
  trial_end_date,
  onboarding_completed
)
SELECT 
  '48a2a4ae-ded3-4c3e-966b-c26711a6d3a9',
  'trial',
  now(),
  now() + interval '14 days',
  false
WHERE NOT EXISTS (
  SELECT 1 FROM public.landlord_subscriptions 
  WHERE landlord_id = '48a2a4ae-ded3-4c3e-966b-c26711a6d3a9'
);

-- Clean up any users with Tenant role but no linked tenant record
DELETE FROM public.user_roles ur
WHERE ur.role = 'Tenant'
  AND NOT EXISTS (
    SELECT 1 FROM public.tenants t WHERE t.user_id = ur.user_id
  )
  AND NOT EXISTS (
    SELECT 1 FROM public.user_roles ur2 
    WHERE ur2.user_id = ur.user_id AND ur2.role = 'Admin'
  );

COMMIT;