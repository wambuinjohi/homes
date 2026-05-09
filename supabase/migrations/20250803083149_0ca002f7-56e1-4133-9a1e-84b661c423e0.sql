-- Add sample tenants
INSERT INTO tenants (first_name, last_name, email, phone, national_id, employment_status, monthly_income) VALUES
('John', 'Doe', 'john.doe@email.com', '+254712345678', 'ID12345678', 'Employed', 80000),
('Jane', 'Smith', 'jane.smith@email.com', '+254723456789', 'ID23456789', 'Employed', 120000),
('Mike', 'Johnson', 'mike.johnson@email.com', '+254734567890', 'ID34567890', 'Self-Employed', 95000),
('Sarah', 'Wilson', 'sarah.wilson@email.com', '+254745678901', 'ID45678901', 'Employed', 110000),
('David', 'Brown', 'david.brown@email.com', '+254756789012', 'ID56789012', 'Employed', 85000);

-- Add sample leases (using existing properties and units)
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
CROSS JOIN units u
WHERE t.first_name IN ('John', 'Jane', 'Mike', 'Sarah', 'David')
AND u.unit_number IN ('101', '102', '103', '104', '105')
LIMIT 5;

-- Add sample invoices
INSERT INTO invoices (tenant_id, lease_id, amount, invoice_date, due_date, status, invoice_number)
SELECT 
  l.tenant_id,
  l.id as lease_id,
  l.monthly_rent,
  '2024-10-01'::date as invoice_date,
  '2024-10-15'::date as due_date,
  'paid'::text as status,
  'INV-' || LPAD((ROW_NUMBER() OVER ())::text, 6, '0') as invoice_number
FROM leases l
LIMIT 5;

-- Add sample payments
INSERT INTO payments (tenant_id, lease_id, amount, payment_date, payment_type, status, payment_method)
SELECT 
  i.tenant_id,
  i.lease_id,
  i.amount,
  '2024-10-10'::date as payment_date,
  'Rent'::text as payment_type,
  'completed'::text as status,
  'Bank Transfer'::text as payment_method
FROM invoices i
LIMIT 5;

-- Add sample expenses
INSERT INTO expenses (property_id, amount, category, description, expense_date, vendor_name)
SELECT 
  p.id as property_id,
  CASE 
    WHEN ROW_NUMBER() OVER () % 4 = 1 THEN 15000
    WHEN ROW_NUMBER() OVER () % 4 = 2 THEN 25000
    WHEN ROW_NUMBER() OVER () % 4 = 3 THEN 8000
    ELSE 12000
  END as amount,
  CASE 
    WHEN ROW_NUMBER() OVER () % 4 = 1 THEN 'Maintenance'
    WHEN ROW_NUMBER() OVER () % 4 = 2 THEN 'Utilities'
    WHEN ROW_NUMBER() OVER () % 4 = 3 THEN 'Security'
    ELSE 'Cleaning'
  END as category,
  CASE 
    WHEN ROW_NUMBER() OVER () % 4 = 1 THEN 'Plumbing repairs'
    WHEN ROW_NUMBER() OVER () % 4 = 2 THEN 'Electricity bill'
    WHEN ROW_NUMBER() OVER () % 4 = 3 THEN 'Security services'
    ELSE 'Cleaning services'
  END as description,
  '2024-10-15'::date as expense_date,
  CASE 
    WHEN ROW_NUMBER() OVER () % 4 = 1 THEN 'ABC Plumbing'
    WHEN ROW_NUMBER() OVER () % 4 = 2 THEN 'Kenya Power'
    WHEN ROW_NUMBER() OVER () % 4 = 3 THEN 'SecureTech Ltd'
    ELSE 'CleanCorp'
  END as vendor_name
FROM properties p
WHERE p.name IN ('Sunset Gardens', 'Green Valley', 'Palm Heights', 'Ocean View')
LIMIT 8;