-- Create leases for existing tenants without assignments
-- This will only work if there are vacant units available
INSERT INTO leases (tenant_id, unit_id, monthly_rent, lease_start_date, lease_end_date, security_deposit, status)
SELECT 
  t.id as tenant_id,
  u.id as unit_id,
  50000 + (random() * 30000)::numeric, -- Random rent between 50k-80k
  CURRENT_DATE - INTERVAL '30 days' * (random() * 12)::int, -- Random start date in past year
  CURRENT_DATE + INTERVAL '365 days', -- 1 year lease
  100000, -- Standard security deposit
  'active'
FROM tenants t
CROSS JOIN LATERAL (
  SELECT id 
  FROM units 
  WHERE status = 'vacant' 
  ORDER BY created_at 
  LIMIT 1 
  OFFSET floor(random() * (SELECT COUNT(*) FROM units WHERE status = 'vacant'))
) u
WHERE NOT EXISTS (
  SELECT 1 FROM leases l WHERE l.tenant_id = t.id
)
LIMIT 10;