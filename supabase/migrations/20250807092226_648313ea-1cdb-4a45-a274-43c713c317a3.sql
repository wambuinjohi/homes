-- Fix missing subscription for John Kibe (Agent role)
-- Ensure Agents also get trial subscriptions
INSERT INTO public.landlord_subscriptions (
  landlord_id,
  billing_plan_id,
  status,
  trial_start_date,
  trial_end_date,
  sms_credits_balance,
  auto_renewal,
  trial_limitations,
  trial_features_enabled
)
SELECT 
  p.id,
  (SELECT id FROM public.billing_plans WHERE name = 'Free Trial' AND is_active = true LIMIT 1),
  'trial',
  now(),
  now() + interval '30 days',
  100,
  true,
  jsonb_build_object(
    'properties', 2,
    'units_per_property', 10,
    'tenants', 20,
    'maintenance_requests', 50,
    'invoices', 100
  ),
  jsonb_build_array(
    'property_management',
    'tenant_management',
    'maintenance_tracking',
    'payment_processing',
    'reporting'
  )
FROM public.profiles p
JOIN public.user_roles ur ON p.id = ur.user_id
WHERE p.email = 'Kibe@mail.com' 
  AND ur.role = 'Agent'
  AND NOT EXISTS (
    SELECT 1 FROM public.landlord_subscriptions 
    WHERE landlord_id = p.id
  );