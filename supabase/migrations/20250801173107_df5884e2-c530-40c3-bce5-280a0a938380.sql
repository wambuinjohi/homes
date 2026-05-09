-- Insert dummy properties (5 blocks/buildings)
INSERT INTO properties (name, description, address, city, state, zip_code, country, property_type, total_units, owner_id) VALUES
('Kileleshwa Gardens', 'Modern residential apartments in Kileleshwa', 'Kileleshwa Road', 'Nairobi', 'Nairobi County', '00100', 'Kenya', 'Residential', 10, auth.uid()),
('Westlands Towers', 'High-rise commercial and residential complex', 'Waiyaki Way', 'Nairobi', 'Nairobi County', '00600', 'Kenya', 'Mixed-Use', 10, auth.uid()),
('Karen Heights', 'Luxury apartments in Karen suburb', 'Karen Road', 'Nairobi', 'Nairobi County', '00502', 'Kenya', 'Residential', 10, auth.uid()),
('Eastleigh Plaza', 'Commercial and residential units', 'General Waruinge Street', 'Nairobi', 'Nairobi County', '00610', 'Kenya', 'Commercial', 10, auth.uid()),
('Lavington Courts', 'Premium residential complex', 'Hatheru Road', 'Nairobi', 'Nairobi County', '00506', 'Kenya', 'Residential', 10, auth.uid());

-- Insert dummy units (10 units per property, 80% occupancy = 8 occupied, 2 vacant per property)
INSERT INTO units (unit_number, unit_type, property_id, bedrooms, bathrooms, square_feet, rent_amount, security_deposit, status, description) 
SELECT 
    CONCAT(block_num, LPAD(unit_num::text, 2, '0')) as unit_number,
    CASE 
        WHEN unit_num <= 2 THEN '1 Bedroom'
        WHEN unit_num <= 6 THEN '2 Bedroom' 
        WHEN unit_num <= 9 THEN '3 Bedroom'
        ELSE 'Penthouse'
    END as unit_type,
    p.id as property_id,
    CASE 
        WHEN unit_num <= 2 THEN 1
        WHEN unit_num <= 6 THEN 2
        WHEN unit_num <= 9 THEN 3 
        ELSE 4
    END as bedrooms,
    CASE 
        WHEN unit_num <= 2 THEN 1
        WHEN unit_num <= 6 THEN 2
        WHEN unit_num <= 9 THEN 2
        ELSE 3
    END as bathrooms,
    CASE 
        WHEN unit_num <= 2 THEN 650
        WHEN unit_num <= 6 THEN 950
        WHEN unit_num <= 9 THEN 1200
        ELSE 1800
    END as square_feet,
    CASE 
        WHEN unit_num <= 2 THEN 25000
        WHEN unit_num <= 6 THEN 45000
        WHEN unit_num <= 9 THEN 65000
        ELSE 120000
    END as rent_amount,
    CASE 
        WHEN unit_num <= 2 THEN 50000
        WHEN unit_num <= 6 THEN 90000
        WHEN unit_num <= 9 THEN 130000
        ELSE 240000
    END as security_deposit,
    CASE 
        WHEN unit_num <= 8 THEN 'occupied'
        ELSE 'vacant'
    END as status,
    CASE 
        WHEN unit_num <= 2 THEN 'Cozy one-bedroom unit with modern amenities'
        WHEN unit_num <= 6 THEN 'Spacious two-bedroom apartment with balcony'
        WHEN unit_num <= 9 THEN 'Three-bedroom family unit with garden view'
        ELSE 'Luxury penthouse with panoramic city views'
    END as description
FROM properties p,
     generate_series(1, 5) as block_num,
     generate_series(1, 10) as unit_num
WHERE p.name IN ('Kileleshwa Gardens', 'Westlands Towers', 'Karen Heights', 'Eastleigh Plaza', 'Lavington Courts')
ORDER BY p.name, unit_num;

