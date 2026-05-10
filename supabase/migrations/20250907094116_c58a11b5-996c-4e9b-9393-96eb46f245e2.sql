-- Update Starter plan to be more generous and useful
UPDATE public.billing_plans 
SET 
  max_units = 25,
  max_properties = 5,
  sms_credits_included = 150,
  features = jsonb_build_array(
    'reports.basic',
    'maintenance.tracking', 
    'tenant.portal',
    'notifications.email',
    'notifications.sms',
    'documents.templates'
  ),
  updated_at = now()
WHERE name = 'Starter' AND is_active = true;

-- Also update any Free Trial plans to match starter limits for consistency
UPDATE public.billing_plans 
SET 
  max_units = 25,
  max_properties = 5,
  sms_credits_included = 150,
  features = jsonb_build_array(
    'reports.basic',
    'maintenance.tracking', 
    'tenant.portal',
    'notifications.email',
    'notifications.sms',
    'documents.templates'
  ),
  updated_at = now()
WHERE name = 'Free Trial' AND is_active = true;