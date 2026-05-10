-- Seed plan_features with initial feature definitions
INSERT INTO plan_features (feature_key, display_name, description, category, icon_name, menu_item_title, sort_order) VALUES
-- Core Features
('dashboard.access', 'Dashboard Access', 'Access to main dashboard with key metrics', 'core', 'LayoutDashboard', 'Dashboard', 10),
('properties.basic', 'Property Management', 'Add and manage properties', 'core', 'Building2', 'Properties', 20),
('units.basic', 'Unit Management', 'Add and manage rental units', 'core', 'Home', 'Units', 30),
('tenants.basic', 'Tenant Management', 'Add and manage tenants', 'core', 'Users', 'Tenants', 40),
('leases.basic', 'Lease Tracking', 'Create and track lease agreements', 'core', 'FileText', 'Leases', 50),
('payments.basic', 'Payment Recording', 'Record and track rent payments', 'core', 'DollarSign', 'Payments', 60),
('maintenance.basic', 'Maintenance Requests', 'Track maintenance requests', 'core', 'Wrench', 'Maintenance', 70),
('invoices.basic', 'Basic Invoicing', 'Generate rent invoices', 'core', 'Receipt', 'Invoices', 80),

-- Advanced Features
('reports.basic', 'Basic Reports', 'Rent collection, occupancy, and maintenance reports', 'advanced', 'BarChart3', 'Reports', 100),
('expenses.tracking', 'Expense Tracking', 'Track property-related expenses', 'advanced', 'TrendingDown', 'Expenses', 110),
('notifications.email', 'Email Notifications', 'Automated email notifications', 'advanced', 'Mail', null, 120),
('tenant.portal', 'Tenant Portal', 'Self-service portal for tenants', 'advanced', 'UserCircle', null, 130),
('bulk.upload', 'Bulk Upload', 'Bulk import properties, units, and tenants', 'advanced', 'Upload', null, 140),

-- Premium Features
('reports.advanced', 'Advanced Reports', 'Financial summary, P&L, cash flow analysis', 'premium', 'TrendingUp', 'Reports', 200),
('reports.financial', 'Financial Reports', 'Comprehensive financial statements', 'premium', 'DollarSign', 'Reports', 210),
('team.sub_users', 'Sub Users', 'Add team members with role-based access', 'premium', 'Users', 'Sub Users', 220),
('team.permissions', 'Role Management', 'Granular permission control', 'premium', 'Shield', null, 230),
('communication.sms', 'Bulk SMS', 'Send bulk SMS to tenants', 'premium', 'MessageSquare', 'Bulk Messaging', 240),
('communication.email_templates', 'Email Templates', 'Customize email templates', 'premium', 'Mail', 'Email Templates', 250),
('communication.sms_templates', 'SMS Templates', 'Customize SMS templates', 'premium', 'MessageSquare', 'Message Templates', 260),
('invoicing.advanced', 'Advanced Invoicing', 'Bulk invoice generation and automation', 'premium', 'Receipt', 'Invoices', 270),
('documents.templates', 'Document Templates', 'Custom PDF document templates', 'premium', 'FileText', null, 280),

-- Enterprise Features
('branding.white_label', 'White Label', 'Remove platform branding, use your own', 'enterprise', 'Palette', null, 300),
('branding.custom', 'Custom Branding', 'Full brand customization', 'enterprise', 'Paintbrush', null, 310),
('support.priority', 'Priority Support', '24/7 priority customer support', 'enterprise', 'Headphones', null, 320),
('support.dedicated', 'Dedicated Account Manager', 'Personal account manager', 'enterprise', 'UserCheck', null, 330),
('integrations.api', 'API Access', 'Full REST API access for integrations', 'enterprise', 'Code', null, 340),
('integrations.accounting', 'Accounting Integration', 'Connect with accounting software', 'enterprise', 'Calculator', null, 350)
ON CONFLICT (feature_key) DO NOTHING;

-- Link features to billing plans
-- Trial plan (core only)
INSERT INTO billing_plan_features (billing_plan_id, feature_key, is_enabled)
SELECT bp.id, pf.feature_key, true
FROM billing_plans bp
CROSS JOIN plan_features pf
WHERE bp.name = 'Trial' AND pf.category = 'core'
ON CONFLICT (billing_plan_id, feature_key) DO NOTHING;

-- Starter plan (core + advanced)
INSERT INTO billing_plan_features (billing_plan_id, feature_key, is_enabled)
SELECT bp.id, pf.feature_key, true
FROM billing_plans bp
CROSS JOIN plan_features pf
WHERE bp.name = 'Starter' AND pf.category IN ('core', 'advanced')
ON CONFLICT (billing_plan_id, feature_key) DO NOTHING;

-- Professional plan (core + advanced + premium)
INSERT INTO billing_plan_features (billing_plan_id, feature_key, is_enabled)
SELECT bp.id, pf.feature_key, true
FROM billing_plans bp
CROSS JOIN plan_features pf
WHERE bp.name = 'Professional' AND pf.category IN ('core', 'advanced', 'premium')
ON CONFLICT (billing_plan_id, feature_key) DO NOTHING;