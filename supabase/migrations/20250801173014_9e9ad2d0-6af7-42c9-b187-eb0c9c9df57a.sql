-- Insert dummy properties with Kenyan data
INSERT INTO public.properties (name, address, city, state, zip_code, country, property_type, total_units, description, amenities) VALUES
('Kileleshwa Heights', 'Kileleshwa Road', 'Nairobi', 'Nairobi', '00100', 'Kenya', 'Apartment', 10, 'Modern apartments in upscale Kileleshwa with parking and security', ARRAY['Parking', 'Security', 'Water Backup', 'Generator']),
('Westlands Square', 'Woodvale Grove', 'Nairobi', 'Nairobi', '00100', 'Kenya', 'Apartment', 10, 'Prime location apartments near Westlands with mall access', ARRAY['Mall Access', 'Parking', 'Security', 'Elevator']),
('Karen Gardens', 'Karen Road', 'Nairobi', 'Nairobi', '00502', 'Kenya', 'Townhouse', 10, 'Serene townhouses in Karen with garden spaces', ARRAY['Garden', 'Parking', 'Security', 'Swimming Pool']),
('Langata View', 'Langata Road', 'Nairobi', 'Nairobi', '00509', 'Kenya', 'Apartment', 10, 'Affordable housing with great views of Ngong Hills', ARRAY['Great Views', 'Parking', 'Security', 'Playground']),
('Kasarani Estate', 'Thika Road', 'Nairobi', 'Nairobi', '00618', 'Kenya', 'Apartment', 10, 'Family-friendly apartments near Kasarani Stadium', ARRAY['Stadium Access', 'Parking', 'Security', 'Shopping Center']);

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
('Samuel', 'Kipchoge', 'samuel.kipchoge@gmail.com', '+254 721 012 345', 'Employed', 'Standard Chartered', 125000, 'Ruth Kipchoge', '+254 721 012 346'),
('Mercy', 'Akinyi', 'mercy.akinyi@gmail.com', '+254 732 123 456', 'Self-Employed', 'Akinyi Fashions', 68000, 'Joseph Akinyi', '+254 732 123 457'),
('Daniel', 'Mutua', 'daniel.mutua@gmail.com', '+254 743 234 567', 'Employed', 'KPMG Kenya', 115000, 'Agnes Mutua', '+254 743 234 568'),
('Rahab', 'Chebet', 'rahab.chebet@gmail.com', '+254 754 345 678', 'Employed', 'Deloitte', 98000, 'Moses Chebet', '+254 754 345 679'),
('Kevin', 'Mbugua', 'kevin.mbugua@gmail.com', '+254 765 456 789', 'Self-Employed', 'Mbugua Tech Solutions', 80000, 'Lucy Mbugua', '+254 765 456 790'),
('Lydia', 'Waweru', 'lydia.waweru@gmail.com', '+254 776 567 890', 'Employed', 'Unilever Kenya', 87000, 'Simon Waweru', '+254 776 567 891'),
('Francis', 'Macharia', 'francis.macharia@gmail.com', '+254 787 678 901', 'Employed', 'Barclays Bank', 102000, 'Joyce Macharia', '+254 787 678 902'),
('Rebecca', 'Mukiri', 'rebecca.mukiri@gmail.com', '+254 798 789 012', 'Self-Employed', 'Mukiri Catering', 65000, 'Stephen Mukiri', '+254 798 789 013'),
('Anthony', 'Koech', 'anthony.koech@gmail.com', '+254 709 890 123', 'Employed', 'PwC Kenya', 118000, 'Margaret Koech', '+254 709 890 124'),
('Caroline', 'Wachira', 'caroline.wachira@gmail.com', '+254 720 901 234', 'Employed', 'East African Breweries', 89000, 'Robert Wachira', '+254 720 901 235'),
('George', 'Owino', 'george.owino@gmail.com', '+254 731 012 345', 'Self-Employed', 'Owino Motors', 95000, 'Florence Owino', '+254 731 012 346'),
('Pauline', 'Gathoni', 'pauline.gathoni@gmail.com', '+254 742 123 456', 'Employed', 'Kenya Commercial Bank', 84000, 'Patrick Gathoni', '+254 742 123 457'),
('Vincent', 'Kinyua', 'vincent.kinyua@gmail.com', '+254 753 234 567', 'Employed', 'BAT Kenya', 91000, 'Rose Kinyua', '+254 753 234 568'),
('Josephine', 'Muthoni', 'josephine.muthoni@gmail.com', '+254 764 345 678', 'Self-Employed', 'Muthoni Boutique', 72000, 'Thomas Muthoni', '+254 764 345 679'),
('Dennis', 'Kiprop', 'dennis.kiprop@gmail.com', '+254 775 456 789', 'Employed', 'IBM Kenya', 135000, 'Nancy Kiprop', '+254 775 456 790'),
('Jane', 'Waithera', 'jane.waithera@gmail.com', '+254 786 567 890', 'Employed', 'Google Kenya', 145000, 'Andrew Waithera', '+254 786 567 891'),
('Alex', 'Maina', 'alex.maina@gmail.com', '+254 797 678 901', 'Self-Employed', 'Maina Construction', 108000, 'Helen Maina', '+254 797 678 902'),
('Sarah', 'Chepkemoi', 'sarah.chepkemoi@gmail.com', '+254 708 789 012', 'Employed', 'Microsoft Kenya', 128000, 'Evans Chepkemoi', '+254 708 789 013'),
('Brian', 'Gitau', 'brian.gitau@gmail.com', '+254 719 890 123', 'Employed', 'Oracle Kenya', 122000, 'Diana Gitau', '+254 719 890 124'),
('Faith', 'Nyokabi', 'faith.nyokabi@gmail.com', '+254 730 901 234', 'Self-Employed', 'Nyokabi Events', 76000, 'Philip Nyokabi', '+254 730 901 235'),
('Martin', 'Langat', 'martin.langat@gmail.com', '+254 741 012 345', 'Employed', 'Tusker Mattresses', 82000, 'Beatrice Langat', '+254 741 012 346'),
('Priscilla', 'Wanjala', 'priscilla.wanjala@gmail.com', '+254 752 123 456', 'Employed', 'Kenya Power', 93000, 'Lawrence Wanjala', '+254 752 123 457'),
('Timothy', 'Rotich', 'timothy.rotich@gmail.com', '+254 763 234 567', 'Self-Employed', 'Rotich Dairy Farm', 85000, 'Eunice Rotich', '+254 763 234 568'),
('Eunice', 'Mukami', 'eunice.mukami@gmail.com', '+254 774 345 678', 'Employed', 'Nairobi Hospital', 96000, 'Francis Mukami', '+254 774 345 679'),
('Charles', 'Omondi', 'charles.omondi@gmail.com', '+254 785 456 789', 'Employed', 'Chandaria Industries', 88000, 'Violet Omondi', '+254 785 456 790'),
('Naomi', 'Wanjiku', 'naomi.wanjiku@gmail.com', '+254 796 567 890', 'Self-Employed', 'Wanjiku Hair Salon', 69000, 'Isaac Wanjiku', '+254 796 567 891'),
('Joseph', 'Keter', 'joseph.keter@gmail.com', '+254 707 678 901', 'Employed', 'Kenya Pipeline Company', 99000, 'Gladys Keter', '+254 707 678 902'),
('Millicent', 'Wangari', 'millicent.wangari@gmail.com', '+254 718 789 012', 'Employed', 'Kenya Tea Development Agency', 86000, 'David Wangari', '+254 718 789 013'),
('Edwin', 'Mwangi', 'edwin.mwangi@gmail.com', '+254 729 890 123', 'Self-Employed', 'Mwangi Hardware', 74000, 'Ann Mwangi', '+254 729 890 124'),
('Lilian', 'Chege', 'lilian.chege@gmail.com', '+254 740 901 234', 'Employed', 'Brookside Dairy', 90000, 'Mark Chege', '+254 740 901 235'),
('Ian', 'Kimanzi', 'ian.kimanzi@gmail.com', '+254 751 012 345', 'Employed', 'Kengen', 103000, 'Cynthia Kimanzi', '+254 751 012 346');