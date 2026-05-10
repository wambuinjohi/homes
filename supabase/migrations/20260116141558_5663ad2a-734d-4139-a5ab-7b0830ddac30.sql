
-- Temporarily disable only the audit trigger
ALTER TABLE billing_plans DISABLE TRIGGER billing_plan_audit_trigger;

-- Phase 1: Deactivate old plans
UPDATE billing_plans SET is_active = false 
WHERE name IN ('Starter', 'Professional', 'Enterprise') AND is_active = true;

-- Phase 2: Insert Landlord Plans (4 plans)
INSERT INTO billing_plans (
  name, price, billing_cycle, billing_model, fixed_amount_per_unit, 
  plan_category, min_units, max_units, max_units_display, display_order, 
  is_popular, is_active, is_custom, currency, sms_credits_included,
  description, competitive_note, features, contact_link
) VALUES 
-- Micro Plan (Landlord)
(
  'Micro', 500, 'monthly', 'fixed_per_unit', 25,
  'landlord', 1, 20, '1-20 units', 1,
  false, true, false, 'KES', 200,
  'Perfect for small landlords with a few properties',
  'Up to 600% cheaper than competitors',
  '["property_management", "tenant_portal", "invoicing", "basic_reports", "email_notifications", "payment_tracking"]'::jsonb,
  NULL
),
-- Standard Plan (Landlord)
(
  'Standard', 3500, 'monthly', 'fixed_per_unit', 35,
  'landlord', 21, 100, '21-100 units', 2,
  true, true, false, 'KES', 1000,
  'For growing landlords with expanding portfolios',
  NULL,
  '["property_management", "tenant_portal", "invoicing", "advanced_reports", "email_notifications", "sms_notifications", "payment_tracking", "bulk_operations", "automated_reminders", "expense_tracking"]'::jsonb,
  NULL
),
-- Premium Plan (Landlord)
(
  'Premium', 6500, 'monthly', 'fixed_per_unit', 32.5,
  'landlord', 101, 200, '101-200 units', 3,
  false, true, false, 'KES', 2500,
  'Full-featured management for professional landlords',
  NULL,
  '["property_management", "tenant_portal", "invoicing", "advanced_reports", "email_notifications", "sms_notifications", "payment_tracking", "bulk_operations", "automated_reminders", "expense_tracking", "sub_users", "custom_branding", "priority_support", "maintenance_management"]'::jsonb,
  NULL
),
-- Enterprise Plan (Landlord - Custom)
(
  'Enterprise Landlord', 0, 'monthly', 'fixed_per_unit', NULL,
  'landlord', 201, NULL, '200+ units', 4,
  false, true, true, 'KES', 10000,
  'Custom enterprise solution for large property owners',
  NULL,
  '["property_management", "tenant_portal", "invoicing", "advanced_reports", "email_notifications", "sms_notifications", "payment_tracking", "bulk_operations", "automated_reminders", "expense_tracking", "sub_users", "custom_branding", "priority_support", "maintenance_management", "api_access", "white_label", "dedicated_support", "unlimited_sms"]'::jsonb,
  '/contact'
);

-- Phase 3: Insert Agency Plans (4 plans)
INSERT INTO billing_plans (
  name, price, billing_cycle, billing_model, fixed_amount_per_unit, 
  plan_category, min_units, max_units, max_units_display, display_order, 
  is_popular, is_active, is_custom, currency, sms_credits_included,
  description, competitive_note, features, contact_link
) VALUES 
-- Startup Plan (Agency)
(
  'Startup', 2000, 'monthly', 'fixed_per_unit', 10,
  'agency', 1, 200, '1-200 units', 1,
  false, true, false, 'KES', 500,
  'Perfect for new property management agencies',
  'Best value for agencies',
  '["property_management", "tenant_portal", "invoicing", "basic_reports", "email_notifications", "payment_tracking", "team_management", "multi_property"]'::jsonb,
  NULL
),
-- Growth Plan (Agency)
(
  'Growth', 4500, 'monthly', 'fixed_per_unit', 11.25,
  'agency', 201, 400, '201-400 units', 2,
  true, true, false, 'KES', 1500,
  'For growing agencies expanding their portfolio',
  NULL,
  '["property_management", "tenant_portal", "invoicing", "advanced_reports", "email_notifications", "sms_notifications", "payment_tracking", "team_management", "multi_property", "bulk_operations", "automated_reminders", "advanced_analytics"]'::jsonb,
  NULL
),
-- Scale Plan (Agency)
(
  'Scale', 6000, 'monthly', 'fixed_per_unit', 10,
  'agency', 401, 600, '401-600 units', 3,
  false, true, false, 'KES', 3000,
  'Full-featured management for established agencies',
  NULL,
  '["property_management", "tenant_portal", "invoicing", "advanced_reports", "email_notifications", "sms_notifications", "payment_tracking", "team_management", "multi_property", "bulk_operations", "automated_reminders", "advanced_analytics", "custom_branding", "priority_support"]'::jsonb,
  NULL
),
-- Corporate Plan (Agency - Custom)
(
  'Corporate', 0, 'monthly', 'fixed_per_unit', NULL,
  'agency', 601, NULL, '600+ units', 4,
  false, true, true, 'KES', 10000,
  'Enterprise solution for large property management companies',
  NULL,
  '["property_management", "tenant_portal", "invoicing", "advanced_reports", "email_notifications", "sms_notifications", "payment_tracking", "team_management", "multi_property", "bulk_operations", "automated_reminders", "advanced_analytics", "custom_branding", "priority_support", "api_access", "white_label", "dedicated_support", "unlimited_sms"]'::jsonb,
  '/contact'
);

-- Phase 4: Migrate existing landlords to Micro plan
UPDATE landlord_subscriptions 
SET 
  billing_plan_id = (SELECT id FROM billing_plans WHERE name = 'Micro' AND plan_category = 'landlord' LIMIT 1),
  status = 'active',
  account_type = COALESCE(account_type, 'landlord')
WHERE billing_plan_id IS NULL 
   OR billing_plan_id IN (SELECT id FROM billing_plans WHERE is_active = false);

-- Re-enable the audit trigger
ALTER TABLE billing_plans ENABLE TRIGGER billing_plan_audit_trigger;
