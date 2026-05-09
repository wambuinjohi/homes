-- Pre-populate billing plans with the suggested tiered structure
-- This creates starter, professional, and enterprise plans with appropriate features

-- Insert Starter Plan (KES 100 per unit)
INSERT INTO public.billing_plans (
  name,
  description,
  price,
  billing_cycle,
  billing_model,
  fixed_amount_per_unit,
  max_properties,
  max_units,
  sms_credits_included,
  features,
  is_active,
  currency
) VALUES (
  'Starter',
  'Perfect for small landlords managing up to 10 units with essential features',
  100,
  'monthly',
  'fixed_per_unit',
  100,
  3,
  10,
  50,
  '["reports.basic", "maintenance.tracking", "tenant.portal", "notifications.email"]'::jsonb,
  true,
  'KES'
) ON CONFLICT (name) DO UPDATE SET
  description = EXCLUDED.description,
  price = EXCLUDED.price,
  billing_model = EXCLUDED.billing_model,
  fixed_amount_per_unit = EXCLUDED.fixed_amount_per_unit,
  max_properties = EXCLUDED.max_properties,
  max_units = EXCLUDED.max_units,
  sms_credits_included = EXCLUDED.sms_credits_included,
  features = EXCLUDED.features,
  currency = EXCLUDED.currency,
  updated_at = now();

-- Insert Professional Plan (KES 200 per unit)  
INSERT INTO public.billing_plans (
  name,
  description,
  price,
  billing_cycle,
  billing_model,
  fixed_amount_per_unit,
  max_properties,
  max_units,
  sms_credits_included,
  features,
  is_active,
  currency
) VALUES (
  'Professional',
  'Advanced features for growing property managers with comprehensive reporting',
  200,
  'monthly',
  'fixed_per_unit',
  200,
  10,
  50,
  200,
  '["reports.basic", "reports.advanced", "reports.financial", "maintenance.tracking", "tenant.portal", "notifications.email", "notifications.sms", "operations.bulk", "billing.automated", "documents.templates"]'::jsonb,
  true,
  'KES'
) ON CONFLICT (name) DO UPDATE SET
  description = EXCLUDED.description,
  price = EXCLUDED.price,
  billing_model = EXCLUDED.billing_model,
  fixed_amount_per_unit = EXCLUDED.fixed_amount_per_unit,
  max_properties = EXCLUDED.max_properties,
  max_units = EXCLUDED.max_units,
  sms_credits_included = EXCLUDED.sms_credits_included,
  features = EXCLUDED.features,
  currency = EXCLUDED.currency,
  updated_at = now();

-- Insert Enterprise Plan (Commission-based for 50+ units)
INSERT INTO public.billing_plans (
  name,
  description,
  price,
  billing_cycle,
  billing_model,
  percentage_rate,
  max_properties,
  max_units,
  sms_credits_included,
  features,
  is_active,
  currency
) VALUES (
  'Enterprise',
  'Full-featured solution for large property portfolios with API access and white-label options',
  0,
  'monthly',
  'percentage',
  3.5,
  999,
  999,
  1000,
  '["reports.basic", "reports.advanced", "reports.financial", "maintenance.tracking", "tenant.portal", "notifications.email", "notifications.sms", "operations.bulk", "billing.automated", "documents.templates", "integrations.api", "integrations.accounting", "team.roles", "team.sub_users", "branding.white_label", "branding.custom", "support.priority", "support.dedicated"]'::jsonb,
  true,
  'KES'
) ON CONFLICT (name) DO UPDATE SET
  description = EXCLUDED.description,
  price = EXCLUDED.price,
  billing_model = EXCLUDED.billing_model,
  percentage_rate = EXCLUDED.percentage_rate,
  max_properties = EXCLUDED.max_properties,
  max_units = EXCLUDED.max_units,
  sms_credits_included = EXCLUDED.sms_credits_included,
  features = EXCLUDED.features,
  currency = EXCLUDED.currency,
  updated_at = now();

-- Insert Free Trial Plan for new signups
INSERT INTO public.billing_plans (
  name,
  description,
  price,
  billing_cycle,
  billing_model,
  max_properties,
  max_units,
  sms_credits_included,
  features,
  is_active,
  currency
) VALUES (
  'Free Trial',
  '14-day free trial with basic features to explore the platform',
  0,
  'monthly',
  'percentage',
  2,
  5,
  10,
  '["reports.basic", "maintenance.tracking", "tenant.portal", "notifications.email"]'::jsonb,
  true,
  'KES'
) ON CONFLICT (name) DO UPDATE SET
  description = EXCLUDED.description,
  max_properties = EXCLUDED.max_properties,
  max_units = EXCLUDED.max_units,
  sms_credits_included = EXCLUDED.sms_credits_included,
  features = EXCLUDED.features,
  currency = EXCLUDED.currency,
  updated_at = now();