-- Insert dummy tenants (40 tenants for the 40 occupied units)
INSERT INTO tenants (first_name, last_name, email, phone, emergency_contact_name, emergency_contact_phone, employment_status, employer_name, monthly_income, user_id) VALUES
('Wanjiku', 'Kamau', 'wanjiku.kamau@email.com', '+254712345001', 'Peter Kamau', '+254722345001', 'Employed', 'Safaricom Ltd', 85000, null),
('David', 'Kiplagat', 'david.kiplagat@email.com', '+254712345002', 'Grace Kiplagat', '+254722345002', 'Employed', 'Kenya Airways', 95000, null),
('Grace', 'Wanjiru', 'grace.wanjiru@email.com', '+254712345003', 'John Wanjiru', '+254722345003', 'Self-Employed', 'Freelance Consultant', 120000, null),
('Peter', 'Mwangi', 'peter.mwangi@email.com', '+254712345004', 'Mary Mwangi', '+254722345004', 'Employed', 'Equity Bank', 110000, null),
('Mary', 'Achieng', 'mary.achieng@email.com', '+254712345005', 'James Achieng', '+254722345005', 'Employed', 'KCB Bank', 75000, null),
('James', 'Njoroge', 'james.njoroge@email.com', '+254712345006', 'Susan Njoroge', '+254722345006', 'Employed', 'Coca-Cola Africa', 88000, null),
('Susan', 'Cheptoo', 'susan.cheptoo@email.com', '+254712345007', 'Michael Cheptoo', '+254722345007', 'Self-Employed', 'Digital Marketing', 65000, null),
('Michael', 'Otieno', 'michael.otieno@email.com', '+254712345008', 'Elizabeth Otieno', '+254722345008', 'Employed', 'Nairobi Hospital', 105000, null),
('Elizabeth', 'Kariuki', 'elizabeth.kariuki@email.com', '+254712345009', 'Francis Kariuki', '+254722345009', 'Employed', 'KPMG Kenya', 125000, null),
('Francis', 'Mutua', 'francis.mutua@email.com', '+254712345010', 'Anne Mutua', '+254722345010', 'Employed', 'Standard Chartered', 98000, null),
('Anne', 'Wafula', 'anne.wafula@email.com', '+254712345011', 'Robert Wafula', '+254722345011', 'Self-Employed', 'Import/Export', 150000, null),
('Robert', 'Kiprotich', 'robert.kiprotich@email.com', '+254712345012', 'Joyce Kiprotich', '+254722345012', 'Employed', 'Nation Media Group', 82000, null),
('Joyce', 'Muthoni', 'joyce.muthoni@email.com', '+254712345013', 'Samuel Muthoni', '+254722345013', 'Employed', 'Tusker Mattresses', 70000, null),
('Samuel', 'Ochieng', 'samuel.ochieng@email.com', '+254712345014', 'Mercy Ochieng', '+254722345014', 'Employed', 'East African Breweries', 92000, null),
('Mercy', 'Koech', 'mercy.koech@email.com', '+254712345015', 'Daniel Koech', '+254722345015', 'Self-Employed', 'Real Estate', 180000, null),
('Daniel', 'Macharia', 'daniel.macharia@email.com', '+254712345016', 'Faith Macharia', '+254722345016', 'Employed', 'Co-operative Bank', 85000, null),
('Faith', 'Juma', 'faith.juma@email.com', '+254712345017', 'Joseph Juma', '+254722345017', 'Employed', 'Bamburi Cement', 78000, null),
('Joseph', 'Kimani', 'joseph.kimani@email.com', '+254712345018', 'Esther Kimani', '+254722345018', 'Employed', 'Kenya Power', 88000, null),
('Esther', 'Nyong', 'esther.nyong@email.com', '+254712345019', 'Martin Nyong', '+254722345019', 'Self-Employed', 'Fashion Design', 95000, null),
('Martin', 'Karanja', 'martin.karanja@email.com', '+254712345020', 'Helen Karanja', '+254722345020', 'Employed', 'Barclays Bank', 102000, null),
('Helen', 'Cheruiyot', 'helen.cheruiyot@email.com', '+254712345021', 'Paul Cheruiyot', '+254722345021', 'Employed', 'Kenya Commercial Bank', 89000, null),
('Paul', 'Wekesa', 'paul.wekesa@email.com', '+254712345022', 'Rose Wekesa', '+254722345022', 'Self-Employed', 'IT Solutions', 115000, null),
('Rose', 'Kibet', 'rose.kibet@email.com', '+254712345023', 'George Kibet', '+254722345023', 'Employed', 'Safaricom', 94000, null),
('George', 'Munyua', 'george.munyua@email.com', '+254712345024', 'Lydia Munyua', '+254722345024', 'Employed', 'Telkom Kenya', 87000, null),
('Lydia', 'Okoth', 'lydia.okoth@email.com', '+254712345025', 'Vincent Okoth', '+254722345025', 'Self-Employed', 'Photography', 72000, null),
('Vincent', 'Ruto', 'vincent.ruto@email.com', '+254712345026', 'Catherine Ruto', '+254722345026', 'Employed', 'Kenya Airways', 96000, null),
('Catherine', 'Musyoka', 'catherine.musyoka@email.com', '+254712345027', 'Anthony Musyoka', '+254722345027', 'Employed', 'Nation Media', 83000, null),
('Anthony', 'Langat', 'anthony.langat@email.com', '+254712345028', 'Priscilla Langat', '+254722345028', 'Self-Employed', 'Agriculture', 68000, null),
('Priscilla', 'Githinji', 'priscilla.githinji@email.com', '+254712345029', 'Simon Githinji', '+254722345029', 'Employed', 'NHIF', 91000, null),
('Simon', 'Owino', 'simon.owino@email.com', '+254712345030', 'Monica Owino', '+254722345030', 'Employed', 'KRA', 99000, null),
('Monica', 'Bett', 'monica.bett@email.com', '+254712345031', 'Thomas Bett', '+254722345031', 'Self-Employed', 'Catering Services', 76000, null),
('Thomas', 'Ndungu', 'thomas.ndungu@email.com', '+254712345032', 'Jane Ndungu', '+254722345032', 'Employed', 'Kenya Medical Supplies', 84000, null),
('Jane', 'Rotich', 'jane.rotich@email.com', '+254712345033', 'Patrick Rotich', '+254722345033', 'Employed', 'Central Bank of Kenya', 118000, null),
('Patrick', 'Mburu', 'patrick.mburu@email.com', '+254712345034', 'Agnes Mburu', '+254722345034', 'Self-Employed', 'Transport Business', 105000, null),
('Agnes', 'Chebet', 'agnes.chebet@email.com', '+254712345035', 'Evans Chebet', '+254722345035', 'Employed', 'Kenya Bureau of Standards', 87000, null),
('Evans', 'Wamalwa', 'evans.wamalwa@email.com', '+254712345036', 'Winnie Wamalwa', '+254722345036', 'Employed', 'Kenya Pipeline Company', 93000, null),
('Winnie', 'Sang', 'winnie.sang@email.com', '+254712345037', 'Brian Sang', '+254722345037', 'Self-Employed', 'Graphic Design', 81000, null),
('Brian', 'Kibe', 'brian.kibe@email.com', '+254712345038', 'Stella Kibe', '+254722345038', 'Employed', 'Kenya Forest Service', 79000, null),
('Stella', 'Nzomo', 'stella.nzomo@email.com', '+254712345039', 'Felix Nzomo', '+254722345039', 'Employed', 'Kenya Wildlife Service', 86000, null),
('Felix', 'Tarus', 'felix.tarus@email.com', '+254712345040', 'Beatrice Tarus', '+254722345040', 'Self-Employed', 'Construction', 112000, null);