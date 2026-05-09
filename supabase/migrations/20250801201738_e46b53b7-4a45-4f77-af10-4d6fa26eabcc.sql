-- Remove all dummy data from the system
DELETE FROM payments WHERE tenant_id IN (
  SELECT id FROM tenants WHERE email LIKE '%@zirahomes.demo'
);

DELETE FROM invoices WHERE tenant_id IN (
  SELECT id FROM tenants WHERE email LIKE '%@zirahomes.demo'
);

DELETE FROM expenses WHERE property_id IN (
  SELECT id FROM properties WHERE name LIKE '%Demo%' OR name LIKE '%Sample%'
);

DELETE FROM leases WHERE tenant_id IN (
  SELECT id FROM tenants WHERE email LIKE '%@zirahomes.demo'
);

DELETE FROM tenants WHERE email LIKE '%@zirahomes.demo';

DELETE FROM units WHERE property_id IN (
  SELECT id FROM properties WHERE name LIKE '%Demo%' OR name LIKE '%Sample%'
);

DELETE FROM blocks WHERE property_id IN (
  SELECT id FROM properties WHERE name LIKE '%Demo%' OR name LIKE '%Sample%'
);

DELETE FROM properties WHERE name LIKE '%Demo%' OR name LIKE '%Sample%';