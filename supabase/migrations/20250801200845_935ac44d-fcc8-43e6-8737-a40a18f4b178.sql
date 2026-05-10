-- Add comprehensive dummy data for all entities with proper UUIDs

-- Insert sample properties
INSERT INTO public.properties (id, name, address, city, state, zip_code, country, property_type, description, amenities, total_units, owner_id, created_at) VALUES
('a1111111-1111-1111-1111-111111111111', 'Kilimani Heights', '123 Kilimani Road', 'Nairobi', 'Nairobi County', '00100', 'Kenya', 'Residential', 'Modern apartment complex in upscale Kilimani', ARRAY['Parking', 'Security', 'Gym', 'Swimming Pool'], 12, auth.uid(), now()),
('b2222222-2222-2222-2222-222222222222', 'Westlands Business Park', '456 Ring Road', 'Nairobi', 'Nairobi County', '00600', 'Kenya', 'Commercial', 'Prime commercial property in Westlands', ARRAY['Parking', '24/7 Security', 'Elevator', 'Conference Rooms'], 8, auth.uid(), now()),
('c3333333-3333-3333-3333-333333333333', 'Karen Gardens', '789 Karen Road', 'Nairobi', 'Nairobi County', '00502', 'Kenya', 'Mixed-use', 'Luxury mixed-use development in Karen', ARRAY['Landscaped Gardens', 'Security', 'Shopping Center', 'Restaurant'], 20, auth.uid(), now())
ON CONFLICT (id) DO NOTHING;

-- Insert sample units
INSERT INTO public.units (id, unit_number, unit_type, property_id, bedrooms, bathrooms, square_feet, rent_amount, security_deposit, status, description, created_at) VALUES
('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'A101', '2 Bedroom', 'a1111111-1111-1111-1111-111111111111', 2, 2, 900, 45000, 90000, 'occupied', 'Spacious 2BR with balcony', now()),
('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', 'A102', '1 Bedroom', 'a1111111-1111-1111-1111-111111111111', 1, 1, 650, 35000, 70000, 'vacant', 'Cozy 1BR apartment', now()),
('cccccccc-cccc-cccc-cccc-cccccccccccc', 'B201', 'Bedsitter', 'a1111111-1111-1111-1111-111111111111', 0, 1, 400, 25000, 50000, 'occupied', 'Modern bedsitter with kitchenette', now()),
('dddddddd-dddd-dddd-dddd-dddddddddddd', 'Office-01', 'Office Space', 'b2222222-2222-2222-2222-222222222222', 0, 2, 1200, 120000, 240000, 'vacant', 'Premium office space', now()),
('eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee', 'Villa-01', 'Standalone House', 'c3333333-3333-3333-3333-333333333333', 4, 3, 2500, 150000, 300000, 'occupied', 'Luxury villa with garden', now())
ON CONFLICT (id) DO NOTHING;

-- Insert sample tenants
INSERT INTO public.tenants (id, first_name, last_name, email, phone, national_id, profession, emergency_contact_name, emergency_contact_phone, previous_address, created_at) VALUES
('f4444444-4444-4444-4444-444444444444', 'John', 'Kamau', 'john.kamau@email.com', '+254712345678', '12345678', 'Software Engineer', 'Mary Kamau', '+254723456789', 'Kiambu, Kenya', now()),
('g5555555-5555-5555-5555-555555555555', 'Grace', 'Wanjiku', 'grace.wanjiku@email.com', '+254734567890', '23456789', 'Marketing Manager', 'Peter Wanjiku', '+254745678901', 'Nakuru, Kenya', now()),
('h6666666-6666-6666-6666-666666666666', 'Ahmed', 'Hassan', 'ahmed.hassan@email.com', '+254756789012', '34567890', 'Business Consultant', 'Fatima Hassan', '+254767890123', 'Mombasa, Kenya', now())
ON CONFLICT (id) DO NOTHING;

-- Insert sample leases
INSERT INTO public.leases (id, tenant_id, unit_id, lease_start_date, lease_end_date, monthly_rent, security_deposit, status, lease_terms, created_at) VALUES
('i7777777-7777-7777-7777-777777777777', 'f4444444-4444-4444-4444-444444444444', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', '2024-01-01', '2024-12-31', 45000, 90000, 'active', 'Standard 12-month lease with annual renewal option', now()),
('j8888888-8888-8888-8888-888888888888', 'g5555555-5555-5555-5555-555555555555', 'cccccccc-cccc-cccc-cccc-cccccccccccc', '2024-02-01', '2025-01-31', 25000, 50000, 'active', 'Standard 12-month lease', now()),
('k9999999-9999-9999-9999-999999999999', 'h6666666-6666-6666-6666-666666666666', 'eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee', '2024-03-01', '2025-02-28', 150000, 300000, 'active', 'Premium villa lease with garden maintenance included', now())
ON CONFLICT (id) DO NOTHING;

-- Insert sample payments
INSERT INTO public.payments (id, lease_id, tenant_id, amount, payment_date, payment_type, payment_method, transaction_id, status, notes, created_at) VALUES
('l1010101-1010-1010-1010-101010101010', 'i7777777-7777-7777-7777-777777777777', 'f4444444-4444-4444-4444-444444444444', 45000, '2024-01-01', 'Rent', 'Bank Transfer', 'TXN001234', 'completed', 'January rent payment', now()),
('m2020202-2020-2020-2020-202020202020', 'j8888888-8888-8888-8888-888888888888', 'g5555555-5555-5555-5555-555555555555', 25000, '2024-02-01', 'Rent', 'M-Pesa', 'MPESA5678', 'completed', 'February rent payment', now()),
('n3030303-3030-3030-3030-303030303030', 'k9999999-9999-9999-9999-999999999999', 'h6666666-6666-6666-6666-666666666666', 150000, '2024-03-01', 'Rent', 'Cheque', 'CHQ789012', 'completed', 'March rent payment', now())
ON CONFLICT (id) DO NOTHING;

-- Insert sample expenses
INSERT INTO public.expenses (id, property_id, unit_id, description, category, amount, expense_date, vendor_name, receipt_url, created_by, created_at) VALUES
('o4040404-4040-4040-4040-404040404040', 'a1111111-1111-1111-1111-111111111111', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'Plumbing repair in unit A101', 'Maintenance', 8500, '2024-01-15', 'Nairobi Plumbers Ltd', null, auth.uid(), now()),
('p5050505-5050-5050-5050-505050505050', 'a1111111-1111-1111-1111-111111111111', null, 'Monthly security service', 'Security', 25000, '2024-01-01', 'SecureGuard Kenya', null, auth.uid(), now()),
('q6060606-6060-6060-6060-606060606060', 'b2222222-2222-2222-2222-222222222222', null, 'Elevator maintenance', 'Maintenance', 15000, '2024-01-10', 'Otis Elevators', null, auth.uid(), now())
ON CONFLICT (id) DO NOTHING;