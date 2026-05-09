-- Insert units for each property (10 units each, 80% occupancy)
DO $$
DECLARE
    property_record RECORD;
    unit_num INTEGER;
    unit_types TEXT[] := ARRAY['Studio', '1 Bedroom', '2 Bedroom', '3 Bedroom'];
    statuses TEXT[] := ARRAY['occupied', 'occupied', 'occupied', 'occupied', 'occupied', 'occupied', 'occupied', 'occupied', 'vacant', 'vacant'];
BEGIN
    FOR property_record IN 
        SELECT id, name FROM public.properties 
        WHERE name IN ('Kileleshwa Heights', 'Westlands Square', 'Karen Gardens', 'Langata View', 'Kasarani Estate')
    LOOP
        FOR unit_num IN 1..10 LOOP
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
            ) VALUES (
                CASE 
                    WHEN property_record.name = 'Karen Gardens' THEN 'TH' || unit_num::text
                    ELSE unit_num::text
                END,
                unit_types[(unit_num % 4) + 1],
                property_record.id,
                CASE 
                    WHEN unit_types[(unit_num % 4) + 1] = 'Studio' THEN 0
                    WHEN unit_types[(unit_num % 4) + 1] = '1 Bedroom' THEN 1
                    WHEN unit_types[(unit_num % 4) + 1] = '2 Bedroom' THEN 2
                    ELSE 3
                END,
                CASE 
                    WHEN unit_types[(unit_num % 4) + 1] = 'Studio' THEN 1
                    WHEN unit_types[(unit_num % 4) + 1] = '1 Bedroom' THEN 1
                    WHEN unit_types[(unit_num % 4) + 1] = '2 Bedroom' THEN 2
                    ELSE 2.5
                END,
                CASE 
                    WHEN unit_types[(unit_num % 4) + 1] = 'Studio' THEN 450
                    WHEN unit_types[(unit_num % 4) + 1] = '1 Bedroom' THEN 650
                    WHEN unit_types[(unit_num % 4) + 1] = '2 Bedroom' THEN 900
                    ELSE 1200
                END,
                CASE 
                    WHEN property_record.name = 'Kileleshwa Heights' THEN 
                        CASE unit_types[(unit_num % 4) + 1]
                            WHEN 'Studio' THEN 15000
                            WHEN '1 Bedroom' THEN 25000
                            WHEN '2 Bedroom' THEN 35000
                            ELSE 45000
                        END
                    WHEN property_record.name = 'Westlands Square' THEN 
                        CASE unit_types[(unit_num % 4) + 1]
                            WHEN 'Studio' THEN 18000
                            WHEN '1 Bedroom' THEN 28000
                            WHEN '2 Bedroom' THEN 38000
                            ELSE 48000
                        END
                    WHEN property_record.name = 'Karen Gardens' THEN 
                        CASE unit_types[(unit_num % 4) + 1]
                            WHEN 'Studio' THEN 20000
                            WHEN '1 Bedroom' THEN 30000
                            WHEN '2 Bedroom' THEN 40000
                            ELSE 55000
                        END
                    WHEN property_record.name = 'Langata View' THEN 
                        CASE unit_types[(unit_num % 4) + 1]
                            WHEN 'Studio' THEN 12000
                            WHEN '1 Bedroom' THEN 20000
                            WHEN '2 Bedroom' THEN 28000
                            ELSE 35000
                        END
                    ELSE -- Kasarani Estate
                        CASE unit_types[(unit_num % 4) + 1]
                            WHEN 'Studio' THEN 10000
                            WHEN '1 Bedroom' THEN 18000
                            WHEN '2 Bedroom' THEN 25000
                            ELSE 30000
                        END
                END,
                CASE 
                    WHEN property_record.name = 'Kileleshwa Heights' THEN 50000
                    WHEN property_record.name = 'Westlands Square' THEN 55000
                    WHEN property_record.name = 'Karen Gardens' THEN 60000
                    WHEN property_record.name = 'Langata View' THEN 40000
                    ELSE 35000
                END,
                statuses[unit_num],
                CASE 
                    WHEN property_record.name = 'Karen Gardens' THEN 'Spacious townhouse with private garden'
                    ELSE 'Well-maintained apartment unit'
                END,
                ARRAY['Balcony', 'Built-in Wardrobes', 'Tiled Floors']
            );
        END LOOP;
    END LOOP;
END $$;