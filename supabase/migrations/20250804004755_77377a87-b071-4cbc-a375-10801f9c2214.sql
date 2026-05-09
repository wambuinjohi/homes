-- Ensure Jackline has a tenant record and sample data for testing
-- First, check if tenant record exists and create if needed
INSERT INTO public.tenants (
  id,
  user_id,
  first_name,
  last_name,
  email,
  phone,
  employment_status,
  created_at,
  updated_at
) 
SELECT 
  gen_random_uuid(),
  'f9f8664d-08e5-4cbf-9137-e0f8675f064d',
  'Jackline',
  'Mwangi', 
  'jackywmwangi@gmail.com',
  '+254712345678',
  'Employed',
  now(),
  now()
WHERE NOT EXISTS (
  SELECT 1 FROM public.tenants 
  WHERE user_id = 'f9f8664d-08e5-4cbf-9137-e0f8675f064d'
);

-- Create a sample property if none exists
INSERT INTO public.properties (
  id,
  name,
  address,
  city,
  state,
  zip_code,
  country,
  property_type,
  description,
  total_units,
  created_at,
  updated_at
)
SELECT 
  gen_random_uuid(),
  'Sunset Gardens Apartments',
  '123 Garden View Road',
  'Nairobi',
  'Nairobi County',
  '00100',
  'Kenya',
  'Apartment Complex',
  'Modern apartments with great amenities',
  24,
  now(),
  now()
WHERE NOT EXISTS (SELECT 1 FROM public.properties LIMIT 1);

-- Create a sample unit for the tenant
INSERT INTO public.units (
  id,
  property_id,
  unit_number,
  unit_type,
  bedrooms,
  bathrooms,
  square_feet,
  rent_amount,
  security_deposit,
  status,
  description,
  created_at,
  updated_at
)
SELECT 
  gen_random_uuid(),
  (SELECT id FROM public.properties LIMIT 1),
  'A-101',
  '2 Bedroom',
  2,
  2.0,
  850,
  45000.00,
  90000.00,
  'occupied',
  'Spacious 2-bedroom apartment with balcony',
  now(),
  now()
WHERE NOT EXISTS (
  SELECT 1 FROM public.units u
  JOIN public.leases l ON l.unit_id = u.id
  JOIN public.tenants t ON l.tenant_id = t.id
  WHERE t.user_id = 'f9f8664d-08e5-4cbf-9137-e0f8675f064d'
);

-- Create a lease for Jackline
INSERT INTO public.leases (
  id,
  unit_id,
  tenant_id,
  lease_start_date,
  lease_end_date,
  monthly_rent,
  security_deposit,
  status,
  lease_terms,
  created_at,
  updated_at
)
SELECT 
  gen_random_uuid(),
  (SELECT id FROM public.units WHERE unit_number = 'A-101' LIMIT 1),
  (SELECT id FROM public.tenants WHERE user_id = 'f9f8664d-08e5-4cbf-9137-e0f8675f064d' LIMIT 1),
  '2024-01-01',
  '2024-12-31',
  45000.00,
  90000.00,
  'active',
  'Standard residential lease agreement with 12-month term',
  now(),
  now()
WHERE NOT EXISTS (
  SELECT 1 FROM public.leases l
  JOIN public.tenants t ON l.tenant_id = t.id
  WHERE t.user_id = 'f9f8664d-08e5-4cbf-9137-e0f8675f064d'
);

-- Create a current invoice for rent payment
INSERT INTO public.invoices (
  id,
  lease_id,
  tenant_id,
  invoice_number,
  invoice_date,
  due_date,
  amount,
  status,
  description,
  created_at,
  updated_at
)
SELECT 
  gen_random_uuid(),
  (SELECT l.id FROM public.leases l
   JOIN public.tenants t ON l.tenant_id = t.id
   WHERE t.user_id = 'f9f8664d-08e5-4cbf-9137-e0f8675f064d' LIMIT 1),
  (SELECT id FROM public.tenants WHERE user_id = 'f9f8664d-08e5-4cbf-9137-e0f8675f064d' LIMIT 1),
  'INV-2024-001',
  CURRENT_DATE - INTERVAL '5 days',
  CURRENT_DATE + INTERVAL '10 days',
  45000.00,
  'pending',
  'Monthly rent for ' || TO_CHAR(CURRENT_DATE, 'Month YYYY'),
  now(),
  now()
WHERE NOT EXISTS (
  SELECT 1 FROM public.invoices i
  JOIN public.tenants t ON i.tenant_id = t.id
  WHERE t.user_id = 'f9f8664d-08e5-4cbf-9137-e0f8675f064d'
  AND i.status = 'pending'
);