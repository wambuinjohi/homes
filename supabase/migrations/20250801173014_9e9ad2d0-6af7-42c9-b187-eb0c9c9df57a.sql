-- Insert dummy data only if tables exist
DO $$
BEGIN
    -- Check if all required tables exist before inserting data
    IF EXISTS (
        SELECT 1 FROM information_schema.tables 
        WHERE table_name IN ('properties', 'units', 'tenants') AND table_schema = 'public'
    ) THEN
        -- Insert dummy properties with Kenyan data
        INSERT INTO public.properties (name, address, city, state, zip_code, country, property_type, total_units, description, amenities) VALUES
        ('Kileleshwa Heights', 'Kileleshwa Road', 'Nairobi', 'Nairobi', '00100', 'Kenya', 'Apartment', 10, 'Modern apartments in upscale Kileleshwa with parking and security', ARRAY['Parking', 'Security', 'Water Backup', 'Generator']),
        ('Westlands Square', 'Woodvale Grove', 'Nairobi', 'Nairobi', '00100', 'Kenya', 'Apartment', 10, 'Prime location apartments near Westlands with mall access', ARRAY['Mall Access', 'Parking', 'Security', 'Elevator']),
        ('Karen Gardens', 'Karen Road', 'Nairobi', 'Nairobi', '00502', 'Kenya', 'Townhouse', 10, 'Serene townhouses in Karen with garden spaces', ARRAY['Garden', 'Parking', 'Security', 'Swimming Pool']),
        ('Langata View', 'Langata Road', 'Nairobi', 'Nairobi', '00509', 'Kenya', 'Apartment', 10, 'Affordable housing with great views of Ngong Hills', ARRAY['Great Views', 'Parking', 'Security', 'Playground']),
        ('Kasarani Estate', 'Thika Road', 'Nairobi', 'Nairobi', '00618', 'Kenya', 'Apartment', 10, 'Family-friendly apartments near Kasarani Stadium', ARRAY['Stadium Access', 'Parking', 'Security', 'Shopping Center']);

        -- Insert units for each property (10 units each, 80% occupancy)
        INSERT INTO public.units (
            unit_number, 
            unit_type, 
            property_id, 
            bedrooms, 
            bathrooms, 
            square_feet, 
            rent_amount, 
            security_deposit, 
            status, 
            description,
            amenities
        )
        SELECT
            CASE 
                WHEN p.name = 'Karen Gardens' THEN 'TH' || s.unit_num::text
                ELSE s.unit_num::text
            END,
            (ARRAY['Studio', '1 Bedroom', '2 Bedroom', '3 Bedroom'])[(s.unit_num % 4) + 1],
            p.id,
            CASE 
                WHEN (ARRAY['Studio', '1 Bedroom', '2 Bedroom', '3 Bedroom'])[(s.unit_num % 4) + 1] = 'Studio' THEN 0
                WHEN (ARRAY['Studio', '1 Bedroom', '2 Bedroom', '3 Bedroom'])[(s.unit_num % 4) + 1] = '1 Bedroom' THEN 1
                WHEN (ARRAY['Studio', '1 Bedroom', '2 Bedroom', '3 Bedroom'])[(s.unit_num % 4) + 1] = '2 Bedroom' THEN 2
                ELSE 3
            END,
            CASE 
                WHEN (ARRAY['Studio', '1 Bedroom', '2 Bedroom', '3 Bedroom'])[(s.unit_num % 4) + 1] = 'Studio' THEN 1
                WHEN (ARRAY['Studio', '1 Bedroom', '2 Bedroom', '3 Bedroom'])[(s.unit_num % 4) + 1] = '1 Bedroom' THEN 1
                WHEN (ARRAY['Studio', '1 Bedroom', '2 Bedroom', '3 Bedroom'])[(s.unit_num % 4) + 1] = '2 Bedroom' THEN 2
                ELSE 2.5
            END,
            CASE 
                WHEN (ARRAY['Studio', '1 Bedroom', '2 Bedroom', '3 Bedroom'])[(s.unit_num % 4) + 1] = 'Studio' THEN 450
                WHEN (ARRAY['Studio', '1 Bedroom', '2 Bedroom', '3 Bedroom'])[(s.unit_num % 4) + 1] = '1 Bedroom' THEN 650
                WHEN (ARRAY['Studio', '1 Bedroom', '2 Bedroom', '3 Bedroom'])[(s.unit_num % 4) + 1] = '2 Bedroom' THEN 900
                ELSE 1200
            END,
            CASE 
                WHEN p.name = 'Kileleshwa Heights' THEN 
                    CASE (ARRAY['Studio', '1 Bedroom', '2 Bedroom', '3 Bedroom'])[(s.unit_num % 4) + 1]
                        WHEN 'Studio' THEN 15000
                        WHEN '1 Bedroom' THEN 25000
                        WHEN '2 Bedroom' THEN 35000
                        ELSE 45000
                    END
                WHEN p.name = 'Westlands Square' THEN 
                    CASE (ARRAY['Studio', '1 Bedroom', '2 Bedroom', '3 Bedroom'])[(s.unit_num % 4) + 1]
                        WHEN 'Studio' THEN 18000
                        WHEN '1 Bedroom' THEN 28000
                        WHEN '2 Bedroom' THEN 38000
                        ELSE 48000
                    END
                WHEN p.name = 'Karen Gardens' THEN 
                    CASE (ARRAY['Studio', '1 Bedroom', '2 Bedroom', '3 Bedroom'])[(s.unit_num % 4) + 1]
                        WHEN 'Studio' THEN 20000
                        WHEN '1 Bedroom' THEN 30000
                        WHEN '2 Bedroom' THEN 40000
                        ELSE 55000
                    END
                WHEN p.name = 'Langata View' THEN 
                    CASE (ARRAY['Studio', '1 Bedroom', '2 Bedroom', '3 Bedroom'])[(s.unit_num % 4) + 1]
                        WHEN 'Studio' THEN 12000
                        WHEN '1 Bedroom' THEN 20000
                        WHEN '2 Bedroom' THEN 28000
                        ELSE 35000
                    END
                ELSE
                    CASE (ARRAY['Studio', '1 Bedroom', '2 Bedroom', '3 Bedroom'])[(s.unit_num % 4) + 1]
                        WHEN 'Studio' THEN 10000
                        WHEN '1 Bedroom' THEN 18000
                        WHEN '2 Bedroom' THEN 25000
                        ELSE 30000
                    END
            END,
            CASE 
                WHEN p.name = 'Kileleshwa Heights' THEN 50000
                WHEN p.name = 'Westlands Square' THEN 55000
                WHEN p.name = 'Karen Gardens' THEN 60000
                WHEN p.name = 'Langata View' THEN 40000
                ELSE 35000
            END,
            (ARRAY['occupied', 'occupied', 'occupied', 'occupied', 'occupied', 'occupied', 'occupied', 'occupied', 'vacant', 'vacant'])[s.unit_num],
            CASE 
                WHEN p.name = 'Karen Gardens' THEN 'Spacious townhouse with private garden'
                ELSE 'Well-maintained apartment unit'
            END,
            ARRAY['Balcony', 'Built-in Wardrobes', 'Tiled Floors']
        FROM public.properties p, generate_series(1, 10) AS s(unit_num)
        WHERE p.name IN ('Kileleshwa Heights', 'Westlands Square', 'Karen Gardens', 'Langata View', 'Kasarani Estate');

        -- Insert dummy tenants with Kenyan names
        INSERT INTO public.tenants (first_name, last_name, email, phone, employment_status, employer_name, monthly_income, emergency_contact_name, emergency_contact_phone) VALUES
        ('Wanjiku', 'Kamau', 'wanjiku.kamau@gmail.com', '+254 722 123 456', 'Employed', 'Safaricom Ltd', 85000, 'Grace Kamau', '+254 722 123 457'),
        ('David', 'Ochieng', 'david.ochieng@gmail.com', '+254 733 234 567', 'Self-Employed', 'Ochieng Consultancy', 120000, 'Mary Ochieng', '+254 733 234 568'),
        ('Fatuma', 'Hassan', 'fatuma.hassan@gmail.com', '+254 744 345 678', 'Employed', 'Kenya Airways', 95000, 'Ahmed Hassan', '+254 744 345 679'),
        ('John', 'Mwangi', 'john.mwangi@gmail.com', '+254 755 456 789', 'Employed', 'Equity Bank', 110000, 'Jane Mwangi', '+254 755 456 790'),
        ('Aisha', 'Abdi', 'aisha.abdi@gmail.com', '+254 766 567 890', 'Self-Employed', 'Abdi Trading', 75000, 'Omar Abdi', '+254 766 567 891'),
        ('Peter', 'Kiprotich', 'peter.kiprotich@gmail.com', '+254 777 678 901', 'Employed', 'KCB Bank', 88000, 'Susan Kiprotich', '+254 777 678 902'),
        ('Grace', 'Wanjiru', 'grace.wanjiru@gmail.com', '+254 788 789 012', 'Employed', 'Coca Cola', 92000, 'Paul Wanjiru', '+254 788 789 013'),
        ('Michael', 'Otieno', 'michael.otieno@gmail.com', '+254 799 890 123', 'Self-Employed', 'Otieno Enterprises', 105000, 'Catherine Otieno', '+254 799 890 124'),
        ('Esther', 'Njeri', 'esther.njeri@gmail.com', '+254 710 901 234', 'Employed', 'Nation Media Group', 78000, 'James Njeri', '+254 710 901 235'),
        ('Samuel', 'Kipchoge', 'samuel.kipchoge@gmail.com', '+254 721 012 345', 'Employed', 'Standard Chartered', 125000, 'Ruth Kipchoge', '+254 721 012 346');

        RAISE NOTICE 'Inserted dummy properties, units, and tenants';
    ELSE
        RAISE NOTICE 'Properties, units, or tenants tables do not exist yet, skipping data insertion';
    END IF;
END $$;
