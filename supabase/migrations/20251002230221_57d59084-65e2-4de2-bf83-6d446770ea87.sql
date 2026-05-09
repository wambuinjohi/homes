-- Normalize sub_users permissions to include all 8 required keys
-- This ensures consistent permission checking and prevents undefined values

UPDATE sub_users
SET permissions = jsonb_build_object(
  'manage_properties', COALESCE((permissions->>'manage_properties')::boolean, false),
  'manage_tenants', COALESCE((permissions->>'manage_tenants')::boolean, false),
  'manage_leases', COALESCE((permissions->>'manage_leases')::boolean, false),
  'manage_maintenance', COALESCE((permissions->>'manage_maintenance')::boolean, false),
  'manage_payments', COALESCE((permissions->>'manage_payments')::boolean, false),
  'view_reports', COALESCE((permissions->>'view_reports')::boolean, false),
  'manage_expenses', COALESCE((permissions->>'manage_expenses')::boolean, false),
  'send_messages', COALESCE((permissions->>'send_messages')::boolean, false)
)
WHERE permissions IS NOT NULL;

-- Add comment for documentation
COMMENT ON COLUMN sub_users.permissions IS 
'Must contain all 8 permission keys: manage_properties, manage_tenants, manage_leases, manage_maintenance, manage_payments, view_reports, manage_expenses, send_messages. Each key must be a boolean value.';