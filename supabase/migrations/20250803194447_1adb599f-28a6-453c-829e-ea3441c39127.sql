-- Update dummy tenants with property and unit assignments
-- First, get some sample properties and units to assign
WITH sample_assignments AS (
  SELECT 
    u.id as unit_id,
    u.property_id,
    ROW_NUMBER() OVER (ORDER BY u.created_at) as rn
  FROM units u
  WHERE u.status = 'vacant'
  LIMIT 10
),
tenant_assignments AS (
  SELECT 
    t.id as tenant_id,
    sa.unit_id,
    sa.property_id,
    ROW_NUMBER() OVER (ORDER BY t.created_at) as rn
  FROM tenants t
  CROSS JOIN sample_assignments sa
  WHERE NOT EXISTS (
    SELECT 1 FROM leases l WHERE l.tenant_id = t.id
  )
  AND t.rn = sa.rn
)
-- Create leases for existing tenants without assignments
INSERT INTO leases (tenant_id, unit_id, monthly_rent, lease_start_date, lease_end_date, security_deposit, status)
SELECT 
  ta.tenant_id,
  ta.unit_id,
  50000 + (random() * 30000)::numeric, -- Random rent between 50k-80k
  CURRENT_DATE - INTERVAL '30 days' * (random() * 12)::int, -- Random start date in past year
  CURRENT_DATE + INTERVAL '365 days', -- 1 year lease
  100000, -- Standard security deposit
  'active'
FROM tenant_assignments ta
WHERE ta.unit_id IS NOT NULL;