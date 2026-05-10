-- Clear existing data and insert fresh dummy data
DELETE FROM public.units;
DELETE FROM public.tenants;
DELETE FROM public.properties WHERE name IN ('Kileleshwa Heights', 'Westlands Square', 'Karen Gardens', 'Langata View', 'Kasarani Estate');

-- Insert dummy properties with Kenyan data
INSERT INTO public.properties (name, address, city, state, zip_code, country, property_type, total_units, description, amenities) VALUES
('Kileleshwa Heights', 'Kileleshwa Road', 'Nairobi', 'Nairobi', '00100', 'Kenya', 'Apartment', 10, 'Modern apartments in upscale Kileleshwa with parking and security', ARRAY['Parking', 'Security', 'Water Backup', 'Generator']),
('Westlands Square', 'Woodvale Grove', 'Nairobi', 'Nairobi', '00100', 'Kenya', 'Apartment', 10, 'Prime location apartments near Westlands with mall access', ARRAY['Mall Access', 'Parking', 'Security', 'Elevator']),
('Karen Gardens', 'Karen Road', 'Nairobi', 'Nairobi', '00502', 'Kenya', 'Townhouse', 10, 'Serene townhouses in Karen with garden spaces', ARRAY['Garden', 'Parking', 'Security', 'Swimming Pool']),
('Langata View', 'Langata Road', 'Nairobi', 'Nairobi', '00509', 'Kenya', 'Apartment', 10, 'Affordable housing with great views of Ngong Hills', ARRAY['Great Views', 'Parking', 'Security', 'Playground']),
('Kasarani Estate', 'Thika Road', 'Nairobi', 'Nairobi', '00618', 'Kenya', 'Apartment', 10, 'Family-friendly apartments near Kasarani Stadium', ARRAY['Stadium Access', 'Parking', 'Security', 'Shopping Center']);