-- First, let's see what's preventing the update
-- Drop the foreign key constraint temporarily, update, then recreate with CASCADE

-- Drop the existing foreign key
ALTER TABLE billing_plan_features 
DROP CONSTRAINT IF EXISTS billing_plan_features_feature_key_fkey;

-- Update the feature keys in plan_features
UPDATE plan_features 
SET feature_key = 'payments.management' 
WHERE feature_key = 'payments.basic';

UPDATE plan_features 
SET feature_key = 'maintenance.tracking' 
WHERE feature_key = 'maintenance.basic';

UPDATE plan_features 
SET feature_key = 'invoicing.basic' 
WHERE feature_key = 'invoices.basic';

-- Update the feature keys in billing_plan_features
UPDATE billing_plan_features 
SET feature_key = 'payments.management' 
WHERE feature_key = 'payments.basic';

UPDATE billing_plan_features 
SET feature_key = 'maintenance.tracking' 
WHERE feature_key = 'maintenance.basic';

UPDATE billing_plan_features 
SET feature_key = 'invoicing.basic' 
WHERE feature_key = 'invoices.basic';

-- Recreate the foreign key with CASCADE
ALTER TABLE billing_plan_features 
ADD CONSTRAINT billing_plan_features_feature_key_fkey 
FOREIGN KEY (feature_key) 
REFERENCES plan_features(feature_key) 
ON UPDATE CASCADE 
ON DELETE CASCADE;

-- Now add the new granular features
INSERT INTO plan_features (feature_key, display_name, description, category, icon_name, sort_order) VALUES
('dashboard.stats_cards', 'Dashboard Stats Cards', 'KPI summary cards on dashboard', 'advanced', 'LayoutGrid', 101),
('dashboard.charts', 'Dashboard Charts', 'Visual charts and graphs', 'premium', 'BarChart', 102),
('dashboard.recent_activity', 'Recent Activity Feed', 'Activity alerts', 'core', 'Activity', 103),
('dashboard.recent_payments', 'Recent Payments Table', 'Payments list', 'core', 'Receipt', 104),
('reports.rent_collection', 'Rent Collection Report', 'Track rent collection performance', 'advanced', 'DollarSign', 201),
('reports.occupancy', 'Occupancy Report', 'Track property occupancy rates', 'advanced', 'Home', 202),
('reports.maintenance_summary', 'Maintenance Summary', 'Maintenance request analytics', 'advanced', 'Wrench', 203),
('reports.financial_summary', 'Financial Summary', 'Comprehensive financial overview', 'premium', 'TrendingUp', 204),
('reports.lease_expiry', 'Lease Expiry Report', 'Track upcoming lease expirations', 'premium', 'Calendar', 205),
('reports.outstanding_balances', 'Outstanding Balances', 'Track unpaid balances', 'premium', 'AlertCircle', 206),
('reports.tenant_turnover', 'Tenant Turnover', 'Track tenant turnover rates', 'premium', 'Users', 207),
('reports.property_performance', 'Property Performance', 'Property-level analytics', 'premium', 'Building2', 208),
('reports.profit_loss', 'P&L Statement', 'Profit and loss statement', 'premium', 'FileText', 209),
('reports.revenue_vs_expenses', 'Revenue vs Expenses', 'Revenue comparison', 'premium', 'BarChart', 210),
('reports.expense_summary', 'Expense Summary', 'Expense breakdown', 'premium', 'Receipt', 211),
('reports.cash_flow', 'Cash Flow Analysis', 'Cash flow tracking', 'premium', 'TrendingUp', 212)
ON CONFLICT (feature_key) DO NOTHING;

-- Link features to plans
INSERT INTO billing_plan_features (billing_plan_id, feature_key, is_enabled)
SELECT bp.id, 'dashboard.stats_cards', true
FROM billing_plans bp 
WHERE bp.name IN ('Starter', 'Professional', 'Enterprise')
ON CONFLICT (billing_plan_id, feature_key) DO NOTHING;

INSERT INTO billing_plan_features (billing_plan_id, feature_key, is_enabled)
SELECT bp.id, 'dashboard.charts', true
FROM billing_plans bp 
WHERE bp.name IN ('Professional', 'Enterprise')
ON CONFLICT (billing_plan_id, feature_key) DO NOTHING;

INSERT INTO billing_plan_features (billing_plan_id, feature_key, is_enabled)
SELECT bp.id, unnest(ARRAY['reports.rent_collection', 'reports.occupancy', 'reports.maintenance_summary']), true
FROM billing_plans bp 
WHERE bp.name IN ('Starter', 'Professional', 'Enterprise')
ON CONFLICT (billing_plan_id, feature_key) DO NOTHING;

INSERT INTO billing_plan_features (billing_plan_id, feature_key, is_enabled)
SELECT bp.id, pf.feature_key, true
FROM billing_plans bp 
CROSS JOIN plan_features pf
WHERE bp.name IN ('Professional', 'Enterprise') 
AND pf.feature_key LIKE 'reports.%'
ON CONFLICT (billing_plan_id, feature_key) DO NOTHING;