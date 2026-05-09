-- Fix dmwangui@gmail.com role - remove Admin role, keep only Landlord
DELETE FROM public.user_roles 
WHERE user_id = (SELECT id FROM public.profiles WHERE email = 'dmwangui@gmail.com')
AND role = 'Admin';

-- Ensure Simon Gichuki has a proper Free Trial billing plan assignment
-- First, get the Free Trial plan ID and assign it properly
UPDATE public.landlord_subscriptions
SET 
  billing_plan_id = (SELECT id FROM public.billing_plans WHERE name = 'Free Trial' AND is_active = true LIMIT 1),
  status = 'trial',
  updated_at = now()
WHERE landlord_id = (SELECT id FROM public.profiles WHERE email = 'gichukisimon@gmail.com');

-- Ensure the countdown feature works by setting proper trial limitations
UPDATE public.landlord_subscriptions
SET 
  trial_limitations = jsonb_build_object(
    'properties', 2,
    'units_per_property', 10,
    'tenants', 20,
    'maintenance_requests', 50,
    'invoices', 100
  ),
  trial_features_enabled = jsonb_build_array(
    'property_management',
    'tenant_management',
    'maintenance_tracking',
    'payment_processing',
    'reporting'
  )
WHERE landlord_id = (SELECT id FROM public.profiles WHERE email = 'gichukisimon@gmail.com');