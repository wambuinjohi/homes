-- First, let's get some units to work with
INSERT INTO leases (tenant_id, unit_id, monthly_rent, security_deposit, lease_start_date, lease_end_date, status)
SELECT 
  t.id as tenant_id,
  u.id as unit_id,
  u.rent_amount as monthly_rent,
  u.rent_amount * 2 as security_deposit,
  '2024-01-01'::date as lease_start_date,
  '2024-12-31'::date as lease_end_date,
  'active'::text as status
FROM tenants t
CROSS JOIN (
  SELECT id, rent_amount FROM units WHERE property_id IN (
    SELECT id FROM properties WHERE name IN ('Karen Gardens', 'Kasarani Estate', 'Kileleshwa Heights', 'Langata View', 'Westlands Square')
  ) LIMIT 10
) u
WHERE t.first_name IN ('John', 'Wanjiku', 'David', 'Fatuma', 'Aisha', 'Peter', 'Grace', 'Michael', 'Esther', 'Samuel')
LIMIT 10;

-- Add some invoices for October 2024 (some paid, some pending, some overdue)
INSERT INTO invoices (tenant_id, lease_id, amount, invoice_date, due_date, status, invoice_number, description)
SELECT 
  l.tenant_id,
  l.id as lease_id,
  l.monthly_rent,
  '2024-10-01'::date as invoice_date,
  '2024-10-15'::date as due_date,
  CASE 
    WHEN ROW_NUMBER() OVER () % 3 = 0 THEN 'paid'
    WHEN ROW_NUMBER() OVER () % 3 = 1 THEN 'pending'
    ELSE 'overdue'
  END as status,
  'INV-2024-10-' || LPAD((ROW_NUMBER() OVER ())::text, 3, '0') as invoice_number,
  'Monthly rent for October 2024' as description
FROM leases l
LIMIT 10;

-- Add some payments for paid invoices
INSERT INTO payments (tenant_id, lease_id, amount, payment_date, payment_type, status, payment_method, payment_reference)
SELECT 
  i.tenant_id,
  i.lease_id,
  i.amount,
  '2024-10-12'::date as payment_date,
  'Rent'::text as payment_type,
  'completed'::text as status,
  CASE 
    WHEN ROW_NUMBER() OVER () % 2 = 0 THEN 'Bank Transfer'
    ELSE 'Mobile Money'
  END as payment_method,
  'PAY-2024-' || LPAD((ROW_NUMBER() OVER ())::text, 6, '0') as payment_reference
FROM invoices i
WHERE i.status = 'paid'
LIMIT 5;

-- Add some September invoices that are overdue
INSERT INTO invoices (tenant_id, lease_id, amount, invoice_date, due_date, status, invoice_number, description)
SELECT 
  l.tenant_id,
  l.id as lease_id,
  l.monthly_rent,
  '2024-09-01'::date as invoice_date,
  '2024-09-15'::date as due_date,
  'overdue'::text as status,
  'INV-2024-09-' || LPAD((ROW_NUMBER() OVER ())::text, 3, '0') as invoice_number,
  'Monthly rent for September 2024' as description
FROM leases l
WHERE l.tenant_id IN (
  SELECT tenant_id FROM invoices WHERE status = 'overdue' LIMIT 3
)
LIMIT 3;

-- Add some expenses across properties
INSERT INTO expenses (property_id, amount, category, description, expense_date, vendor_name)
SELECT 
  p.id as property_id,
  CASE 
    WHEN ROW_NUMBER() OVER () % 5 = 0 THEN 25000
    WHEN ROW_NUMBER() OVER () % 5 = 1 THEN 15000
    WHEN ROW_NUMBER() OVER () % 5 = 2 THEN 8000
    WHEN ROW_NUMBER() OVER () % 5 = 3 THEN 12000
    ELSE 18000
  END as amount,
  CASE 
    WHEN ROW_NUMBER() OVER () % 5 = 0 THEN 'Maintenance'
    WHEN ROW_NUMBER() OVER () % 5 = 1 THEN 'Utilities'
    WHEN ROW_NUMBER() OVER () % 5 = 2 THEN 'Security'
    WHEN ROW_NUMBER() OVER () % 5 = 3 THEN 'Cleaning'
    ELSE 'Repairs'
  END as category,
  CASE 
    WHEN ROW_NUMBER() OVER () % 5 = 0 THEN 'Monthly maintenance costs'
    WHEN ROW_NUMBER() OVER () % 5 = 1 THEN 'Electricity and water bills'
    WHEN ROW_NUMBER() OVER () % 5 = 2 THEN 'Security guard services'
    WHEN ROW_NUMBER() OVER () % 5 = 3 THEN 'Cleaning and landscaping'
    ELSE 'Emergency repairs and fixes'
  END as description,
  '2024-10-15'::date as expense_date,
  CASE 
    WHEN ROW_NUMBER() OVER () % 5 = 0 THEN 'MainCorp Ltd'
    WHEN ROW_NUMBER() OVER () % 5 = 1 THEN 'Kenya Power & NCWSC'
    WHEN ROW_NUMBER() OVER () % 5 = 2 THEN 'SecureGuard Services'
    WHEN ROW_NUMBER() OVER () % 5 = 3 THEN 'CleanPro Solutions'
    ELSE 'QuickFix Contractors'
  END as vendor_name
FROM properties p
WHERE p.name IN ('Karen Gardens', 'Kasarani Estate', 'Kileleshwa Heights', 'Langata View', 'Westlands Square')
LIMIT 15;