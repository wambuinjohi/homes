-- Migration: 20250731234451_849f2617-760c-4d6e-87e5-dd18fc9599a6.sql

-- Drop the existing enum and recreate with rental management roles
DROP TYPE IF EXISTS public.app_role CASCADE;

CREATE TYPE public.app_role AS ENUM ('Admin', 'Landlord', 'Manager', 'Agent', 'Tenant');

-- Recreate the user_roles table with the new enum
DROP TABLE IF EXISTS public.user_roles CASCADE;

CREATE TABLE public.user_roles (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
    role app_role NOT NULL,
    UNIQUE (user_id, role)
);

-- Enable RLS
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

-- Recreate the has_role function
CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role app_role)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles
    WHERE user_id = _user_id
      AND role = _role
  )
$$;

-- Update the trigger function to assign 'Agent' as default role
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = ''
AS $$
BEGIN
  INSERT INTO public.profiles (id, first_name, last_name, phone)
  VALUES (
    NEW.id, 
    NEW.raw_user_meta_data ->> 'first_name', 
    NEW.raw_user_meta_data ->> 'last_name',
    NEW.raw_user_meta_data ->> 'phone'
  );
  
  -- Assign default 'Agent' role to new users
  INSERT INTO public.user_roles (user_id, role)
  VALUES (NEW.id, 'Agent');
  
  RETURN NEW;
END;
$$;

-- Create RLS policies for user_roles
CREATE POLICY "Users can view their own roles" ON public.user_roles
FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Admins can view all roles" ON public.user_roles
FOR SELECT USING (public.has_role(auth.uid(), 'Admin'));

CREATE POLICY "Admins can manage all roles" ON public.user_roles
FOR ALL USING (public.has_role(auth.uid(), 'Admin'));


-- Migration: 20250801153853_a4eb4b61-41d6-41de-97a2-f12f215838f2.sql

-- Check if profiles table exists before attempting to insert
DO $$
DECLARE
    user_exists BOOLEAN;
    table_exists BOOLEAN;
BEGIN
    -- Check if the profiles table exists
    SELECT EXISTS (
        SELECT 1 FROM information_schema.tables
        WHERE table_name = 'profiles' AND table_schema = 'public'
    ) INTO table_exists;

    -- Only proceed if profiles table exists
    IF table_exists THEN
        -- Check if the user exists in auth.users but not in profiles
        SELECT EXISTS (
            SELECT 1 FROM auth.users
            WHERE id = 'a53f69a5-104e-489b-9b0a-48a56d6b011d'
            AND id NOT IN (SELECT id FROM public.profiles)
        ) INTO user_exists;

        -- If user exists but has no profile, create one
        IF user_exists THEN
            INSERT INTO public.profiles (id, first_name, last_name, phone, email)
            SELECT
                u.id,
                u.raw_user_meta_data ->> 'first_name' as first_name,
                u.raw_user_meta_data ->> 'last_name' as last_name,
                u.raw_user_meta_data ->> 'phone' as phone,
                u.email
            FROM auth.users u
            WHERE u.id = 'a53f69a5-104e-489b-9b0a-48a56d6b011d';

            RAISE NOTICE 'Created profile for existing user';
        END IF;
    ELSE
        RAISE NOTICE 'Profiles table does not exist yet, skipping profile creation';
    END IF;
END $$;



-- Migration: 20250801173014_9e9ad2d0-6af7-42c9-b187-eb0c9c9df57a.sql

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



-- Migration: 20250801173047_f45ab3eb-0f51-4c38-a942-b6b55834d9b6.sql

-- Insert dummy properties with Kenyan data

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


-- Migration: 20250801173107_df5884e2-c530-40c3-bce5-280a0a938380.sql

-- Insert dummy properties (5 blocks/buildings)

-- Insert dummy units (10 units per property, 80% occupancy = 8 occupied, 2 vacant per property)

-- Insert dummy tenants (40 tenants for the 40 occupied units)


-- Migration: 20250801173124_a2d43254-229b-4376-b590-1c799c0da6bf.sql

-- Clear existing data and insert fresh dummy data
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


-- Migration: 20250801173826_895f5184-c95e-4717-8581-bec4ba2751ae.sql

-- Insert dummy tenants with Kenyan names (smaller subset)


-- Migration: 20250801191849_ad8f41b7-f30d-4830-a1cb-0f8cec97a9d6.sql

-- Add profession field to tenants table
ALTER TABLE public.tenants ADD COLUMN profession text;

-- Add national_id field to tenants table  
ALTER TABLE public.tenants ADD COLUMN national_id text;

-- Update existing tenant records with sample data


-- Migration: 20250801195303_9c9d1ab8-28a6-470a-af0b-daeae99333df.sql

-- Add comprehensive dummy data for all entities

-- Insert sample properties

-- Insert sample units

-- Insert sample tenants

-- Insert sample leases

-- Insert sample payments

-- Insert sample expenses

-- Insert sample invoices


-- Migration: 20250801200845_935ac44d-fcc8-43e6-8737-a40a18f4b178.sql

-- Add comprehensive dummy data for all entities with proper UUIDs

-- Insert sample properties

-- Insert sample units

-- Insert sample tenants

-- Insert sample leases

-- Insert sample payments

-- Insert sample expenses


-- Migration: 20250801201738_e46b53b7-4a45-4f77-af10-4d6fa26eabcc.sql

-- Remove all dummy data from the system







-- Ensure the current user has an Agent role (if they don't have any role)


-- Migration: 20250801205104_49c295b4-d9b0-43ac-90e6-d09522cd2e80.sql

-- First, check if the user exists and get their user_id
-- Then assign them the Admin role

-- Find the user by email and assign Admin role

-- If the above didn't insert anything, it means either:
-- 1. The user doesn't exist in profiles table
-- 2. They already have Admin role
-- Let's also remove any other roles they might have to ensure they only have Admin


-- Migration: 20250801224024_1f2264f0-a80b-4a79-bc85-68dad1fba042.sql

-- Add payment reference and invoice number to payments table
ALTER TABLE public.payments 
ADD COLUMN payment_reference TEXT,
ADD COLUMN invoice_number TEXT;

-- Create maintenance_requests table for tenant maintenance requests
CREATE TABLE public.maintenance_requests (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id UUID NOT NULL,
  property_id UUID NOT NULL,
  unit_id UUID,
  title TEXT NOT NULL,
  description TEXT NOT NULL,
  priority TEXT NOT NULL DEFAULT 'medium',
  status TEXT NOT NULL DEFAULT 'pending',
  category TEXT NOT NULL,
  submitted_date TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  scheduled_date TIMESTAMP WITH TIME ZONE,
  completed_date TIMESTAMP WITH TIME ZONE,
  assigned_to UUID,
  cost NUMERIC,
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.maintenance_requests ENABLE ROW LEVEL SECURITY;

-- Create policies for maintenance requests
CREATE POLICY "Property stakeholders can manage maintenance requests" 
ON public.maintenance_requests 
FOR ALL 
USING ((EXISTS ( SELECT 1
   FROM properties p
  WHERE ((p.id = maintenance_requests.property_id) AND ((p.owner_id = auth.uid()) OR (p.manager_id = auth.uid()))))) OR has_role(auth.uid(), 'Admin'::app_role) OR has_role(auth.uid(), 'Landlord'::app_role));

CREATE POLICY "Tenants can create and view their own maintenance requests" 
ON public.maintenance_requests 
FOR ALL 
USING (EXISTS ( SELECT 1
   FROM tenants t
  WHERE ((t.id = maintenance_requests.tenant_id) AND (t.user_id = auth.uid()))));

-- Add trigger for maintenance requests timestamps
CREATE TRIGGER update_maintenance_requests_updated_at
BEFORE UPDATE ON public.maintenance_requests
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();


-- Migration: 20250803083149_0ca002f7-56e1-4133-9a1e-84b661c423e0.sql

-- Add sample tenants

-- Add sample leases (using existing properties and units)

-- Add sample invoices

-- Add sample payments

-- Add sample expenses


-- Migration: 20250803083705_140e9b33-93f0-424d-8eb5-0316923752d1.sql

-- First, let's get some units to work with

-- Add some invoices for October 2024 (some paid, some pending, some overdue)

-- Add some payments for paid invoices

-- Add some September invoices that are overdue

-- Add some expenses across properties


-- Migration: 20250803104342_0ba2dd0e-3d82-4ac7-b30f-a15622130229.sql

-- Enhanced User & Role Management System

-- Create permissions table for fine-grained access control
CREATE TABLE public.permissions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL UNIQUE,
  description TEXT,
  category TEXT NOT NULL, -- 'users', 'properties', 'maintenance', 'reports', etc.
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Create role_permissions junction table
CREATE TABLE public.role_permissions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  role app_role NOT NULL,
  permission_id UUID NOT NULL REFERENCES public.permissions(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(role, permission_id)
);

-- Create user_sessions table to track login history
CREATE TABLE public.user_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  login_time TIMESTAMPTZ NOT NULL DEFAULT now(),
  logout_time TIMESTAMPTZ,
  ip_address INET,
  user_agent TEXT,
  device_info JSONB,
  location TEXT,
  session_token TEXT,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Create user_activity_logs table for audit trail
CREATE TABLE public.user_activity_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  action TEXT NOT NULL,
  entity_type TEXT, -- 'property', 'tenant', 'maintenance', etc.
  entity_id UUID,
  details JSONB,
  ip_address INET,
  user_agent TEXT,
  performed_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Enable RLS on new tables
ALTER TABLE public.permissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.role_permissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_activity_logs ENABLE ROW LEVEL SECURITY;

-- RLS Policies for permissions
CREATE POLICY "Admins can manage permissions" ON public.permissions
  FOR ALL USING (has_role(auth.uid(), 'Admin'));

-- RLS Policies for role_permissions  
CREATE POLICY "Admins can manage role permissions" ON public.role_permissions
  FOR ALL USING (has_role(auth.uid(), 'Admin'));

-- RLS Policies for user_sessions
CREATE POLICY "Users can view their own sessions" ON public.user_sessions
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Admins can view all sessions" ON public.user_sessions
  FOR SELECT USING (has_role(auth.uid(), 'Admin'));

CREATE POLICY "Users can update their own sessions" ON public.user_sessions
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "System can insert sessions" ON public.user_sessions
  FOR INSERT WITH CHECK (true);

-- RLS Policies for user_activity_logs
CREATE POLICY "Users can view their own activity" ON public.user_activity_logs
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Admins can view all activity" ON public.user_activity_logs
  FOR SELECT USING (has_role(auth.uid(), 'Admin'));

CREATE POLICY "System can insert activity logs" ON public.user_activity_logs
  FOR INSERT WITH CHECK (true);

-- Insert default permissions

-- Assign default permissions to roles

-- Landlord permissions (property management focused)

-- Manager permissions (day-to-day operations)

-- Agent permissions (limited operations)

-- Tenant permissions (self-service)

-- Create function to check if user has specific permission
CREATE OR REPLACE FUNCTION public.has_permission(_user_id uuid, _permission text)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles ur
    JOIN public.role_permissions rp ON ur.role = rp.role
    JOIN public.permissions p ON rp.permission_id = p.id
    WHERE ur.user_id = _user_id
      AND p.name = _permission
  )
$$;

-- Create function to get user permissions
CREATE OR REPLACE FUNCTION public.get_user_permissions(_user_id uuid)
RETURNS TABLE(permission_name text, category text, description text)
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT DISTINCT p.name, p.category, p.description
  FROM public.user_roles ur
  JOIN public.role_permissions rp ON ur.role = rp.role
  JOIN public.permissions p ON rp.permission_id = p.id
  WHERE ur.user_id = _user_id
  ORDER BY p.category, p.name
$$;

-- Create trigger to update user_sessions updated_at
CREATE TRIGGER update_user_sessions_updated_at
  BEFORE UPDATE ON public.user_sessions
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Create function to log user activity
CREATE OR REPLACE FUNCTION public.log_user_activity(
  _user_id uuid,
  _action text,
  _entity_type text DEFAULT NULL,
  _entity_id uuid DEFAULT NULL,
  _details jsonb DEFAULT NULL,
  _ip_address inet DEFAULT NULL,
  _user_agent text DEFAULT NULL
)
RETURNS void
LANGUAGE sql
SECURITY DEFINER
SET search_path = ''
AS $$
  INSERT INTO public.user_activity_logs (
    user_id, action, entity_type, entity_id, details, ip_address, user_agent
  ) VALUES (
    _user_id, _action, _entity_type, _entity_id, _details, _ip_address, _user_agent
  );
$$;


-- Migration: 20250803105233_9b3ea88e-2745-44c7-92bd-b8a9d195b00d.sql

-- Update the handle_new_user function to properly handle admin user creation
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  -- Insert into profiles table
  INSERT INTO public.profiles (id, first_name, last_name, phone, email)
  VALUES (
    NEW.id, 
    NEW.raw_user_meta_data ->> 'first_name', 
    NEW.raw_user_meta_data ->> 'last_name',
    NEW.raw_user_meta_data ->> 'phone',
    NEW.email
  );
  
  -- Assign role based on user metadata, default to 'Agent' if not specified
  INSERT INTO public.user_roles (user_id, role)
  VALUES (
    NEW.id, 
    COALESCE(
      (NEW.raw_user_meta_data ->> 'role')::public.app_role,
      'Agent'::public.app_role
    )
  );
  
  RETURN NEW;
END;
$$;


-- Migration: 20250803105325_313e8337-379a-4df9-8785-79b97ee6974a.sql

-- Update dmwangui@gmail.com user role from Admin to Landlord


-- Migration: 20250803111153_1782fe07-3ed4-485c-9d0c-8a929f54dccc.sql

-- Assign Admin role to the super admin user


-- Migration: 20250803111458_bd5905d7-7bba-44d3-8823-3861c66b6313.sql

-- Create profile for admin user if it doesn't exist

-- Assign Admin role to the super admin user


-- Migration: 20250803112320_e557a658-fd8f-4d0a-8a4c-c1a2927a33bc.sql

-- Create tenant user accounts and assign proper leases

-- Create user accounts for existing tenants in auth.users
-- Note: This inserts into auth.users which requires special handling
-- We'll create a function to handle this properly

CREATE OR REPLACE FUNCTION create_tenant_accounts()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    tenant_record RECORD;
    user_id uuid;
    unit_record RECORD;
BEGIN
    -- Iterate through tenants without user_id
    FOR tenant_record IN 
        SELECT * FROM tenants WHERE user_id IS NULL
    LOOP
        -- Generate a new UUID for the user
        user_id := gen_random_uuid();
        
        -- Create profile record (simulating the auth.users creation)
        INSERT INTO profiles (id, first_name, last_name, email, phone)
        VALUES (
            user_id,
            tenant_record.first_name,
            tenant_record.last_name,
            tenant_record.email,
            tenant_record.phone
        );
        
        -- Update tenant record with user_id
        UPDATE tenants 
        SET user_id = user_id
        WHERE id = tenant_record.id;
        
        -- Assign Tenant role
        INSERT INTO user_roles (user_id, role)
        VALUES (user_id, 'Tenant'::app_role);
        
        -- Find an appropriate unit for this tenant based on their income
        -- For demo purposes, assign them to available units
        SELECT u.id, u.property_id, u.rent_amount
        INTO unit_record
        FROM units u
        WHERE u.status = 'vacant'
        AND u.rent_amount <= (tenant_record.monthly_income * 0.3) -- 30% rule
        ORDER BY u.rent_amount DESC
        LIMIT 1;
        
        -- If no vacant unit found, assign to an occupied one for demo
        IF unit_record.id IS NULL THEN
            SELECT u.id, u.property_id, u.rent_amount
            INTO unit_record
            FROM units u
            WHERE u.rent_amount <= (tenant_record.monthly_income * 0.3)
            ORDER BY RANDOM()
            LIMIT 1;
        END IF;
        
        -- Create lease if unit found
        IF unit_record.id IS NOT NULL THEN
            INSERT INTO leases (
                tenant_id,
                unit_id,
                monthly_rent,
                lease_start_date,
                lease_end_date,
                security_deposit,
                status
            ) VALUES (
                tenant_record.id,
                unit_record.id,
                unit_record.rent_amount,
                '2024-01-01'::date,
                '2024-12-31'::date,
                unit_record.rent_amount * 2, -- 2 months security deposit
                'active'
            );
            
            -- Update unit status to occupied
            UPDATE units 
            SET status = 'occupied'
            WHERE id = unit_record.id;
        END IF;
        
    END LOOP;
END;
$$;

-- Execute the function
SELECT create_tenant_accounts();

-- Drop the function as it's no longer needed
DROP FUNCTION create_tenant_accounts();

-- Create some sample invoices for tenants

-- Create current month invoices

-- Create some payment records for paid invoices

-- Create some maintenance requests from tenants


-- Migration: 20250803194526_df2342dd-67a7-4a49-b524-607f8eabe671.sql

-- Create leases for existing tenants without assignments
-- This will only work if there are vacant units available


-- Migration: 20250803195126_c07cb8d2-0bfa-4c6c-b168-bddbde0fed04.sql

-- Create email logs table to track all emails sent
CREATE TABLE public.email_logs (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  recipient_email text NOT NULL,
  recipient_user_id uuid,
  sender_email text NOT NULL DEFAULT 'noreply@zirahomes.com',
  subject text NOT NULL,
  template_type text, -- 'welcome', 'payment_reminder', 'maintenance_notice', etc.
  status text NOT NULL DEFAULT 'pending', -- 'pending', 'sent', 'delivered', 'failed', 'bounced'
  resend_message_id text, -- Resend's message ID for tracking
  error_message text,
  metadata jsonb, -- Additional data like property_id, tenant_id, etc.
  sent_at timestamp with time zone,
  delivered_at timestamp with time zone,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.email_logs ENABLE ROW LEVEL SECURITY;

-- Create policies
CREATE POLICY "Admins can view all email logs" 
ON public.email_logs 
FOR SELECT 
USING (has_role(auth.uid(), 'Admin'::app_role));

CREATE POLICY "Landlords can view email logs for their tenants" 
ON public.email_logs 
FOR SELECT 
USING (
  has_role(auth.uid(), 'Landlord'::app_role) OR
  has_role(auth.uid(), 'Manager'::app_role) OR
  has_role(auth.uid(), 'Agent'::app_role)
);

CREATE POLICY "System can insert email logs" 
ON public.email_logs 
FOR INSERT 
WITH CHECK (true);

CREATE POLICY "System can update email logs" 
ON public.email_logs 
FOR UPDATE 
USING (true);

-- Add trigger for updated_at
CREATE TRIGGER update_email_logs_updated_at
BEFORE UPDATE ON public.email_logs
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Create index for better performance
CREATE INDEX idx_email_logs_recipient ON public.email_logs(recipient_email);
CREATE INDEX idx_email_logs_status ON public.email_logs(status);
CREATE INDEX idx_email_logs_created_at ON public.email_logs(created_at DESC);
CREATE INDEX idx_email_logs_template_type ON public.email_logs(template_type);

-- Function to log email sends
CREATE OR REPLACE FUNCTION public.log_email_send(
  _recipient_email text,
  _recipient_user_id uuid DEFAULT NULL,
  _subject text,
  _template_type text DEFAULT NULL,
  _metadata jsonb DEFAULT NULL,
  _resend_message_id text DEFAULT NULL
)
RETURNS uuid
LANGUAGE sql
SECURITY DEFINER
SET search_path = ''
AS $$
  INSERT INTO public.email_logs (
    recipient_email, 
    recipient_user_id, 
    subject, 
    template_type, 
    metadata,
    resend_message_id,
    status,
    sent_at
  ) VALUES (
    _recipient_email, 
    _recipient_user_id, 
    _subject, 
    _template_type, 
    _metadata,
    _resend_message_id,
    'sent',
    now()
  )
  RETURNING id;
$$;


-- Migration: 20250803205408_5accd6b4-abb3-4676-96d7-5f24a935c5af.sql

-- Add email logs table for tracking emails
CREATE TABLE IF NOT EXISTS public.email_logs (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  recipient_email TEXT NOT NULL,
  recipient_name TEXT,
  subject TEXT NOT NULL,
  template_type TEXT,
  status TEXT NOT NULL DEFAULT 'pending',
  provider TEXT DEFAULT 'supabase',
  error_message TEXT,
  metadata JSONB,
  sent_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.email_logs ENABLE ROW LEVEL SECURITY;

-- Create RLS policies for email logs
CREATE POLICY "Admins can manage email logs" 
ON public.email_logs 
FOR ALL 
USING (has_role(auth.uid(), 'Admin'::app_role));

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_email_logs_recipient_email ON public.email_logs(recipient_email);
CREATE INDEX IF NOT EXISTS idx_email_logs_status ON public.email_logs(status);
CREATE INDEX IF NOT EXISTS idx_email_logs_created_at ON public.email_logs(created_at);
CREATE INDEX IF NOT EXISTS idx_email_logs_template_type ON public.email_logs(template_type);

-- Create function to update updated_at timestamp
CREATE OR REPLACE FUNCTION public.update_email_logs_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger for automatic timestamp updates
CREATE TRIGGER update_email_logs_updated_at
  BEFORE UPDATE ON public.email_logs
  FOR EACH ROW
  EXECUTE FUNCTION public.update_email_logs_updated_at();

-- Add knowledge base articles table
CREATE TABLE IF NOT EXISTS public.knowledge_base_articles (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  title TEXT NOT NULL,
  content TEXT NOT NULL,
  category TEXT NOT NULL,
  tags TEXT[],
  target_user_types TEXT[] DEFAULT ARRAY['Admin', 'Landlord', 'Tenant']::TEXT[],
  is_published BOOLEAN DEFAULT false,
  author_id UUID REFERENCES auth.users(id),
  view_count INTEGER DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  published_at TIMESTAMP WITH TIME ZONE
);

-- Enable RLS for knowledge base
ALTER TABLE public.knowledge_base_articles ENABLE ROW LEVEL SECURITY;

-- Create RLS policies for knowledge base
CREATE POLICY "Admins can manage articles" 
ON public.knowledge_base_articles 
FOR ALL 
USING (has_role(auth.uid(), 'Admin'::app_role));

CREATE POLICY "Users can view published articles for their user type"
ON public.knowledge_base_articles
FOR SELECT
USING (
  is_published = true AND (
    'Admin' = ANY(target_user_types) AND has_role(auth.uid(), 'Admin'::app_role) OR
    'Landlord' = ANY(target_user_types) AND has_role(auth.uid(), 'Landlord'::app_role) OR
    'Tenant' = ANY(target_user_types) AND EXISTS (
      SELECT 1 FROM tenants WHERE user_id = auth.uid()
    )
  )
);

-- Create trigger for knowledge base updated_at
CREATE TRIGGER update_knowledge_base_articles_updated_at
  BEFORE UPDATE ON public.knowledge_base_articles
  FOR EACH ROW
  EXECUTE FUNCTION public.update_email_logs_updated_at();


-- Migration: 20250803205427_7e82335d-9ff4-47ca-aeb3-5bd9370fe87e.sql

-- Create knowledge_base_articles table for article management
CREATE TABLE public.knowledge_base_articles (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  title TEXT NOT NULL,
  content TEXT NOT NULL,
  excerpt TEXT,
  author_id UUID NOT NULL,
  category TEXT NOT NULL,
  tags TEXT[] DEFAULT '{}',
  user_roles TEXT[] DEFAULT '{}', -- Array of roles that can view this article
  status TEXT NOT NULL DEFAULT 'draft', -- draft, published, archived
  slug TEXT UNIQUE,
  views_count INTEGER DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  published_at TIMESTAMP WITH TIME ZONE
);

-- Enable RLS
ALTER TABLE public.knowledge_base_articles ENABLE ROW LEVEL SECURITY;

-- Create policies
CREATE POLICY "Admins can manage all articles" 
ON public.knowledge_base_articles 
FOR ALL 
USING (has_role(auth.uid(), 'Admin'::app_role));

CREATE POLICY "Users can view published articles for their role" 
ON public.knowledge_base_articles 
FOR SELECT 
USING (
  status = 'published' AND (
    user_roles = '{}' OR -- No role restriction
    EXISTS (
      SELECT 1 FROM user_roles ur 
      WHERE ur.user_id = auth.uid() 
      AND ur.role::text = ANY(user_roles)
    )
  )
);

-- Create SMS provider configurations table
CREATE TABLE public.sms_provider_configs (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  provider_name TEXT NOT NULL,
  api_key TEXT,
  api_secret TEXT,
  sender_id TEXT,
  base_url TEXT,
  is_active BOOLEAN DEFAULT false,
  is_default BOOLEAN DEFAULT false,
  config_data JSONB DEFAULT '{}', -- For provider-specific settings
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.sms_provider_configs ENABLE ROW LEVEL SECURITY;

-- Create policies
CREATE POLICY "Admins can manage SMS provider configs" 
ON public.sms_provider_configs 
FOR ALL 
USING (has_role(auth.uid(), 'Admin'::app_role));

-- Create triggers for updated_at
CREATE TRIGGER update_knowledge_base_articles_updated_at
BEFORE UPDATE ON public.knowledge_base_articles
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_sms_provider_configs_updated_at
BEFORE UPDATE ON public.sms_provider_configs
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Create indexes
CREATE INDEX idx_knowledge_base_articles_status ON public.knowledge_base_articles(status);
CREATE INDEX idx_knowledge_base_articles_category ON public.knowledge_base_articles(category);
CREATE INDEX idx_knowledge_base_articles_user_roles ON public.knowledge_base_articles USING GIN(user_roles);
CREATE INDEX idx_sms_provider_configs_active ON public.sms_provider_configs(is_active);
CREATE INDEX idx_sms_provider_configs_default ON public.sms_provider_configs(is_default);


-- Migration: 20250803205953_77d68f4f-4a0e-438b-84a5-de4c7a8d4299.sql

-- Fix search path for existing functions
CREATE OR REPLACE FUNCTION public.update_email_logs_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path TO '';


-- Migration: 20250803231653_b904e1b5-9144-462c-8ce5-e85ccea081d7.sql

-- Create edge function to handle user creation with roles
-- This function will be called from the frontend to create users

-- First, let's add a function to create users with specific roles
CREATE OR REPLACE FUNCTION public.create_user_with_role(
  p_email text,
  p_first_name text,
  p_last_name text,
  p_phone text,
  p_role app_role
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  new_user_id uuid;
  temp_password text;
BEGIN
  -- Generate a temporary password
  temp_password := 'TempPass' || floor(random() * 10000)::text || '!';
  
  -- For now, we'll create a profile entry and user role
  -- In production, this would integrate with Supabase Auth API
  new_user_id := gen_random_uuid();
  
  -- Insert profile
  INSERT INTO public.profiles (id, first_name, last_name, email, phone)
  VALUES (new_user_id, p_first_name, p_last_name, p_email, p_phone);
  
  -- Assign role
  INSERT INTO public.user_roles (user_id, role)
  VALUES (new_user_id, p_role);
  
  -- Return success with user info
  RETURN jsonb_build_object(
    'success', true,
    'user_id', new_user_id,
    'email', p_email,
    'temporary_password', temp_password,
    'message', 'User created successfully. They will need to complete signup with their email.'
  );
  
EXCEPTION WHEN OTHERS THEN
  RETURN jsonb_build_object(
    'success', false,
    'error', SQLERRM
  );
END;
$$;

-- Grant execute permission to authenticated users who have permission
REVOKE ALL ON FUNCTION public.create_user_with_role FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.create_user_with_role TO authenticated;


-- Migration: 20250803232552_9f021f59-841a-4d1a-ad8f-48c8bcf3e069.sql

-- Update RLS policies to allow Landlords to view and manage all profiles and user roles
-- This is needed so Landlords can see the team members they create

-- Drop existing restrictive policies and create more inclusive ones
DROP POLICY IF EXISTS "Admins can view all profiles" ON public.profiles;
DROP POLICY IF EXISTS "Admins can view all roles" ON public.user_roles;
DROP POLICY IF EXISTS "Admins can manage all roles" ON public.user_roles;

-- Create new policies that include Landlords
CREATE POLICY "Admins and Landlords can view all profiles" 
ON public.profiles 
FOR SELECT 
USING (
  has_role(auth.uid(), 'Admin'::app_role) OR 
  has_role(auth.uid(), 'Landlord'::app_role)
);

CREATE POLICY "Admins and Landlords can view all user roles" 
ON public.user_roles 
FOR SELECT 
USING (
  has_role(auth.uid(), 'Admin'::app_role) OR 
  has_role(auth.uid(), 'Landlord'::app_role) OR
  auth.uid() = user_id
);

CREATE POLICY "Admins and Landlords can manage all user roles" 
ON public.user_roles 
FOR ALL 
USING (
  has_role(auth.uid(), 'Admin'::app_role) OR 
  has_role(auth.uid(), 'Landlord'::app_role)
)
WITH CHECK (
  has_role(auth.uid(), 'Admin'::app_role) OR 
  has_role(auth.uid(), 'Landlord'::app_role)
);

-- Also need to allow Landlords to insert profiles when creating users
CREATE POLICY "Admins and Landlords can create profiles" 
ON public.profiles 
FOR INSERT 
WITH CHECK (
  has_role(auth.uid(), 'Admin'::app_role) OR 
  has_role(auth.uid(), 'Landlord'::app_role)
);


-- Migration: 20250803233554_67f7e5d0-eaf9-4d67-b946-1ff633bd4751.sql

-- Update Zira Technologies role from Admin to Partner (or remove entirely)
-- Since user wants them removed as co-admin, let's change to a Partner role

-- First, let's add Partner as a role option
ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'Partner';

-- Update Zira Technologies from Admin to Partner


-- Migration: 20250803233812_5013cec2-de0e-4afb-8d3b-d204158d8c21.sql

-- Update Zira Technologies from Admin to Landlord role
-- This removes them from the "Partner" administrative role


-- Migration: 20250803234255_2e92cabe-d285-48d8-934b-f8850e4da0d9.sql

-- Update Zira Technologies to Super Admin role
-- Zira Technologies should be the overall Super Admin, not a partner to the Landlord


-- Migration: 20250803234713_8c6f89af-b603-4e88-8503-6cdabdbfef3a.sql

-- Create profile and role for the missing manager user
-- Insert profile for Mazao Plus (the manager that was created but missing profile)

-- Insert user role for Mazao Plus


-- Migration: 20250804021003_365c60b5-1586-4d63-bdb3-9bb393c5e95f.sql

-- Add RLS policy to allow tenants to view their own units
CREATE POLICY "Tenants can view their own units" 
ON public.units 
FOR SELECT 
USING (
  EXISTS (
    SELECT 1 
    FROM leases l 
    JOIN tenants t ON t.id = l.tenant_id 
    WHERE l.unit_id = units.id 
    AND t.user_id = auth.uid()
  )
);


-- Migration: 20250804021314_a62b0291-97ff-4296-944c-4656bdc4b62d.sql

-- Add RLS policy to allow tenants to view properties for their units
CREATE POLICY "Tenants can view their property information" 
ON public.properties 
FOR SELECT 
USING (
  EXISTS (
    SELECT 1 
    FROM leases l 
    JOIN tenants t ON t.id = l.tenant_id 
    JOIN units u ON u.id = l.unit_id 
    WHERE u.property_id = properties.id 
    AND t.user_id = auth.uid()
  )
);


-- Migration: 20250804021601_fe4939a2-c29b-4cb0-ad54-bfc3fbad60e6.sql

-- Remove the problematic policies that cause infinite recursion
DROP POLICY IF EXISTS "Tenants can view their own units" ON public.units;
DROP POLICY IF EXISTS "Tenants can view their property information" ON public.properties;

-- Create security definer functions to avoid recursion
CREATE OR REPLACE FUNCTION public.get_tenant_unit_ids(_user_id uuid)
RETURNS uuid[]
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT array_agg(DISTINCT l.unit_id)
  FROM public.leases l
  JOIN public.tenants t ON t.id = l.tenant_id
  WHERE t.user_id = _user_id;
$$;

CREATE OR REPLACE FUNCTION public.get_tenant_property_ids(_user_id uuid)
RETURNS uuid[]
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT array_agg(DISTINCT u.property_id)
  FROM public.units u
  JOIN public.leases l ON l.unit_id = u.id
  JOIN public.tenants t ON t.id = l.tenant_id
  WHERE t.user_id = _user_id;
$$;

-- Create new policies using the security definer functions
CREATE POLICY "Tenants can view their own units" 
ON public.units 
FOR SELECT 
USING (id = ANY(public.get_tenant_unit_ids(auth.uid())));

CREATE POLICY "Tenants can view their property information" 
ON public.properties 
FOR SELECT 
USING (id = ANY(public.get_tenant_property_ids(auth.uid())));


-- Migration: 20250804022447_ef9e60fb-bc87-458a-9959-c1e801cffd41.sql

-- Fix the landlord maintenance dashboard by assigning properties to landlords
-- First, let's see what users we have and assign properties appropriately

-- Update existing properties to have proper ownership
-- Assign the first few properties to the current landlord user

-- Assign remaining properties to any other landlord/admin users if they exist

-- If there are still unassigned properties, assign them to any user with Landlord role

-- Add a constraint to ensure properties must have either an owner or manager
ALTER TABLE public.properties 
ADD CONSTRAINT properties_must_have_owner_or_manager 
CHECK (owner_id IS NOT NULL OR manager_id IS NOT NULL);


-- Migration: 20250804022517_cd70dd29-2949-452e-a4d5-29645a3ec168.sql

-- Fix the landlord maintenance dashboard by assigning properties to landlords
-- Update existing properties to have proper ownership

-- First, assign some properties to the current landlord user

-- Assign remaining properties to other landlord/admin users if they exist

-- If there are still unassigned properties, assign them to any user with Landlord role

-- Add a constraint to ensure properties must have either an owner or manager (but make it NOT ENFORCED initially to avoid issues with existing data)
ALTER TABLE public.properties 
ADD CONSTRAINT properties_must_have_owner_or_manager 
CHECK (owner_id IS NOT NULL OR manager_id IS NOT NULL) NOT ENFORCED;


-- Migration: 20250804022541_b6c9be4d-e20f-4618-9778-c55ff4a6e1e0.sql

-- Fix the landlord maintenance dashboard by assigning properties to landlords
-- Update existing properties to have proper ownership

-- First, assign some properties to the current landlord user

-- Assign remaining properties to other landlord/admin users if they exist

-- If there are still unassigned properties, assign them to any user with Landlord role


-- Migration: 20250804025940_d84863d1-fa88-4e53-8e69-4f6dfc2ecc1a.sql

-- Create billing plans table
CREATE TABLE public.billing_plans (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT,
  price DECIMAL(10,2) NOT NULL,
  billing_cycle TEXT NOT NULL CHECK (billing_cycle IN ('monthly', 'quarterly', 'annual')),
  max_properties INTEGER,
  max_units INTEGER,
  sms_credits_included INTEGER DEFAULT 0,
  features JSONB DEFAULT '[]'::jsonb,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create landlord subscriptions table
CREATE TABLE public.landlord_subscriptions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  landlord_id UUID NOT NULL,
  billing_plan_id UUID REFERENCES public.billing_plans(id),
  status TEXT NOT NULL DEFAULT 'trial' CHECK (status IN ('trial', 'active', 'suspended', 'cancelled', 'overdue')),
  trial_start_date TIMESTAMP WITH TIME ZONE,
  trial_end_date TIMESTAMP WITH TIME ZONE,
  subscription_start_date TIMESTAMP WITH TIME ZONE,
  next_billing_date TIMESTAMP WITH TIME ZONE,
  last_billing_date TIMESTAMP WITH TIME ZONE,
  sms_credits_balance INTEGER DEFAULT 0,
  auto_renewal BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create invoices table
CREATE TABLE public.invoices (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  invoice_number TEXT NOT NULL UNIQUE,
  landlord_id UUID NOT NULL,
  subscription_id UUID REFERENCES public.landlord_subscriptions(id),
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'paid', 'overdue', 'cancelled', 'refunded')),
  subtotal DECIMAL(10,2) NOT NULL DEFAULT 0,
  tax_amount DECIMAL(10,2) DEFAULT 0,
  discount_amount DECIMAL(10,2) DEFAULT 0,
  total_amount DECIMAL(10,2) NOT NULL,
  currency TEXT NOT NULL DEFAULT 'USD',
  invoice_date DATE NOT NULL DEFAULT CURRENT_DATE,
  due_date DATE NOT NULL,
  paid_date TIMESTAMP WITH TIME ZONE,
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create invoice items table
CREATE TABLE public.invoice_items (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  invoice_id UUID NOT NULL REFERENCES public.invoices(id) ON DELETE CASCADE,
  item_type TEXT NOT NULL CHECK (item_type IN ('subscription', 'sms_bundle', 'addon', 'discount')),
  description TEXT NOT NULL,
  quantity INTEGER NOT NULL DEFAULT 1,
  unit_price DECIMAL(10,2) NOT NULL,
  total_price DECIMAL(10,2) NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create SMS usage tracking table
CREATE TABLE public.sms_usage (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  landlord_id UUID NOT NULL,
  recipient_phone TEXT NOT NULL,
  message_content TEXT,
  cost DECIMAL(10,2) NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('sent', 'failed', 'pending')),
  sent_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create SMS bundles table
CREATE TABLE public.sms_bundles (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT,
  sms_count INTEGER NOT NULL,
  price DECIMAL(10,2) NOT NULL,
  currency TEXT NOT NULL DEFAULT 'USD',
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create payment transactions table
CREATE TABLE public.payment_transactions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  invoice_id UUID REFERENCES public.invoices(id),
  landlord_id UUID NOT NULL,
  transaction_id TEXT,
  payment_method TEXT NOT NULL CHECK (payment_method IN ('mpesa', 'stripe', 'bank_transfer', 'manual')),
  amount DECIMAL(10,2) NOT NULL,
  currency TEXT NOT NULL DEFAULT 'USD',
  status TEXT NOT NULL CHECK (status IN ('pending', 'completed', 'failed', 'refunded')),
  gateway_response JSONB,
  processed_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create billing settings table
CREATE TABLE public.billing_settings (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  setting_key TEXT NOT NULL UNIQUE,
  setting_value JSONB NOT NULL,
  description TEXT,
  updated_by UUID,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable Row Level Security
ALTER TABLE public.billing_plans ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.landlord_subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.invoices ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.invoice_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sms_usage ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sms_bundles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payment_transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.billing_settings ENABLE ROW LEVEL SECURITY;

-- Create RLS policies for billing_plans
CREATE POLICY "Admins can manage billing plans" ON public.billing_plans
FOR ALL USING (has_role(auth.uid(), 'Admin'::app_role));

CREATE POLICY "Landlords can view active billing plans" ON public.billing_plans
FOR SELECT USING (is_active = true AND has_role(auth.uid(), 'Landlord'::app_role));

-- Create RLS policies for landlord_subscriptions
CREATE POLICY "Admins can manage all subscriptions" ON public.landlord_subscriptions
FOR ALL USING (has_role(auth.uid(), 'Admin'::app_role));

CREATE POLICY "Landlords can view their own subscription" ON public.landlord_subscriptions
FOR SELECT USING (has_role(auth.uid(), 'Landlord'::app_role) AND landlord_id = auth.uid());

-- Create RLS policies for invoices
CREATE POLICY "Admins can manage all invoices" ON public.invoices
FOR ALL USING (has_role(auth.uid(), 'Admin'::app_role));

CREATE POLICY "Landlords can view their own invoices" ON public.invoices
FOR SELECT USING (has_role(auth.uid(), 'Landlord'::app_role) AND landlord_id = auth.uid());

-- Create RLS policies for invoice_items
CREATE POLICY "Admins can manage all invoice items" ON public.invoice_items
FOR ALL USING (has_role(auth.uid(), 'Admin'::app_role));

CREATE POLICY "Landlords can view their own invoice items" ON public.invoice_items
FOR SELECT USING (
  has_role(auth.uid(), 'Landlord'::app_role) AND 
  EXISTS (
    SELECT 1 FROM public.invoices i 
    WHERE i.id = invoice_items.invoice_id AND i.landlord_id = auth.uid()
  )
);

-- Create RLS policies for sms_usage
CREATE POLICY "Admins can manage all SMS usage" ON public.sms_usage
FOR ALL USING (has_role(auth.uid(), 'Admin'::app_role));

CREATE POLICY "Landlords can view their own SMS usage" ON public.sms_usage
FOR SELECT USING (has_role(auth.uid(), 'Landlord'::app_role) AND landlord_id = auth.uid());

-- Create RLS policies for sms_bundles
CREATE POLICY "Admins can manage SMS bundles" ON public.sms_bundles
FOR ALL USING (has_role(auth.uid(), 'Admin'::app_role));

CREATE POLICY "Landlords can view active SMS bundles" ON public.sms_bundles
FOR SELECT USING (is_active = true AND has_role(auth.uid(), 'Landlord'::app_role));

-- Create RLS policies for payment_transactions
CREATE POLICY "Admins can manage all payment transactions" ON public.payment_transactions
FOR ALL USING (has_role(auth.uid(), 'Admin'::app_role));

CREATE POLICY "Landlords can view their own payment transactions" ON public.payment_transactions
FOR SELECT USING (has_role(auth.uid(), 'Landlord'::app_role) AND landlord_id = auth.uid());

-- Create RLS policies for billing_settings
CREATE POLICY "Admins can manage billing settings" ON public.billing_settings
FOR ALL USING (has_role(auth.uid(), 'Admin'::app_role));

-- Create indexes for better performance
CREATE INDEX idx_landlord_subscriptions_landlord_id ON public.landlord_subscriptions(landlord_id);
CREATE INDEX idx_landlord_subscriptions_status ON public.landlord_subscriptions(status);
CREATE INDEX idx_invoices_landlord_id ON public.invoices(landlord_id);
CREATE INDEX idx_invoices_status ON public.invoices(status);
CREATE INDEX idx_invoices_due_date ON public.invoices(due_date);
CREATE INDEX idx_sms_usage_landlord_id ON public.sms_usage(landlord_id);
CREATE INDEX idx_sms_usage_sent_at ON public.sms_usage(sent_at);
CREATE INDEX idx_payment_transactions_landlord_id ON public.payment_transactions(landlord_id);
CREATE INDEX idx_payment_transactions_status ON public.payment_transactions(status);

-- Create triggers for updated_at
CREATE TRIGGER update_billing_plans_updated_at
BEFORE UPDATE ON public.billing_plans
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_landlord_subscriptions_updated_at
BEFORE UPDATE ON public.landlord_subscriptions
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_invoices_updated_at
BEFORE UPDATE ON public.invoices
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_sms_bundles_updated_at
BEFORE UPDATE ON public.sms_bundles
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_billing_settings_updated_at
BEFORE UPDATE ON public.billing_settings
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Insert default billing settings

-- Insert default billing plans

-- Insert default SMS bundles

-- Create function to generate invoice numbers
CREATE OR REPLACE FUNCTION public.generate_invoice_number()
RETURNS TEXT AS $$
DECLARE
  next_number INTEGER;
  invoice_number TEXT;
BEGIN
  -- Get the next invoice number (simple sequential numbering)
  SELECT COALESCE(MAX(CAST(SUBSTRING(invoice_number FROM '[0-9]+$') AS INTEGER)), 0) + 1
  INTO next_number
  FROM public.invoices
  WHERE invoice_number ~ '^INV-[0-9]+$';
  
  invoice_number := 'INV-' || LPAD(next_number::TEXT, 6, '0');
  
  RETURN invoice_number;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;


-- Migration: 20250804030059_54b588e3-8a2b-494d-9fa1-01eb321e6a11.sql

-- First, let's add the new billing-specific columns to the existing invoices table
ALTER TABLE public.invoices 
ADD COLUMN IF NOT EXISTS subscription_id UUID REFERENCES public.landlord_subscriptions(id),
ADD COLUMN IF NOT EXISTS subtotal DECIMAL(10,2) DEFAULT 0,
ADD COLUMN IF NOT EXISTS tax_amount DECIMAL(10,2) DEFAULT 0,
ADD COLUMN IF NOT EXISTS discount_amount DECIMAL(10,2) DEFAULT 0,
ADD COLUMN IF NOT EXISTS currency TEXT DEFAULT 'USD',
ADD COLUMN IF NOT EXISTS paid_date TIMESTAMP WITH TIME ZONE,
ADD COLUMN IF NOT EXISTS notes TEXT;

-- Update the status column to include billing statuses if not already present
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.check_constraints 
    WHERE constraint_name LIKE '%invoices_status_check%' 
    AND check_clause LIKE '%overdue%'
  ) THEN
    ALTER TABLE public.invoices DROP CONSTRAINT IF EXISTS invoices_status_check;
    ALTER TABLE public.invoices ADD CONSTRAINT invoices_status_check 
    CHECK (status IN ('pending', 'paid', 'overdue', 'cancelled', 'refunded'));
  END IF;
END $$;

-- Create billing plans table
CREATE TABLE IF NOT EXISTS public.billing_plans (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT,
  price DECIMAL(10,2) NOT NULL,
  billing_cycle TEXT NOT NULL CHECK (billing_cycle IN ('monthly', 'quarterly', 'annual')),
  max_properties INTEGER,
  max_units INTEGER,
  sms_credits_included INTEGER DEFAULT 0,
  features JSONB DEFAULT '[]'::jsonb,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create landlord subscriptions table
CREATE TABLE IF NOT EXISTS public.landlord_subscriptions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  landlord_id UUID NOT NULL,
  billing_plan_id UUID REFERENCES public.billing_plans(id),
  status TEXT NOT NULL DEFAULT 'trial' CHECK (status IN ('trial', 'active', 'suspended', 'cancelled', 'overdue')),
  trial_start_date TIMESTAMP WITH TIME ZONE,
  trial_end_date TIMESTAMP WITH TIME ZONE,
  subscription_start_date TIMESTAMP WITH TIME ZONE,
  next_billing_date TIMESTAMP WITH TIME ZONE,
  last_billing_date TIMESTAMP WITH TIME ZONE,
  sms_credits_balance INTEGER DEFAULT 0,
  auto_renewal BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create invoice items table
CREATE TABLE IF NOT EXISTS public.invoice_items (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  invoice_id UUID NOT NULL REFERENCES public.invoices(id) ON DELETE CASCADE,
  item_type TEXT NOT NULL CHECK (item_type IN ('subscription', 'sms_bundle', 'addon', 'discount')),
  description TEXT NOT NULL,
  quantity INTEGER NOT NULL DEFAULT 1,
  unit_price DECIMAL(10,2) NOT NULL,
  total_price DECIMAL(10,2) NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create SMS usage tracking table
CREATE TABLE IF NOT EXISTS public.sms_usage (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  landlord_id UUID NOT NULL,
  recipient_phone TEXT NOT NULL,
  message_content TEXT,
  cost DECIMAL(10,2) NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('sent', 'failed', 'pending')),
  sent_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create SMS bundles table
CREATE TABLE IF NOT EXISTS public.sms_bundles (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT,
  sms_count INTEGER NOT NULL,
  price DECIMAL(10,2) NOT NULL,
  currency TEXT NOT NULL DEFAULT 'USD',
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create payment transactions table
CREATE TABLE IF NOT EXISTS public.payment_transactions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  invoice_id UUID REFERENCES public.invoices(id),
  landlord_id UUID NOT NULL,
  transaction_id TEXT,
  payment_method TEXT NOT NULL CHECK (payment_method IN ('mpesa', 'stripe', 'bank_transfer', 'manual')),
  amount DECIMAL(10,2) NOT NULL,
  currency TEXT NOT NULL DEFAULT 'USD',
  status TEXT NOT NULL CHECK (status IN ('pending', 'completed', 'failed', 'refunded')),
  gateway_response JSONB,
  processed_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create billing settings table
CREATE TABLE IF NOT EXISTS public.billing_settings (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  setting_key TEXT NOT NULL UNIQUE,
  setting_value JSONB NOT NULL,
  description TEXT,
  updated_by UUID,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable Row Level Security for new tables
ALTER TABLE public.billing_plans ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.landlord_subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.invoice_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sms_usage ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sms_bundles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payment_transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.billing_settings ENABLE ROW LEVEL SECURITY;

-- Create RLS policies for billing_plans
DROP POLICY IF EXISTS "Admins can manage billing plans" ON public.billing_plans;
CREATE POLICY "Admins can manage billing plans" ON public.billing_plans
FOR ALL USING (has_role(auth.uid(), 'Admin'::app_role));

DROP POLICY IF EXISTS "Landlords can view active billing plans" ON public.billing_plans;
CREATE POLICY "Landlords can view active billing plans" ON public.billing_plans
FOR SELECT USING (is_active = true AND has_role(auth.uid(), 'Landlord'::app_role));

-- Create RLS policies for landlord_subscriptions
DROP POLICY IF EXISTS "Admins can manage all subscriptions" ON public.landlord_subscriptions;
CREATE POLICY "Admins can manage all subscriptions" ON public.landlord_subscriptions
FOR ALL USING (has_role(auth.uid(), 'Admin'::app_role));

DROP POLICY IF EXISTS "Landlords can view their own subscription" ON public.landlord_subscriptions;
CREATE POLICY "Landlords can view their own subscription" ON public.landlord_subscriptions
FOR SELECT USING (has_role(auth.uid(), 'Landlord'::app_role) AND landlord_id = auth.uid());

-- Create RLS policies for invoice_items
DROP POLICY IF EXISTS "Admins can manage all invoice items" ON public.invoice_items;
CREATE POLICY "Admins can manage all invoice items" ON public.invoice_items
FOR ALL USING (has_role(auth.uid(), 'Admin'::app_role));

DROP POLICY IF EXISTS "Landlords can view their own invoice items" ON public.invoice_items;
CREATE POLICY "Landlords can view their own invoice items" ON public.invoice_items
FOR SELECT USING (
  has_role(auth.uid(), 'Landlord'::app_role) AND 
  EXISTS (
    SELECT 1 FROM public.invoices i 
    WHERE i.id = invoice_items.invoice_id AND i.tenant_id IN (
      SELECT t.id FROM public.tenants t WHERE t.user_id = auth.uid()
    )
  )
);

-- Create RLS policies for sms_usage
DROP POLICY IF EXISTS "Admins can manage all SMS usage" ON public.sms_usage;
CREATE POLICY "Admins can manage all SMS usage" ON public.sms_usage
FOR ALL USING (has_role(auth.uid(), 'Admin'::app_role));

DROP POLICY IF EXISTS "Landlords can view their own SMS usage" ON public.sms_usage;
CREATE POLICY "Landlords can view their own SMS usage" ON public.sms_usage
FOR SELECT USING (has_role(auth.uid(), 'Landlord'::app_role) AND landlord_id = auth.uid());

-- Create RLS policies for sms_bundles
DROP POLICY IF EXISTS "Admins can manage SMS bundles" ON public.sms_bundles;
CREATE POLICY "Admins can manage SMS bundles" ON public.sms_bundles
FOR ALL USING (has_role(auth.uid(), 'Admin'::app_role));

DROP POLICY IF EXISTS "Landlords can view active SMS bundles" ON public.sms_bundles;
CREATE POLICY "Landlords can view active SMS bundles" ON public.sms_bundles
FOR SELECT USING (is_active = true AND has_role(auth.uid(), 'Landlord'::app_role));

-- Create RLS policies for payment_transactions
DROP POLICY IF EXISTS "Admins can manage all payment transactions" ON public.payment_transactions;
CREATE POLICY "Admins can manage all payment transactions" ON public.payment_transactions
FOR ALL USING (has_role(auth.uid(), 'Admin'::app_role));

DROP POLICY IF EXISTS "Landlords can view their own payment transactions" ON public.payment_transactions;
CREATE POLICY "Landlords can view their own payment transactions" ON public.payment_transactions
FOR SELECT USING (has_role(auth.uid(), 'Landlord'::app_role) AND landlord_id = auth.uid());

-- Create RLS policies for billing_settings
DROP POLICY IF EXISTS "Admins can manage billing settings" ON public.billing_settings;
CREATE POLICY "Admins can manage billing settings" ON public.billing_settings
FOR ALL USING (has_role(auth.uid(), 'Admin'::app_role));

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_landlord_subscriptions_landlord_id ON public.landlord_subscriptions(landlord_id);
CREATE INDEX IF NOT EXISTS idx_landlord_subscriptions_status ON public.landlord_subscriptions(status);
CREATE INDEX IF NOT EXISTS idx_sms_usage_landlord_id ON public.sms_usage(landlord_id);
CREATE INDEX IF NOT EXISTS idx_sms_usage_sent_at ON public.sms_usage(sent_at);
CREATE INDEX IF NOT EXISTS idx_payment_transactions_landlord_id ON public.payment_transactions(landlord_id);
CREATE INDEX IF NOT EXISTS idx_payment_transactions_status ON public.payment_transactions(status);

-- Create triggers for updated_at
DROP TRIGGER IF EXISTS update_billing_plans_updated_at ON public.billing_plans;
CREATE TRIGGER update_billing_plans_updated_at
BEFORE UPDATE ON public.billing_plans
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

DROP TRIGGER IF EXISTS update_landlord_subscriptions_updated_at ON public.landlord_subscriptions;
CREATE TRIGGER update_landlord_subscriptions_updated_at
BEFORE UPDATE ON public.landlord_subscriptions
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

DROP TRIGGER IF EXISTS update_sms_bundles_updated_at ON public.sms_bundles;
CREATE TRIGGER update_sms_bundles_updated_at
BEFORE UPDATE ON public.sms_bundles
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

DROP TRIGGER IF EXISTS update_billing_settings_updated_at ON public.billing_settings;
CREATE TRIGGER update_billing_settings_updated_at
BEFORE UPDATE ON public.billing_settings
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Insert default billing settings (only if they don't exist)

-- Insert default billing plans (only if they don't exist)



-- Insert default SMS bundles (only if they don't exist)




-- Create function to generate invoice numbers
CREATE OR REPLACE FUNCTION public.generate_invoice_number()
RETURNS TEXT AS $$
DECLARE
  next_number INTEGER;
  invoice_number TEXT;
BEGIN
  -- Get the next invoice number (simple sequential numbering)
  SELECT COALESCE(MAX(CAST(SUBSTRING(invoice_number FROM '[0-9]+$') AS INTEGER)), 0) + 1
  INTO next_number
  FROM public.invoices
  WHERE invoice_number ~ '^INV-[0-9]+$';
  
  invoice_number := 'INV-' || LPAD(next_number::TEXT, 6, '0');
  
  RETURN invoice_number;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;


-- Migration: 20250804030154_4e7cf0b6-a781-453d-8cf8-cace8a0f5e2a.sql

-- Create billing plans table
CREATE TABLE IF NOT EXISTS public.billing_plans (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT,
  price DECIMAL(10,2) NOT NULL,
  billing_cycle TEXT NOT NULL CHECK (billing_cycle IN ('monthly', 'quarterly', 'annual')),
  max_properties INTEGER,
  max_units INTEGER,
  sms_credits_included INTEGER DEFAULT 0,
  features JSONB DEFAULT '[]'::jsonb,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create landlord subscriptions table
CREATE TABLE IF NOT EXISTS public.landlord_subscriptions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  landlord_id UUID NOT NULL,
  billing_plan_id UUID REFERENCES public.billing_plans(id),
  status TEXT NOT NULL DEFAULT 'trial' CHECK (status IN ('trial', 'active', 'suspended', 'cancelled', 'overdue')),
  trial_start_date TIMESTAMP WITH TIME ZONE,
  trial_end_date TIMESTAMP WITH TIME ZONE,
  subscription_start_date TIMESTAMP WITH TIME ZONE,
  next_billing_date TIMESTAMP WITH TIME ZONE,
  last_billing_date TIMESTAMP WITH TIME ZONE,
  sms_credits_balance INTEGER DEFAULT 0,
  auto_renewal BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create SMS usage tracking table
CREATE TABLE IF NOT EXISTS public.sms_usage (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  landlord_id UUID NOT NULL,
  recipient_phone TEXT NOT NULL,
  message_content TEXT,
  cost DECIMAL(10,2) NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('sent', 'failed', 'pending')),
  sent_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create SMS bundles table
CREATE TABLE IF NOT EXISTS public.sms_bundles (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT,
  sms_count INTEGER NOT NULL,
  price DECIMAL(10,2) NOT NULL,
  currency TEXT NOT NULL DEFAULT 'USD',
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create payment transactions table
CREATE TABLE IF NOT EXISTS public.payment_transactions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  invoice_id UUID REFERENCES public.invoices(id),
  landlord_id UUID NOT NULL,
  transaction_id TEXT,
  payment_method TEXT NOT NULL CHECK (payment_method IN ('mpesa', 'stripe', 'bank_transfer', 'manual')),
  amount DECIMAL(10,2) NOT NULL,
  currency TEXT NOT NULL DEFAULT 'USD',
  status TEXT NOT NULL CHECK (status IN ('pending', 'completed', 'failed', 'refunded')),
  gateway_response JSONB,
  processed_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create billing settings table
CREATE TABLE IF NOT EXISTS public.billing_settings (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  setting_key TEXT NOT NULL UNIQUE,
  setting_value JSONB NOT NULL,
  description TEXT,
  updated_by UUID,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable Row Level Security for new tables
ALTER TABLE public.billing_plans ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.landlord_subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sms_usage ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sms_bundles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payment_transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.billing_settings ENABLE ROW LEVEL SECURITY;

-- Create RLS policies for billing_plans
DROP POLICY IF EXISTS "Admins can manage billing plans" ON public.billing_plans;
CREATE POLICY "Admins can manage billing plans" ON public.billing_plans
FOR ALL USING (has_role(auth.uid(), 'Admin'::app_role));

DROP POLICY IF EXISTS "Landlords can view active billing plans" ON public.billing_plans;
CREATE POLICY "Landlords can view active billing plans" ON public.billing_plans
FOR SELECT USING (is_active = true AND has_role(auth.uid(), 'Landlord'::app_role));

-- Create RLS policies for landlord_subscriptions
DROP POLICY IF EXISTS "Admins can manage all subscriptions" ON public.landlord_subscriptions;
CREATE POLICY "Admins can manage all subscriptions" ON public.landlord_subscriptions
FOR ALL USING (has_role(auth.uid(), 'Admin'::app_role));

DROP POLICY IF EXISTS "Landlords can view their own subscription" ON public.landlord_subscriptions;
CREATE POLICY "Landlords can view their own subscription" ON public.landlord_subscriptions
FOR SELECT USING (has_role(auth.uid(), 'Landlord'::app_role) AND landlord_id = auth.uid());

-- Create RLS policies for sms_usage
DROP POLICY IF EXISTS "Admins can manage all SMS usage" ON public.sms_usage;
CREATE POLICY "Admins can manage all SMS usage" ON public.sms_usage
FOR ALL USING (has_role(auth.uid(), 'Admin'::app_role));

DROP POLICY IF EXISTS "Landlords can view their own SMS usage" ON public.sms_usage;
CREATE POLICY "Landlords can view their own SMS usage" ON public.sms_usage
FOR SELECT USING (has_role(auth.uid(), 'Landlord'::app_role) AND landlord_id = auth.uid());

-- Create RLS policies for sms_bundles
DROP POLICY IF EXISTS "Admins can manage SMS bundles" ON public.sms_bundles;
CREATE POLICY "Admins can manage SMS bundles" ON public.sms_bundles
FOR ALL USING (has_role(auth.uid(), 'Admin'::app_role));

DROP POLICY IF EXISTS "Landlords can view active SMS bundles" ON public.sms_bundles;
CREATE POLICY "Landlords can view active SMS bundles" ON public.sms_bundles
FOR SELECT USING (is_active = true AND has_role(auth.uid(), 'Landlord'::app_role));

-- Create RLS policies for payment_transactions
DROP POLICY IF EXISTS "Admins can manage all payment transactions" ON public.payment_transactions;
CREATE POLICY "Admins can manage all payment transactions" ON public.payment_transactions
FOR ALL USING (has_role(auth.uid(), 'Admin'::app_role));

DROP POLICY IF EXISTS "Landlords can view their own payment transactions" ON public.payment_transactions;
CREATE POLICY "Landlords can view their own payment transactions" ON public.payment_transactions
FOR SELECT USING (has_role(auth.uid(), 'Landlord'::app_role) AND landlord_id = auth.uid());

-- Create RLS policies for billing_settings
DROP POLICY IF EXISTS "Admins can manage billing settings" ON public.billing_settings;
CREATE POLICY "Admins can manage billing settings" ON public.billing_settings
FOR ALL USING (has_role(auth.uid(), 'Admin'::app_role));

-- Insert default billing settings (only if they don't exist)

-- Insert default billing plans (only if they don't exist)



-- Insert default SMS bundles (only if they don't exist)





-- Migration: 20250804032008_48a468ea-b96f-469f-a0c7-37f0711bd4a3.sql

-- Add new billing model columns to billing_plans table
ALTER TABLE public.billing_plans 
ADD COLUMN billing_model text DEFAULT 'percentage',
ADD COLUMN percentage_rate numeric,
ADD COLUMN fixed_amount_per_unit numeric,
ADD COLUMN tier_pricing jsonb,
ADD COLUMN currency text DEFAULT 'USD';

-- Update existing plans to use percentage model


-- Migration: 20250804120500_42f94aea-6dda-4b92-81a2-c28ae5c70a46.sql

-- Create M-Pesa transactions table
CREATE TABLE public.mpesa_transactions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  checkout_request_id TEXT NOT NULL UNIQUE,
  merchant_request_id TEXT,
  phone_number TEXT NOT NULL,
  amount DECIMAL(15,2) NOT NULL,
  invoice_id UUID REFERENCES public.invoices(id),
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'completed', 'failed', 'cancelled')),
  result_code INTEGER,
  result_desc TEXT,
  mpesa_receipt_number TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.mpesa_transactions ENABLE ROW LEVEL SECURITY;

-- Create policies for M-Pesa transactions
CREATE POLICY "Users can view their own transactions" 
ON public.mpesa_transactions 
FOR SELECT 
USING (
  EXISTS (
    SELECT 1 FROM public.invoices 
    JOIN public.tenants ON invoices.tenant_id = tenants.id 
    WHERE invoices.id = mpesa_transactions.invoice_id 
    AND tenants.user_id = auth.uid()
  )
);

CREATE POLICY "System can insert transactions" 
ON public.mpesa_transactions 
FOR INSERT 
WITH CHECK (true);

CREATE POLICY "System can update transactions" 
ON public.mpesa_transactions 
FOR UPDATE 
USING (true);

-- Create trigger for automatic timestamp updates
CREATE TRIGGER update_mpesa_transactions_updated_at
BEFORE UPDATE ON public.mpesa_transactions
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Create index for faster lookups
CREATE INDEX idx_mpesa_transactions_checkout_request_id ON public.mpesa_transactions(checkout_request_id);
CREATE INDEX idx_mpesa_transactions_invoice_id ON public.mpesa_transactions(invoice_id);
CREATE INDEX idx_mpesa_transactions_status ON public.mpesa_transactions(status);


-- Migration: 20250804120640_2912618e-0843-4a13-95df-a92f6f77e8db.sql

-- Create function to get transaction status
CREATE OR REPLACE FUNCTION public.get_transaction_status(p_checkout_request_id TEXT)
RETURNS TEXT
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO ''
AS $function$
  SELECT status 
  FROM public.mpesa_transactions 
  WHERE checkout_request_id = p_checkout_request_id
  LIMIT 1;
$function$


-- Migration: 20250804120829_a203d0cd-ed2e-4f6c-854e-e2403b290fd5.sql

-- Add missing invoice_id field to payments table if it doesn't exist
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                 WHERE table_name = 'payments' AND column_name = 'invoice_id') THEN
    ALTER TABLE public.payments ADD COLUMN invoice_id UUID REFERENCES public.invoices(id);
  END IF;
END $$;


-- Migration: 20250804124553_50103224-784e-4640-806e-cd6625ac2327.sql

-- Fix the successful M-Pesa payment that wasn't processed correctly
-- Insert the missing payment record for the successful M-Pesa transaction

-- Update the invoice status to paid


-- Migration: 20250804125441_36e99a08-01e3-49af-8099-01555b055de2.sql

-- Create meter readings table for tracking utility consumption
CREATE TABLE public.meter_readings (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  unit_id UUID NOT NULL,
  meter_type TEXT NOT NULL, -- 'electricity', 'water', 'gas', etc.
  previous_reading NUMERIC NOT NULL DEFAULT 0,
  current_reading NUMERIC NOT NULL,
  reading_date DATE NOT NULL,
  rate_per_unit NUMERIC NOT NULL DEFAULT 0, -- cost per unit consumed
  units_consumed NUMERIC GENERATED ALWAYS AS (current_reading - previous_reading) STORED,
  total_cost NUMERIC GENERATED ALWAYS AS ((current_reading - previous_reading) * rate_per_unit) STORED,
  notes TEXT,
  created_by UUID,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Add expense_type to expenses table to differentiate between one-time and metered expenses
ALTER TABLE public.expenses ADD COLUMN expense_type TEXT NOT NULL DEFAULT 'one-time';
ALTER TABLE public.expenses ADD COLUMN meter_reading_id UUID;
ALTER TABLE public.expenses ADD COLUMN tenant_id UUID;
ALTER TABLE public.expenses ADD COLUMN is_recurring BOOLEAN DEFAULT false;
ALTER TABLE public.expenses ADD COLUMN recurrence_period TEXT; -- 'monthly', 'quarterly', 'yearly'

-- Add constraint for expense_type
ALTER TABLE public.expenses ADD CONSTRAINT expense_type_check 
CHECK (expense_type IN ('one-time', 'metered', 'recurring'));

-- Enable RLS on meter_readings
ALTER TABLE public.meter_readings ENABLE ROW LEVEL SECURITY;

-- Create policies for meter_readings
CREATE POLICY "Property stakeholders can manage meter readings" 
ON public.meter_readings 
FOR ALL 
USING (
  EXISTS (
    SELECT 1 FROM units u
    JOIN properties p ON p.id = u.property_id
    WHERE u.id = meter_readings.unit_id 
    AND (p.owner_id = auth.uid() OR p.manager_id = auth.uid())
  ) OR has_role(auth.uid(), 'Admin'::app_role) OR has_role(auth.uid(), 'Landlord'::app_role)
);

-- Create function to update meter_readings updated_at
CREATE OR REPLACE FUNCTION public.update_meter_readings_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger for meter_readings
CREATE TRIGGER update_meter_readings_updated_at
BEFORE UPDATE ON public.meter_readings
FOR EACH ROW
EXECUTE FUNCTION public.update_meter_readings_updated_at();

-- Create indexes for better performance
CREATE INDEX idx_meter_readings_unit_id ON public.meter_readings(unit_id);
CREATE INDEX idx_meter_readings_meter_type ON public.meter_readings(meter_type);
CREATE INDEX idx_meter_readings_reading_date ON public.meter_readings(reading_date);
CREATE INDEX idx_expenses_type ON public.expenses(expense_type);
CREATE INDEX idx_expenses_tenant_id ON public.expenses(tenant_id);


-- Migration: 20250804125505_ac251acb-42da-4226-a308-06d96af43f29.sql

-- Fix security warning for update_meter_readings_updated_at function
DROP FUNCTION IF EXISTS public.update_meter_readings_updated_at();

CREATE OR REPLACE FUNCTION public.update_meter_readings_updated_at()
RETURNS TRIGGER 
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;


-- Migration: 20250804125533_66e8f96a-fe8b-4dce-be98-bfa68e0e0a2c.sql

-- Fix security warning by recreating the function with proper search_path
DROP FUNCTION IF EXISTS public.update_meter_readings_updated_at() CASCADE;

CREATE OR REPLACE FUNCTION public.update_meter_readings_updated_at()
RETURNS TRIGGER 
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

-- Recreate the trigger
CREATE TRIGGER update_meter_readings_updated_at
BEFORE UPDATE ON public.meter_readings
FOR EACH ROW
EXECUTE FUNCTION public.update_meter_readings_updated_at();


-- Migration: 20250804125609_2bcf40c8-d8d0-47c7-940f-89912ed98a45.sql

-- Fix the existing update_updated_at_column function
DROP FUNCTION IF EXISTS public.update_updated_at_column() CASCADE;

CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER 
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$;

-- Recreate triggers that use this function
CREATE TRIGGER update_expenses_updated_at
BEFORE UPDATE ON public.expenses
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_profiles_updated_at
BEFORE UPDATE ON public.profiles
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();


-- Migration: 20250804125711_12ec8871-4b17-413f-b510-36594e8c1b95.sql

-- Fix update_email_logs_updated_at function
DROP FUNCTION IF EXISTS public.update_email_logs_updated_at() CASCADE;

CREATE OR REPLACE FUNCTION public.update_email_logs_updated_at()
RETURNS TRIGGER 
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

-- Recreate the trigger
CREATE TRIGGER update_email_logs_updated_at
BEFORE UPDATE ON public.email_logs
FOR EACH ROW
EXECUTE FUNCTION public.update_email_logs_updated_at();


-- Migration: 20250804125739_6ac0586c-9c33-4a8b-80e6-6a55af1a440d.sql

-- Fix the create_user_with_role function
CREATE OR REPLACE FUNCTION public.create_user_with_role(p_email text, p_first_name text, p_last_name text, p_phone text, p_role app_role)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $$
DECLARE
  new_user_id uuid;
  temp_password text;
BEGIN
  -- Generate a temporary password
  temp_password := 'TempPass' || floor(random() * 10000)::text || '!';
  
  -- For now, we'll create a profile entry and user role
  -- In production, this would integrate with Supabase Auth API
  new_user_id := gen_random_uuid();
  
  -- Insert profile
  INSERT INTO public.profiles (id, first_name, last_name, email, phone)
  VALUES (new_user_id, p_first_name, p_last_name, p_email, p_phone);
  
  -- Assign role
  INSERT INTO public.user_roles (user_id, role)
  VALUES (new_user_id, p_role);
  
  -- Return success with user info
  RETURN jsonb_build_object(
    'success', true,
    'user_id', new_user_id,
    'email', p_email,
    'temporary_password', temp_password,
    'message', 'User created successfully. They will need to complete signup with their email.'
  );
  
EXCEPTION WHEN OTHERS THEN
  RETURN jsonb_build_object(
    'success', false,
    'error', SQLERRM
  );
END;
$$;


-- Migration: 20250804125804_c660d802-a55b-4150-b4a1-ad9f8cf25c78.sql

-- Fix the handle_new_user function
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $$
BEGIN
  -- Insert into profiles table
  INSERT INTO public.profiles (id, first_name, last_name, phone, email)
  VALUES (
    NEW.id, 
    NEW.raw_user_meta_data ->> 'first_name', 
    NEW.raw_user_meta_data ->> 'last_name',
    NEW.raw_user_meta_data ->> 'phone',
    NEW.email
  );
  
  -- Assign role based on user metadata, default to 'Agent' if not specified
  INSERT INTO public.user_roles (user_id, role)
  VALUES (
    NEW.id, 
    COALESCE(
      (NEW.raw_user_meta_data ->> 'role')::public.app_role,
      'Agent'::public.app_role
    )
  );
  
  RETURN NEW;
END;
$$;


-- Migration: 20250804150327_0852b536-323e-40c5-bb3b-721c365dd7f9.sql

-- First, let's create a default billing plan if none exists

-- Get the trial plan ID for the subscription
DO $$
DECLARE
  trial_plan_id uuid;
  landlord_id uuid := 'a53f69a5-104e-489b-9b0a-48a56d6b011d';
BEGIN
  -- Get the trial plan ID
  SELECT id INTO trial_plan_id FROM public.billing_plans WHERE name = 'Trial Plan' LIMIT 1;
  
  -- Create subscription for existing landlord if not exists
  INSERT INTO public.landlord_subscriptions (
    landlord_id,
    billing_plan_id,
    status,
    trial_start_date,
    trial_end_date,
    sms_credits_balance,
    auto_renewal
  )
  VALUES (
    landlord_id,
    trial_plan_id,
    'trial',
    now(),
    now() + interval '30 days',
    100,
    true
  ) ON CONFLICT (landlord_id) DO NOTHING;
END $$;

-- Create default billing settings if none exist

-- Create function to auto-create subscriptions for new landlords
CREATE OR REPLACE FUNCTION public.create_default_landlord_subscription()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  trial_plan_id uuid;
BEGIN
  -- Only create subscription for landlord role
  IF EXISTS (
    SELECT 1 FROM public.user_roles 
    WHERE user_id = NEW.user_id AND role = 'Landlord'::public.app_role
  ) THEN
    -- Get the first active billing plan (trial plan)
    SELECT id INTO trial_plan_id 
    FROM public.billing_plans 
    WHERE is_active = true 
    ORDER BY created_at ASC 
    LIMIT 1;
    
    -- Create subscription if plan exists
    IF trial_plan_id IS NOT NULL THEN
      INSERT INTO public.landlord_subscriptions (
        landlord_id,
        billing_plan_id,
        status,
        trial_start_date,
        trial_end_date,
        sms_credits_balance,
        auto_renewal
      )
      VALUES (
        NEW.user_id,
        trial_plan_id,
        'trial',
        now(),
        now() + interval '30 days',
        100,
        true
      ) ON CONFLICT (landlord_id) DO NOTHING;
    END IF;
  END IF;
  
  RETURN NEW;
END;
$$;

-- Create trigger to auto-create subscriptions when user roles are assigned
DROP TRIGGER IF EXISTS auto_create_landlord_subscription ON public.user_roles;
CREATE TRIGGER auto_create_landlord_subscription
  AFTER INSERT ON public.user_roles
  FOR EACH ROW
  EXECUTE FUNCTION public.create_default_landlord_subscription();


-- Migration: 20250804150523_6eee8f15-02f4-4df1-84aa-c9710766217b.sql

-- First, let's create a default billing plan if none exists

-- Add unique constraint on landlord_id if it doesn't exist
ALTER TABLE public.landlord_subscriptions 
ADD CONSTRAINT unique_landlord_subscription UNIQUE (landlord_id);

-- Get the trial plan ID for the subscription and create subscription for existing landlord
DO $$
DECLARE
  trial_plan_id uuid;
  target_landlord_id uuid := 'a53f69a5-104e-489b-9b0a-48a56d6b011d';
BEGIN
  -- Get the trial plan ID
  SELECT id INTO trial_plan_id FROM public.billing_plans WHERE name = 'Trial Plan' LIMIT 1;
  
  -- Create subscription for existing landlord if not exists
  INSERT INTO public.landlord_subscriptions (
    landlord_id,
    billing_plan_id,
    status,
    trial_start_date,
    trial_end_date,
    sms_credits_balance,
    auto_renewal
  )
  VALUES (
    target_landlord_id,
    trial_plan_id,
    'trial',
    now(),
    now() + interval '30 days',
    100,
    true
  ) ON CONFLICT (landlord_id) DO NOTHING;
END $$;

-- Create default billing settings if none exist

-- Create function to auto-create subscriptions for new landlords
CREATE OR REPLACE FUNCTION public.create_default_landlord_subscription()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  trial_plan_id uuid;
  new_landlord_id uuid;
BEGIN
  -- Store the user_id in a local variable to avoid ambiguity
  new_landlord_id := NEW.user_id;
  
  -- Only create subscription for landlord role
  IF NEW.role = 'Landlord'::public.app_role THEN
    -- Get the first active billing plan (trial plan)
    SELECT id INTO trial_plan_id 
    FROM public.billing_plans 
    WHERE is_active = true 
    ORDER BY created_at ASC 
    LIMIT 1;
    
    -- Create subscription if plan exists
    IF trial_plan_id IS NOT NULL THEN
      INSERT INTO public.landlord_subscriptions (
        landlord_id,
        billing_plan_id,
        status,
        trial_start_date,
        trial_end_date,
        sms_credits_balance,
        auto_renewal
      )
      VALUES (
        new_landlord_id,
        trial_plan_id,
        'trial',
        now(),
        now() + interval '30 days',
        100,
        true
      ) ON CONFLICT (landlord_id) DO NOTHING;
    END IF;
  END IF;
  
  RETURN NEW;
END;
$$;

-- Create trigger to auto-create subscriptions when user roles are assigned
DROP TRIGGER IF EXISTS auto_create_landlord_subscription ON public.user_roles;
CREATE TRIGGER auto_create_landlord_subscription
  AFTER INSERT ON public.user_roles
  FOR EACH ROW
  EXECUTE FUNCTION public.create_default_landlord_subscription();


-- Migration: 20250804154348_167ff395-6e10-42c6-8b35-59b197702967.sql

-- Create table for pre-approved payment methods by country
CREATE TABLE public.approved_payment_methods (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  country_code TEXT NOT NULL,
  payment_method_type TEXT NOT NULL, -- 'mpesa', 'card', 'bank_transfer', etc.
  provider_name TEXT NOT NULL,
  is_active BOOLEAN DEFAULT true,
  configuration JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.approved_payment_methods ENABLE ROW LEVEL SECURITY;

-- Create policies
CREATE POLICY "Admins can manage approved payment methods" 
ON public.approved_payment_methods 
FOR ALL 
USING (has_role(auth.uid(), 'Admin'::app_role));

CREATE POLICY "Landlords can view approved payment methods" 
ON public.approved_payment_methods 
FOR SELECT 
USING (has_role(auth.uid(), 'Landlord'::app_role));

-- Insert default approved payment methods for Kenya

-- Create trigger for automatic timestamp updates
CREATE TRIGGER update_approved_payment_methods_updated_at
BEFORE UPDATE ON public.approved_payment_methods
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();


-- Migration: 20250804195309_9806cfb8-08e8-4162-9e4d-24d2f9821776.sql

-- Update billing plans currency from USD to KES


-- Migration: 20250804200639_aa74f37f-b553-4c00-a3f0-c0c2b3151798.sql

-- Create service charge invoices table for tracking landlord billing
CREATE TABLE public.service_charge_invoices (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  landlord_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  invoice_number TEXT NOT NULL UNIQUE,
  billing_period_start DATE NOT NULL,
  billing_period_end DATE NOT NULL,
  
  -- Breakdown of charges
  rent_collected DECIMAL(12,2) NOT NULL DEFAULT 0,
  service_charge_rate DECIMAL(5,2), -- percentage rate or fixed amount
  service_charge_amount DECIMAL(12,2) NOT NULL DEFAULT 0,
  sms_charges DECIMAL(12,2) NOT NULL DEFAULT 0,
  other_charges DECIMAL(12,2) NOT NULL DEFAULT 0,
  total_amount DECIMAL(12,2) NOT NULL DEFAULT 0,
  
  -- Payment details
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'paid', 'overdue', 'cancelled')),
  payment_method TEXT,
  payment_reference TEXT,
  payment_date TIMESTAMP WITH TIME ZONE,
  due_date DATE NOT NULL,
  
  -- Additional details
  notes TEXT,
  currency TEXT NOT NULL DEFAULT 'KES',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.service_charge_invoices ENABLE ROW LEVEL SECURITY;

-- Create policies
CREATE POLICY "Landlords can view their own service charge invoices" 
ON public.service_charge_invoices 
FOR SELECT 
USING (landlord_id = auth.uid());

CREATE POLICY "Admins can manage all service charge invoices" 
ON public.service_charge_invoices 
FOR ALL 
USING (has_role(auth.uid(), 'Admin'::app_role));

CREATE POLICY "System can insert service charge invoices" 
ON public.service_charge_invoices 
FOR INSERT 
WITH CHECK (true);

CREATE POLICY "Landlords can update their own invoice payment details" 
ON public.service_charge_invoices 
FOR UPDATE 
USING (landlord_id = auth.uid())
WITH CHECK (landlord_id = auth.uid());

-- Create function to update updated_at
CREATE TRIGGER update_service_charge_invoices_updated_at
BEFORE UPDATE ON public.service_charge_invoices
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Create payment methods preferences table for landlords
CREATE TABLE public.landlord_payment_preferences (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  landlord_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE UNIQUE,
  preferred_payment_method TEXT NOT NULL DEFAULT 'mpesa',
  mpesa_phone_number TEXT,
  bank_account_details JSONB,
  auto_payment_enabled BOOLEAN DEFAULT false,
  payment_reminders_enabled BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.landlord_payment_preferences ENABLE ROW LEVEL SECURITY;

-- Create policies
CREATE POLICY "Landlords can manage their own payment preferences" 
ON public.landlord_payment_preferences 
FOR ALL 
USING (landlord_id = auth.uid())
WITH CHECK (landlord_id = auth.uid());

CREATE POLICY "Admins can view all payment preferences" 
ON public.landlord_payment_preferences 
FOR SELECT 
USING (has_role(auth.uid(), 'Admin'::app_role));

-- Create function to generate invoice numbers
CREATE OR REPLACE FUNCTION public.generate_service_invoice_number()
RETURNS TEXT
LANGUAGE plpgsql
AS $$
DECLARE
  invoice_number TEXT;
  current_year TEXT;
  counter INTEGER;
BEGIN
  current_year := EXTRACT(YEAR FROM now())::TEXT;
  
  -- Get the next counter for this year
  SELECT COALESCE(MAX(
    CASE 
      WHEN invoice_number ~ ('^SRV-' || current_year || '-\d+$') 
      THEN (regexp_split_to_array(invoice_number, '-'))[3]::INTEGER
      ELSE 0
    END
  ), 0) + 1
  INTO counter
  FROM public.service_charge_invoices
  WHERE invoice_number LIKE 'SRV-' || current_year || '-%';
  
  invoice_number := 'SRV-' || current_year || '-' || LPAD(counter::TEXT, 6, '0');
  
  RETURN invoice_number;
END;
$$;

-- Update properties table to fix country consistency


-- Migration: 20250804200701_960347b8-dc94-4183-8d6b-54eafce43e29.sql

-- Create service charge invoices table
CREATE TABLE public.service_charge_invoices (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  landlord_id UUID NOT NULL,
  invoice_number TEXT NOT NULL UNIQUE,
  billing_period_start DATE NOT NULL,
  billing_period_end DATE NOT NULL,
  total_rent_collected NUMERIC NOT NULL DEFAULT 0,
  service_charge_rate NUMERIC NOT NULL DEFAULT 2,
  service_charge_amount NUMERIC NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'paid', 'overdue', 'cancelled')),
  due_date DATE NOT NULL,
  paid_at TIMESTAMP WITH TIME ZONE,
  payment_method TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create landlord payment preferences table
CREATE TABLE public.landlord_payment_preferences (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  landlord_id UUID NOT NULL UNIQUE,
  preferred_payment_method TEXT NOT NULL DEFAULT 'mpesa',
  auto_pay_enabled BOOLEAN DEFAULT false,
  payment_day_of_month INTEGER DEFAULT 1 CHECK (payment_day_of_month >= 1 AND payment_day_of_month <= 28),
  notification_enabled BOOLEAN DEFAULT true,
  reminder_days_before INTEGER DEFAULT 3,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.service_charge_invoices ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.landlord_payment_preferences ENABLE ROW LEVEL SECURITY;

-- RLS policies for service_charge_invoices
CREATE POLICY "Landlords can manage their own service charge invoices"
ON public.service_charge_invoices
FOR ALL
USING (landlord_id = auth.uid())
WITH CHECK (landlord_id = auth.uid());

CREATE POLICY "Admins can manage all service charge invoices"
ON public.service_charge_invoices
FOR ALL
USING (has_role(auth.uid(), 'Admin'::app_role));

-- RLS policies for landlord_payment_preferences  
CREATE POLICY "Landlords can manage their own payment preferences"
ON public.landlord_payment_preferences
FOR ALL
USING (landlord_id = auth.uid())
WITH CHECK (landlord_id = auth.uid());

CREATE POLICY "Admins can manage all payment preferences"
ON public.landlord_payment_preferences
FOR ALL
USING (has_role(auth.uid(), 'Admin'::app_role));

-- Create triggers for updated_at
CREATE TRIGGER update_service_charge_invoices_updated_at
  BEFORE UPDATE ON public.service_charge_invoices
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_landlord_payment_preferences_updated_at
  BEFORE UPDATE ON public.landlord_payment_preferences
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Function to generate service invoice numbers
CREATE OR REPLACE FUNCTION public.generate_service_invoice_number()
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  invoice_number TEXT;
  counter INTEGER;
BEGIN
  -- Get the next counter value for this month
  SELECT COALESCE(MAX(
    CASE 
      WHEN invoice_number ~ '^SVC-[0-9]{6}-[0-9]{4}$' 
      THEN CAST(RIGHT(invoice_number, 4) AS INTEGER)
      ELSE 0
    END
  ), 0) + 1
  INTO counter
  FROM public.service_charge_invoices
  WHERE invoice_number LIKE 'SVC-' || TO_CHAR(NOW(), 'YYYYMM') || '-%';
  
  -- Generate the invoice number
  invoice_number := 'SVC-' || TO_CHAR(NOW(), 'YYYYMM') || '-' || LPAD(counter::TEXT, 4, '0');
  
  RETURN invoice_number;
END;
$$;

-- Update country data to Kenya for consistency


-- Migration: 20250804201121_8535563c-393c-428c-90e5-fc03c7a37dc3.sql

-- Fix function security by setting search_path
CREATE OR REPLACE FUNCTION public.generate_service_invoice_number()
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  invoice_number TEXT;
  current_year TEXT;
  counter INTEGER;
BEGIN
  current_year := EXTRACT(YEAR FROM now())::TEXT;
  
  -- Get the next counter for this year
  SELECT COALESCE(MAX(
    CASE 
      WHEN invoice_number ~ ('^SRV-' || current_year || '-\d+$') 
      THEN (regexp_split_to_array(invoice_number, '-'))[3]::INTEGER
      ELSE 0
    END
  ), 0) + 1
  INTO counter
  FROM public.service_charge_invoices
  WHERE invoice_number LIKE 'SRV-' || current_year || '-%';
  
  invoice_number := 'SRV-' || current_year || '-' || LPAD(counter::TEXT, 6, '0');
  
  RETURN invoice_number;
END;
$$;


-- Migration: 20250804210224_59f6845f-97e8-4644-a115-1175cb4b6758.sql

-- Add some sample SMS usage data for testing


-- Migration: 20250806203232_dcb1be31-2a6c-497d-ade5-b151834b8c9c.sql

-- Fix search path security for all functions without proper search_path setting
-- This prevents SQL injection attacks through search_path manipulation

-- Fix generate_service_invoice_number function
CREATE OR REPLACE FUNCTION public.generate_service_invoice_number()
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $$
DECLARE
  invoice_number TEXT;
  current_year TEXT;
  counter INTEGER;
BEGIN
  current_year := EXTRACT(YEAR FROM now())::TEXT;
  
  -- Get the next counter for this year
  SELECT COALESCE(MAX(
    CASE 
      WHEN invoice_number ~ ('^SRV-' || current_year || '-\d+$') 
      THEN (regexp_split_to_array(invoice_number, '-'))[3]::INTEGER
      ELSE 0
    END
  ), 0) + 1
  INTO counter
  FROM public.service_charge_invoices
  WHERE invoice_number LIKE 'SRV-' || current_year || '-%';
  
  invoice_number := 'SRV-' || current_year || '-' || LPAD(counter::TEXT, 6, '0');
  
  RETURN invoice_number;
END;
$$;

-- Fix create_user_with_role function
CREATE OR REPLACE FUNCTION public.create_user_with_role(p_email text, p_first_name text, p_last_name text, p_phone text, p_role app_role)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $$
DECLARE
  new_user_id uuid;
  temp_password text;
BEGIN
  -- Generate a temporary password
  temp_password := 'TempPass' || floor(random() * 10000)::text || '!';
  
  -- For now, we'll create a profile entry and user role
  -- In production, this would integrate with Supabase Auth API
  new_user_id := gen_random_uuid();
  
  -- Insert profile
  INSERT INTO public.profiles (id, first_name, last_name, email, phone)
  VALUES (new_user_id, p_first_name, p_last_name, p_email, p_phone);
  
  -- Assign role
  INSERT INTO public.user_roles (user_id, role)
  VALUES (new_user_id, p_role);
  
  -- Return success with user info
  RETURN jsonb_build_object(
    'success', true,
    'user_id', new_user_id,
    'email', p_email,
    'temporary_password', temp_password,
    'message', 'User created successfully. They will need to complete signup with their email.'
  );
  
EXCEPTION WHEN OTHERS THEN
  RETURN jsonb_build_object(
    'success', false,
    'error', SQLERRM
  );
END;
$$;

-- Fix create_default_landlord_subscription function  
CREATE OR REPLACE FUNCTION public.create_default_landlord_subscription()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $$
DECLARE
  trial_plan_id uuid;
  new_landlord_id uuid;
BEGIN
  -- Store the user_id in a local variable to avoid ambiguity
  new_landlord_id := NEW.user_id;
  
  -- Only create subscription for landlord role
  IF NEW.role = 'Landlord'::public.app_role THEN
    -- Get the first active billing plan (trial plan)
    SELECT id INTO trial_plan_id 
    FROM public.billing_plans 
    WHERE is_active = true 
    ORDER BY created_at ASC 
    LIMIT 1;
    
    -- Create subscription if plan exists
    IF trial_plan_id IS NOT NULL THEN
      INSERT INTO public.landlord_subscriptions (
        landlord_id,
        billing_plan_id,
        status,
        trial_start_date,
        trial_end_date,
        sms_credits_balance,
        auto_renewal
      )
      VALUES (
        new_landlord_id,
        trial_plan_id,
        'trial',
        now(),
        now() + interval '30 days',
        100,
        true
      ) ON CONFLICT (landlord_id) DO NOTHING;
    END IF;
  END IF;
  
  RETURN NEW;
END;
$$;

-- Fix handle_new_user function
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $$
BEGIN
  -- Insert into profiles table
  INSERT INTO public.profiles (id, first_name, last_name, phone, email)
  VALUES (
    NEW.id, 
    NEW.raw_user_meta_data ->> 'first_name', 
    NEW.raw_user_meta_data ->> 'last_name',
    NEW.raw_user_meta_data ->> 'phone',
    NEW.email
  );
  
  -- Assign role based on user metadata, default to 'Agent' if not specified
  INSERT INTO public.user_roles (user_id, role)
  VALUES (
    NEW.id, 
    COALESCE(
      (NEW.raw_user_meta_data ->> 'role')::public.app_role,
      'Agent'::public.app_role
    )
  );
  
  RETURN NEW;
END;
$$;

-- Fix log_maintenance_action function
CREATE OR REPLACE FUNCTION public.log_maintenance_action(_maintenance_request_id uuid, _user_id uuid, _action_type text, _old_value text DEFAULT NULL::text, _new_value text DEFAULT NULL::text, _details jsonb DEFAULT NULL::jsonb)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $$
BEGIN
  INSERT INTO public.maintenance_action_logs (
    maintenance_request_id, user_id, action_type, old_value, new_value, details
  ) VALUES (
    _maintenance_request_id, _user_id, _action_type, _old_value, _new_value, _details
  );
END;
$$;


-- Migration: 20250806203347_728e23e2-b992-40d8-85c3-a3bc8b1cc1d7.sql

-- Step 2: Fix critical RLS policy security issues for proper data isolation

-- Properties table has overly permissive policies for landlords
-- Replace the broad "Landlords can manage all properties" policy with proper ownership-based access

-- Drop the overly permissive policy
DROP POLICY IF EXISTS "Landlords can manage all properties" ON public.properties;

-- Create secure ownership-based policies for landlords
CREATE POLICY "Property owners can manage their own properties" 
ON public.properties 
FOR ALL 
TO authenticated
USING (auth.uid() = owner_id OR auth.uid() = manager_id);

-- Fix similar issues with units table - ensure landlords only see their units  
DROP POLICY IF EXISTS "Property stakeholders can manage units" ON public.units;

CREATE POLICY "Property stakeholders can manage their units" 
ON public.units 
FOR ALL 
TO authenticated  
USING (
  EXISTS (
    SELECT 1 FROM public.properties p 
    WHERE p.id = units.property_id 
    AND (p.owner_id = auth.uid() OR p.manager_id = auth.uid())
  ) 
  OR has_role(auth.uid(), 'Admin'::app_role)
);

-- Fix tenants table - remove overly broad role access
DROP POLICY IF EXISTS "Property stakeholders can manage tenants" ON public.tenants;

CREATE POLICY "Property owners can manage their tenants" 
ON public.tenants 
FOR ALL 
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.leases l
    JOIN public.units u ON l.unit_id = u.id  
    JOIN public.properties p ON u.property_id = p.id
    WHERE l.tenant_id = tenants.id
    AND (p.owner_id = auth.uid() OR p.manager_id = auth.uid())
  )
  OR has_role(auth.uid(), 'Admin'::app_role)
);

-- Fix leases table security
DROP POLICY IF EXISTS "Property stakeholders can manage leases" ON public.leases;

CREATE POLICY "Property owners can manage their leases" 
ON public.leases 
FOR ALL 
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.units u
    JOIN public.properties p ON u.property_id = p.id
    WHERE u.id = leases.unit_id
    AND (p.owner_id = auth.uid() OR p.manager_id = auth.uid())
  )
  OR has_role(auth.uid(), 'Admin'::app_role)
);

-- Fix expenses table  
DROP POLICY IF EXISTS "Property stakeholders can manage expenses" ON public.expenses;

CREATE POLICY "Property owners can manage their expenses" 
ON public.expenses 
FOR ALL 
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.properties p 
    WHERE p.id = expenses.property_id 
    AND (p.owner_id = auth.uid() OR p.manager_id = auth.uid())
  )
  OR has_role(auth.uid(), 'Admin'::app_role)
);

-- Fix maintenance requests
DROP POLICY IF EXISTS "Property stakeholders can manage maintenance requests" ON public.maintenance_requests;

CREATE POLICY "Property owners can manage their maintenance requests" 
ON public.maintenance_requests 
FOR ALL 
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.properties p 
    WHERE p.id = maintenance_requests.property_id 
    AND (p.owner_id = auth.uid() OR p.manager_id = auth.uid())
  )
  OR has_role(auth.uid(), 'Admin'::app_role)
);

-- Fix payments table
DROP POLICY IF EXISTS "Property stakeholders can manage payments" ON public.payments;

CREATE POLICY "Property owners can manage their payments" 
ON public.payments 
FOR ALL 
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.leases l
    JOIN public.units u ON l.unit_id = u.id
    JOIN public.properties p ON u.property_id = p.id
    WHERE l.id = payments.lease_id
    AND (p.owner_id = auth.uid() OR p.manager_id = auth.uid())
  )
  OR has_role(auth.uid(), 'Admin'::app_role)
);

-- Fix invoices table 
DROP POLICY IF EXISTS "Property stakeholders can manage invoices" ON public.invoices;

CREATE POLICY "Property owners can manage their invoices" 
ON public.invoices 
FOR ALL 
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.leases l
    JOIN public.units u ON l.unit_id = u.id  
    JOIN public.properties p ON u.property_id = p.id
    WHERE l.id = invoices.lease_id
    AND (p.owner_id = auth.uid() OR p.manager_id = auth.uid())
  )
  OR has_role(auth.uid(), 'Admin'::app_role)
);


-- Migration: 20250806203540_eb4b778e-62b9-46fb-94d6-3a8eb2333105.sql

-- Step 3: Add triggers to automatically set owner_id fields for security

-- Add trigger function to set owner_id automatically for properties
CREATE OR REPLACE FUNCTION public.set_property_owner()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $$
BEGIN
  -- Set owner_id to the authenticated user
  NEW.owner_id := auth.uid();
  RETURN NEW;
END;
$$;

-- Create trigger for properties table
DROP TRIGGER IF EXISTS trigger_set_property_owner ON public.properties;
CREATE TRIGGER trigger_set_property_owner
  BEFORE INSERT ON public.properties
  FOR EACH ROW
  EXECUTE FUNCTION public.set_property_owner();

-- Add similar function for expenses
CREATE OR REPLACE FUNCTION public.set_expense_creator()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $$
BEGIN
  -- Set created_by to the authenticated user
  NEW.created_by := auth.uid();
  RETURN NEW;
END;
$$;

-- Create trigger for expenses table
DROP TRIGGER IF EXISTS trigger_set_expense_creator ON public.expenses;
CREATE TRIGGER trigger_set_expense_creator
  BEFORE INSERT ON public.expenses
  FOR EACH ROW
  EXECUTE FUNCTION public.set_expense_creator();

-- Add function for tenant announcements
CREATE OR REPLACE FUNCTION public.set_announcement_creator()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $$
BEGIN
  -- Set created_by to the authenticated user
  NEW.created_by := auth.uid();
  RETURN NEW;
END;
$$;

-- Create trigger for tenant announcements
DROP TRIGGER IF EXISTS trigger_set_announcement_creator ON public.tenant_announcements;
CREATE TRIGGER trigger_set_announcement_creator
  BEFORE INSERT ON public.tenant_announcements
  FOR EACH ROW
  EXECUTE FUNCTION public.set_announcement_creator();


-- Migration: 20250806211328_6a6b93be-99c9-477d-a440-ed4a01eab47a.sql

-- Create trial management and onboarding tables
CREATE TABLE public.trial_configurations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  billing_plan_id UUID REFERENCES public.billing_plans(id) ON DELETE CASCADE,
  trial_duration_days INTEGER NOT NULL DEFAULT 30,
  features_enabled JSONB NOT NULL DEFAULT '[]',
  limitations JSONB NOT NULL DEFAULT '{}',
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create onboarding steps configuration
CREATE TABLE public.onboarding_steps (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  step_name TEXT NOT NULL,
  step_order INTEGER NOT NULL,
  title TEXT NOT NULL,
  description TEXT,
  component_name TEXT NOT NULL,
  is_required BOOLEAN NOT NULL DEFAULT true,
  user_roles TEXT[] NOT NULL DEFAULT ARRAY['Landlord'],
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create user onboarding progress tracking
CREATE TABLE public.user_onboarding_progress (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  step_id UUID REFERENCES public.onboarding_steps(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'in_progress', 'completed', 'skipped')),
  started_at TIMESTAMP WITH TIME ZONE,
  completed_at TIMESTAMP WITH TIME ZONE,
  data JSONB DEFAULT '{}',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(user_id, step_id)
);

-- Create feature tours and tutorials
CREATE TABLE public.feature_tours (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tour_name TEXT NOT NULL UNIQUE,
  title TEXT NOT NULL,
  description TEXT,
  target_page TEXT NOT NULL,
  user_roles TEXT[] NOT NULL DEFAULT ARRAY['Landlord'],
  steps JSONB NOT NULL DEFAULT '[]',
  is_active BOOLEAN NOT NULL DEFAULT true,
  priority INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create user feature tour progress
CREATE TABLE public.user_tour_progress (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  tour_id UUID REFERENCES public.feature_tours(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'not_started' CHECK (status IN ('not_started', 'in_progress', 'completed', 'dismissed')),
  current_step INTEGER DEFAULT 0,
  completed_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(user_id, tour_id)
);

-- Create trial usage tracking
CREATE TABLE public.trial_usage_tracking (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  feature_name TEXT NOT NULL,
  usage_count INTEGER NOT NULL DEFAULT 1,
  last_used_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(user_id, feature_name)
);

-- Add trial-specific columns to landlord_subscriptions
ALTER TABLE public.landlord_subscriptions 
ADD COLUMN trial_features_enabled JSONB DEFAULT '[]',
ADD COLUMN trial_limitations JSONB DEFAULT '{}',
ADD COLUMN trial_usage_data JSONB DEFAULT '{}',
ADD COLUMN onboarding_completed BOOLEAN DEFAULT false,
ADD COLUMN onboarding_completed_at TIMESTAMP WITH TIME ZONE;

-- Enable RLS for all new tables
ALTER TABLE public.trial_configurations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.onboarding_steps ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_onboarding_progress ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.feature_tours ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_tour_progress ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.trial_usage_tracking ENABLE ROW LEVEL SECURITY;

-- Create RLS policies for trial_configurations
CREATE POLICY "Admins can manage trial configurations" ON public.trial_configurations
FOR ALL USING (has_role(auth.uid(), 'Admin'::app_role));

CREATE POLICY "Landlords can view active trial configurations" ON public.trial_configurations
FOR SELECT USING (is_active = true AND has_role(auth.uid(), 'Landlord'::app_role));

-- Create RLS policies for onboarding_steps
CREATE POLICY "Admins can manage onboarding steps" ON public.onboarding_steps
FOR ALL USING (has_role(auth.uid(), 'Admin'::app_role));

CREATE POLICY "Users can view their relevant onboarding steps" ON public.onboarding_steps
FOR SELECT USING (
  is_active = true AND (
    (has_role(auth.uid(), 'Admin'::app_role)) OR
    (has_role(auth.uid(), 'Landlord'::app_role) AND 'Landlord' = ANY(user_roles)) OR
    (EXISTS(SELECT 1 FROM tenants WHERE user_id = auth.uid()) AND 'Tenant' = ANY(user_roles))
  )
);

-- Create RLS policies for user_onboarding_progress
CREATE POLICY "Users can manage their own onboarding progress" ON public.user_onboarding_progress
FOR ALL USING (auth.uid() = user_id);

CREATE POLICY "Admins can view all onboarding progress" ON public.user_onboarding_progress
FOR SELECT USING (has_role(auth.uid(), 'Admin'::app_role));

-- Create RLS policies for feature_tours
CREATE POLICY "Admins can manage feature tours" ON public.feature_tours
FOR ALL USING (has_role(auth.uid(), 'Admin'::app_role));

CREATE POLICY "Users can view their relevant feature tours" ON public.feature_tours
FOR SELECT USING (
  is_active = true AND (
    (has_role(auth.uid(), 'Admin'::app_role)) OR
    (has_role(auth.uid(), 'Landlord'::app_role) AND 'Landlord' = ANY(user_roles)) OR
    (EXISTS(SELECT 1 FROM tenants WHERE user_id = auth.uid()) AND 'Tenant' = ANY(user_roles))
  )
);

-- Create RLS policies for user_tour_progress
CREATE POLICY "Users can manage their own tour progress" ON public.user_tour_progress
FOR ALL USING (auth.uid() = user_id);

CREATE POLICY "Admins can view all tour progress" ON public.user_tour_progress
FOR SELECT USING (has_role(auth.uid(), 'Admin'::app_role));

-- Create RLS policies for trial_usage_tracking
CREATE POLICY "Users can manage their own trial usage" ON public.trial_usage_tracking
FOR ALL USING (auth.uid() = user_id);

CREATE POLICY "Admins can view all trial usage" ON public.trial_usage_tracking
FOR SELECT USING (has_role(auth.uid(), 'Admin'::app_role));

-- Create function to update updated_at timestamp
CREATE OR REPLACE FUNCTION public.update_trial_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create triggers for updated_at
CREATE TRIGGER update_trial_configurations_updated_at
  BEFORE UPDATE ON public.trial_configurations
  FOR EACH ROW EXECUTE FUNCTION public.update_trial_updated_at();

CREATE TRIGGER update_onboarding_steps_updated_at
  BEFORE UPDATE ON public.onboarding_steps
  FOR EACH ROW EXECUTE FUNCTION public.update_trial_updated_at();

CREATE TRIGGER update_user_onboarding_progress_updated_at
  BEFORE UPDATE ON public.user_onboarding_progress
  FOR EACH ROW EXECUTE FUNCTION public.update_trial_updated_at();

CREATE TRIGGER update_feature_tours_updated_at
  BEFORE UPDATE ON public.feature_tours
  FOR EACH ROW EXECUTE FUNCTION public.update_trial_updated_at();

CREATE TRIGGER update_user_tour_progress_updated_at
  BEFORE UPDATE ON public.user_tour_progress
  FOR EACH ROW EXECUTE FUNCTION public.update_trial_updated_at();

CREATE TRIGGER update_trial_usage_tracking_updated_at
  BEFORE UPDATE ON public.trial_usage_tracking
  FOR EACH ROW EXECUTE FUNCTION public.update_trial_updated_at();

-- Insert default onboarding steps

-- Insert default feature tours

-- Insert default trial configuration


-- Migration: 20250806212453_5c572f9a-7214-4bd5-b9f9-b7485c65989f.sql

-- Fix the infinite recursion in tenants table RLS policy
-- The issue is likely in the policy that checks if a user exists in the tenants table

-- First, let's drop the problematic policy
DROP POLICY IF EXISTS "Tenants can view their own info" ON public.tenants;

-- Create a security definer function to check if user is a tenant
CREATE OR REPLACE FUNCTION public.is_user_tenant(_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.tenants
    WHERE user_id = _user_id
  )
$$;

-- Recreate the policy using the security definer function
CREATE POLICY "Tenants can view their own info" ON public.tenants
FOR SELECT
USING (auth.uid() = user_id);

-- Also check and fix any other policies that might be causing recursion
-- Let's also create a function to get tenant IDs for a user safely
CREATE OR REPLACE FUNCTION public.get_user_tenant_ids(_user_id uuid)
RETURNS uuid[]
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT array_agg(id)
  FROM public.tenants
  WHERE user_id = _user_id
$$;

-- Update any policies that might be using subqueries on tenants table
-- Check if there are any policies referencing tenants table in their conditions


-- Migration: 20250806212745_8839add4-2ebd-4d21-8af7-a340f2ee2fa1.sql

-- Fix the infinite recursion in the "Property owners can manage their tenants" policy
-- The issue is the EXISTS subquery that references the tenants table from within the tenants table policy

-- First, drop the problematic policy
DROP POLICY IF EXISTS "Property owners can manage their tenants" ON public.tenants;

-- Create a security definer function to check if user can manage a specific tenant
CREATE OR REPLACE FUNCTION public.can_user_manage_tenant(_user_id uuid, _tenant_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.leases l
    JOIN public.units u ON l.unit_id = u.id
    JOIN public.properties p ON u.property_id = p.id
    WHERE l.tenant_id = _tenant_id 
      AND (p.owner_id = _user_id OR p.manager_id = _user_id)
  ) OR EXISTS (
    SELECT 1
    FROM public.user_roles ur
    WHERE ur.user_id = _user_id AND ur.role = 'Admin'
  );
$$;

-- Recreate the policy using the security definer function
CREATE POLICY "Property owners can manage their tenants" ON public.tenants
FOR ALL
USING (public.can_user_manage_tenant(auth.uid(), id));


-- Migration: 20250806213451_b3c9d2e5-8eb6-4cf3-bbc9-60984f9cd380.sql

-- Add trial expiration status management
-- Add new status types for trial lifecycle
ALTER TYPE app_role ADD VALUE IF NOT EXISTS 'System';

-- Create trial notification templates table
CREATE TABLE IF NOT EXISTS public.trial_notification_templates (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  template_name text NOT NULL,
  notification_type text NOT NULL,
  days_before_expiry integer NOT NULL DEFAULT 0,
  subject text NOT NULL,
  html_content text NOT NULL,
  email_content text NOT NULL,
  is_active boolean DEFAULT true,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Enable RLS on trial notification templates
ALTER TABLE public.trial_notification_templates ENABLE ROW LEVEL SECURITY;

-- Create policy for admins to manage templates
CREATE POLICY "Admins can manage trial notification templates" 
ON public.trial_notification_templates 
FOR ALL 
USING (has_role(auth.uid(), 'Admin'::app_role));

-- Create trial status log table for tracking status changes
CREATE TABLE IF NOT EXISTS public.trial_status_logs (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  landlord_id uuid NOT NULL,
  old_status text,
  new_status text NOT NULL,
  reason text,
  metadata jsonb DEFAULT '{}',
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Enable RLS on trial status logs
ALTER TABLE public.trial_status_logs ENABLE ROW LEVEL SECURITY;

-- Create policies for trial status logs
CREATE POLICY "Admins can view all trial status logs" 
ON public.trial_status_logs 
FOR SELECT 
USING (has_role(auth.uid(), 'Admin'::app_role));

CREATE POLICY "Landlords can view their own trial status logs" 
ON public.trial_status_logs 
FOR SELECT 
USING (landlord_id = auth.uid());

CREATE POLICY "System can insert trial status logs" 
ON public.trial_status_logs 
FOR INSERT 
WITH CHECK (true);

-- Function to check trial limitations
CREATE OR REPLACE FUNCTION public.check_trial_limitation(_user_id uuid, _feature text, _current_count integer DEFAULT 1)
RETURNS boolean
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  subscription_record RECORD;
  feature_limit integer;
BEGIN
  -- Get subscription info
  SELECT * INTO subscription_record
  FROM public.landlord_subscriptions
  WHERE landlord_id = _user_id;
  
  -- If no subscription or not on trial, allow
  IF subscription_record IS NULL OR subscription_record.status != 'trial' THEN
    RETURN true;
  END IF;
  
  -- Check if trial is expired
  IF subscription_record.trial_end_date < now() THEN
    RETURN false;
  END IF;
  
  -- Get feature limit from trial_limitations
  feature_limit := (subscription_record.trial_limitations ->> _feature)::integer;
  
  -- If no limit set, allow
  IF feature_limit IS NULL THEN
    RETURN true;
  END IF;
  
  -- Check if current count exceeds limit
  RETURN _current_count <= feature_limit;
END;
$$;

-- Function to get trial status with grace period
CREATE OR REPLACE FUNCTION public.get_trial_status(_user_id uuid)
RETURNS text
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  subscription_record RECORD;
  grace_period_days integer := 7;
BEGIN
  -- Get subscription info
  SELECT * INTO subscription_record
  FROM public.landlord_subscriptions
  WHERE landlord_id = _user_id;
  
  -- If no subscription, return null
  IF subscription_record IS NULL THEN
    RETURN NULL;
  END IF;
  
  -- Return current status if not trial-related
  IF subscription_record.status NOT IN ('trial', 'trial_expired', 'suspended') THEN
    RETURN subscription_record.status;
  END IF;
  
  -- Check trial status based on dates
  IF subscription_record.trial_end_date IS NULL THEN
    RETURN 'trial';
  END IF;
  
  -- Active trial
  IF now() <= subscription_record.trial_end_date THEN
    RETURN 'trial';
  END IF;
  
  -- Grace period
  IF now() <= (subscription_record.trial_end_date + interval '7 days') THEN
    RETURN 'trial_expired';
  END IF;
  
  -- Suspended after grace period
  RETURN 'suspended';
END;
$$;

-- Function to log trial status changes
CREATE OR REPLACE FUNCTION public.log_trial_status_change(_landlord_id uuid, _old_status text, _new_status text, _reason text DEFAULT NULL, _metadata jsonb DEFAULT '{}')
RETURNS void
LANGUAGE sql
SECURITY DEFINER
SET search_path = ''
AS $$
  INSERT INTO public.trial_status_logs (landlord_id, old_status, new_status, reason, metadata)
  VALUES (_landlord_id, _old_status, _new_status, _reason, _metadata);
$$;

-- Insert default trial notification templates

-- Create trigger to update trial notification templates timestamps
CREATE TRIGGER update_trial_notification_templates_updated_at
    BEFORE UPDATE ON public.trial_notification_templates
    FOR EACH ROW
    EXECUTE FUNCTION public.update_updated_at_column();


-- Migration: 20250806213833_fbb330e1-4587-41be-ae58-8eed1bf6c31b.sql

-- Create cron job to run trial manager daily
-- First enable the pg_cron extension if not already enabled
CREATE EXTENSION IF NOT EXISTS pg_cron;
CREATE EXTENSION IF NOT EXISTS pg_net;

-- Schedule the trial manager to run daily at 8:00 AM
SELECT cron.schedule(
  'daily-trial-manager',
  '0 8 * * *', -- Daily at 8:00 AM
  $$
  SELECT
    net.http_post(
        url:='https://kdpqimetajnhcqseajok.supabase.co/functions/v1/trial-manager',
        headers:='{"Content-Type": "application/json", "Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImtkcHFpbWV0YWpuaGNxc2Vham9rIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTQwMDQxMTAsImV4cCI6MjA2OTU4MDExMH0.VkqXvocYAYO6RQeDaFv8wVrq2xoKKfQ8UVj41az7ZSk"}'::jsonb,
        body:='{"source": "cron"}'::jsonb
    ) as request_id;
  $$
);


-- Migration: 20250806221300_41935113-1cce-48fd-aefb-b2c9ff65745b.sql

-- Create trial notification templates with pre-populated content

-- Update the trial-manager cron job to also trigger trial reminders
SELECT cron.unschedule('daily-trial-manager');

-- Schedule both trial manager and reminder service to run daily at 8:00 AM
SELECT cron.schedule(
  'daily-trial-manager',
  '0 8 * * *', -- Daily at 8:00 AM
  $$
  SELECT
    net.http_post(
        url:='https://kdpqimetajnhcqseajok.supabase.co/functions/v1/trial-manager',
        headers:='{"Content-Type": "application/json", "Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImtkcHFpbWV0YWpuaGNxc2Vham9rIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTQwMDQxMTAsImV4cCI6MjA2OTU4MDExMH0.VkqXvocYAYO6RQeDaFv8wVrq2xoKKfQ8UVj41az7ZSk"}'::jsonb,
        body:='{"source": "cron"}'::jsonb
    ) as request_id;
  $$
);

-- Schedule trial reminder service to run daily at 9:00 AM (1 hour after trial manager)
SELECT cron.schedule(
  'daily-trial-reminders',
  '0 9 * * *', -- Daily at 9:00 AM
  $$
  SELECT
    net.http_post(
        url:='https://kdpqimetajnhcqseajok.supabase.co/functions/v1/trial-reminder',
        headers:='{"Content-Type": "application/json", "Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImtkcHFpbWV0YWpuaGNxc2Vham9rIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTQwMDQxMTAsImV4cCI6MjA2OTU4MDExMH0.VkqXvocYAYO6RQeDaFv8wVrq2xoKKfQ8UVj41az7ZSk"}'::jsonb,
        body:='{"source": "cron"}'::jsonb
    ) as request_id;
  $$
);


-- Migration: 20250806222808_2fd240c6-44d4-4308-9404-a3764e10b526.sql

-- Get the current user's ID and assign Admin role
DO $$
DECLARE
    current_user_id uuid;
BEGIN
    -- Get the authenticated user's ID
    SELECT auth.uid() INTO current_user_id;
    
    -- Insert Admin role for the current user if not exists
    INSERT INTO public.user_roles (user_id, role)
    VALUES (current_user_id, 'Admin'::app_role)
    ON CONFLICT (user_id, role) DO NOTHING;
END $$;

-- Update RLS policies for trial_notification_templates to allow Landlords as well
DROP POLICY IF EXISTS "Admins can manage trial notification templates" ON public.trial_notification_templates;
DROP POLICY IF EXISTS "Landlords can view trial notification templates" ON public.trial_notification_templates;

-- Create more permissive policies
CREATE POLICY "Admins and Landlords can manage trial notification templates" 
ON public.trial_notification_templates 
FOR ALL 
USING (has_role(auth.uid(), 'Admin'::app_role) OR has_role(auth.uid(), 'Landlord'::app_role))
WITH CHECK (has_role(auth.uid(), 'Admin'::app_role) OR has_role(auth.uid(), 'Landlord'::app_role));


-- Migration: 20250806223123_51a9e37c-74d3-4ece-8122-c944387a5c2e.sql

-- Update RLS policies for trial_notification_templates to allow Landlords as well
DROP POLICY IF EXISTS "Admins can manage trial notification templates" ON public.trial_notification_templates;
DROP POLICY IF EXISTS "Landlords can view trial notification templates" ON public.trial_notification_templates;

-- Create more permissive policies
CREATE POLICY "Admins and Landlords can manage trial notification templates" 
ON public.trial_notification_templates 
FOR ALL 
USING (has_role(auth.uid(), 'Admin'::app_role) OR has_role(auth.uid(), 'Landlord'::app_role))
WITH CHECK (has_role(auth.uid(), 'Admin'::app_role) OR has_role(auth.uid(), 'Landlord'::app_role));


-- Migration: 20250806223211_93daeb60-dca7-458d-8936-fa5d84bad60e.sql

-- Assign Admin role to the user profile we found


-- Migration: 20250807071253_cd0293a6-47c9-43a9-809a-bbbf195fabe3.sql

-- Create missing profile for user david.wanjau@deevabits.com

-- Assign default role (Agent) to the user 


-- Migration: 20250807071710_8eefa193-7bd3-4db7-99cb-f480ac647dbc.sql

-- Delete the user records we just created for david.wanjau@deevabits.com


-- Migration: 20250807072339_94b541bd-a285-405e-b963-8657c74578e1.sql

-- Create communication preferences table for admin settings
CREATE TABLE IF NOT EXISTS public.communication_preferences (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  setting_name text NOT NULL UNIQUE,
  email_enabled boolean NOT NULL DEFAULT true,
  sms_enabled boolean NOT NULL DEFAULT false,
  description text,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.communication_preferences ENABLE ROW LEVEL SECURITY;

-- Create policy for admins to manage communication preferences
CREATE POLICY "Admins can manage communication preferences" 
ON public.communication_preferences 
FOR ALL 
USING (has_role(auth.uid(), 'Admin'::app_role));

-- Insert default communication preferences

-- Create trigger for updated_at
CREATE TRIGGER update_communication_preferences_updated_at
BEFORE UPDATE ON public.communication_preferences
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();


-- Migration: 20250807073337_1302d5a0-cd13-42c4-af80-4eab50fc06b0.sql

-- Make phone numbers required for SMS communication
-- First, let's set a default phone number for existing users without one

-- Now make the phone field required
ALTER TABLE public.profiles 
ALTER COLUMN phone SET NOT NULL;

-- Add a check constraint to ensure phone numbers are properly formatted
ALTER TABLE public.profiles 
ADD CONSTRAINT phone_format_check 
CHECK (phone ~ '^\+[1-9]\d{1,14}$');

-- Update the user creation function to require phone
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $$
BEGIN
  -- Insert into profiles table with required phone
  INSERT INTO public.profiles (id, first_name, last_name, phone, email)
  VALUES (
    NEW.id, 
    NEW.raw_user_meta_data ->> 'first_name', 
    NEW.raw_user_meta_data ->> 'last_name',
    COALESCE(NEW.raw_user_meta_data ->> 'phone', NEW.phone, '+000000000000'),
    NEW.email
  );
  
  -- Assign role based on user metadata, default to 'Agent' if not specified
  INSERT INTO public.user_roles (user_id, role)
  VALUES (
    NEW.id, 
    COALESCE(
      (NEW.raw_user_meta_data ->> 'role')::public.app_role,
      'Agent'::public.app_role
    )
  );
  
  RETURN NEW;
END;
$$;


-- Migration: 20250807073835_8581fd44-f156-4154-8033-4c35d39870ee.sql

-- Update tenant_account_creation to be for all users, not just tenants

-- Add new communication preference for general user account creation if needed


-- Migration: 20250807080909_7a9d13c0-dd31-4579-b895-81dde45a34ea.sql

-- Create email_templates table
CREATE TABLE public.email_templates (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  subject TEXT NOT NULL,
  content TEXT NOT NULL,
  category TEXT NOT NULL DEFAULT 'general',
  variables TEXT[] NOT NULL DEFAULT '{}',
  enabled BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create message_templates table
CREATE TABLE public.message_templates (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('sms', 'whatsapp')),
  category TEXT NOT NULL DEFAULT 'general',
  subject TEXT,
  content TEXT NOT NULL,
  variables TEXT[] NOT NULL DEFAULT '{}',
  enabled BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS on both tables
ALTER TABLE public.email_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.message_templates ENABLE ROW LEVEL SECURITY;

-- Create RLS policies for email_templates
CREATE POLICY "Admins can manage email templates" ON public.email_templates
FOR ALL USING (has_role(auth.uid(), 'Admin'::app_role));

-- Create RLS policies for message_templates
CREATE POLICY "Admins can manage message templates" ON public.message_templates
FOR ALL USING (has_role(auth.uid(), 'Admin'::app_role));

-- Create update triggers for both tables
CREATE TRIGGER update_email_templates_updated_at
BEFORE UPDATE ON public.email_templates
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_message_templates_updated_at
BEFORE UPDATE ON public.message_templates
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Insert default email templates

-- Insert default message templates


-- Migration: 20250807085939_afcfcc17-9271-4bd6-8e22-bdeb5a516077.sql

-- First, let's check for orphaned users (users in auth.users but not in profiles)
-- This will help us identify all affected users, not just gichukisimon@gmail.com

-- Recreate the missing trigger to prevent future issues
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = ''
AS $$
BEGIN
  -- Insert into profiles table with required phone
  INSERT INTO public.profiles (id, first_name, last_name, phone, email)
  VALUES (
    NEW.id, 
    NEW.raw_user_meta_data ->> 'first_name', 
    NEW.raw_user_meta_data ->> 'last_name',
    COALESCE(NEW.raw_user_meta_data ->> 'phone', NEW.phone, '+254700000000'),
    NEW.email
  );
  
  -- Assign role based on user metadata, default to 'Agent' if not specified
  INSERT INTO public.user_roles (user_id, role)
  VALUES (
    NEW.id, 
    COALESCE(
      (NEW.raw_user_meta_data ->> 'role')::public.app_role,
      'Agent'::public.app_role
    )
  );
  
  RETURN NEW;
END;
$$;

-- Create the trigger (drop first if it exists)
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Fix orphaned user data by finding users in auth.users who don't have profiles
-- and creating the missing data
WITH orphaned_users AS (
  SELECT 
    au.id,
    au.email,
    au.raw_user_meta_data->>'first_name' as first_name,
    au.raw_user_meta_data->>'last_name' as last_name,
    COALESCE(au.raw_user_meta_data->>'phone', au.phone, '+254700000000') as phone,
    COALESCE(au.raw_user_meta_data->>'role', 'Agent') as role
  FROM auth.users au
  LEFT JOIN public.profiles p ON au.id = p.id
  WHERE p.id IS NULL
)

-- Insert missing user roles for orphaned users
WITH orphaned_users AS (
  SELECT 
    au.id,
    COALESCE(au.raw_user_meta_data->>'role', 'Agent')::public.app_role as role
  FROM auth.users au
  LEFT JOIN public.user_roles ur ON au.id = ur.user_id
  WHERE ur.user_id IS NULL
)

-- Create landlord subscriptions for users with 'Landlord' or 'Manager' roles who don't have them
WITH landlord_users AS (
  SELECT DISTINCT ur.user_id
  FROM public.user_roles ur
  LEFT JOIN public.landlord_subscriptions ls ON ur.user_id = ls.landlord_id
  WHERE ur.role IN ('Landlord', 'Manager') 
    AND ls.landlord_id IS NULL
)


-- Migration: 20250807090011_a615ef65-fd03-4377-bbbf-a716725052ca.sql

-- Recreate the missing trigger to prevent future issues
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = ''
AS $$
BEGIN
  -- Insert into profiles table with required phone
  INSERT INTO public.profiles (id, first_name, last_name, phone, email)
  VALUES (
    NEW.id, 
    NEW.raw_user_meta_data ->> 'first_name', 
    NEW.raw_user_meta_data ->> 'last_name',
    COALESCE(NEW.raw_user_meta_data ->> 'phone', NEW.phone, '+254700000000'),
    NEW.email
  );
  
  -- Assign role based on user metadata, default to 'Agent' if not specified
  INSERT INTO public.user_roles (user_id, role)
  VALUES (
    NEW.id, 
    COALESCE(
      (NEW.raw_user_meta_data ->> 'role')::public.app_role,
      'Agent'::public.app_role
    )
  );
  
  RETURN NEW;
END;
$$;

-- Create the trigger (drop first if it exists)
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Fix orphaned user data by finding users in auth.users who don't have profiles

-- Insert missing user roles for orphaned users

-- Create landlord subscriptions for users with 'Landlord' or 'Manager' roles who don't have them


-- Migration: 20250807090126_401b3ee3-0ad1-404e-a6e3-29821096f85e.sql

-- Fix the search_path security issue for functions that don't have it set
-- This addresses the WARN 1: Function Search Path Mutable security warning

-- Fix the handle_new_user function to set search_path properly
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER 
SET search_path = ''
AS $$
BEGIN
  -- Insert into profiles table with required phone
  INSERT INTO public.profiles (id, first_name, last_name, phone, email)
  VALUES (
    NEW.id, 
    NEW.raw_user_meta_data ->> 'first_name', 
    NEW.raw_user_meta_data ->> 'last_name',
    COALESCE(NEW.raw_user_meta_data ->> 'phone', NEW.phone, '+254700000000'),
    NEW.email
  );
  
  -- Assign role based on user metadata, default to 'Agent' if not specified
  INSERT INTO public.user_roles (user_id, role)
  VALUES (
    NEW.id, 
    COALESCE(
      (NEW.raw_user_meta_data ->> 'role')::public.app_role,
      'Agent'::public.app_role
    )
  );
  
  RETURN NEW;
END;
$$;


-- Migration: 20250807091112_a4dcb479-f58e-4266-a0fd-ace8fd763b9b.sql

-- Update the create_default_landlord_subscription function to:
-- 1. Read trial period from billing_settings instead of hardcoded 30 days
-- 2. Expand role coverage to include Landlord, Manager, Agent roles
-- 3. Make SMS credits dynamic from settings

CREATE OR REPLACE FUNCTION public.create_default_landlord_subscription()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  trial_plan_id uuid;
  new_user_id uuid;
  trial_period_days integer := 30; -- Default fallback
  sms_credits_amount integer := 100; -- Default fallback
BEGIN
  -- Store the user_id in a local variable to avoid ambiguity
  new_user_id := NEW.user_id;
  
  -- Only create subscription for property-related roles
  IF NEW.role IN ('Landlord', 'Manager', 'Agent') THEN
    
    -- Get trial settings from billing_settings table
    SELECT 
      COALESCE((setting_value->>'trial_period_days')::integer, 30),
      COALESCE((setting_value->>'default_sms_credits')::integer, 100)
    INTO trial_period_days, sms_credits_amount
    FROM public.billing_settings 
    WHERE setting_key = 'trial_settings'
    LIMIT 1;
    
    -- Get the first active billing plan (trial plan)
    SELECT id INTO trial_plan_id 
    FROM public.billing_plans 
    WHERE is_active = true 
    ORDER BY created_at ASC 
    LIMIT 1;
    
    -- Create subscription if plan exists
    IF trial_plan_id IS NOT NULL THEN
      INSERT INTO public.landlord_subscriptions (
        landlord_id,
        billing_plan_id,
        status,
        trial_start_date,
        trial_end_date,
        sms_credits_balance,
        auto_renewal,
        trial_limitations
      )
      VALUES (
        new_user_id,
        trial_plan_id,
        'trial',
        now(),
        now() + (trial_period_days || ' days')::interval,
        sms_credits_amount,
        true,
        jsonb_build_object(
          'properties', 2,
          'units_per_property', 10,
          'tenants', 20,
          'maintenance_requests', 50,
          'invoices', 100
        )
      ) ON CONFLICT (landlord_id) DO NOTHING;
    END IF;
  END IF;
  
  RETURN NEW;
END;
$$;

-- Fix Simon Gichuki's trial period to 70 days instead of 30
-- First, find Simon's user ID and update his trial period

-- Ensure billing settings exist for trial configuration


-- Migration: 20250807091413_a5b8a4ba-1823-4ca1-9fe9-3dac319395d0.sql

-- Fix dmwangui@gmail.com role - remove Admin role, keep only Landlord

-- Ensure Simon Gichuki has a proper Free Trial billing plan assignment
-- First, get the Free Trial plan ID and assign it properly

-- Ensure the countdown feature works by setting proper trial limitations


-- Migration: 20250807092226_648313ea-1cdb-4a45-a274-43c713c317a3.sql

-- Fix missing subscription for John Kibe (Agent role)
-- Ensure Agents also get trial subscriptions


-- Migration: 20250807093224_9644bcbe-2411-4d84-a001-1149bacc9ade.sql

-- Unified Subscription Management Implementation

-- 1. First, get the Free Trial billing plan ID
DO $$
DECLARE
  free_trial_plan_id uuid;
BEGIN
  -- Get or create Free Trial plan
  SELECT id INTO free_trial_plan_id 
  FROM public.billing_plans 
  WHERE name = 'Free Trial' 
  LIMIT 1;
  
  -- If no Free Trial plan exists, create one
  IF free_trial_plan_id IS NULL THEN
    INSERT INTO public.billing_plans (
      name, 
      description, 
      price, 
      billing_cycle, 
      billing_model,
      max_properties,
      max_units,
      sms_credits_included,
      features,
      is_active,
      currency
    ) VALUES (
      'Free Trial',
      'Free trial with limited features for new property stakeholders',
      0,
      'trial',
      'percentage',
      2,
      10,
      100,
      '["Property Management", "Tenant Management", "Basic Reporting", "SMS Notifications"]'::jsonb,
      true,
      'KES'
    ) RETURNING id INTO free_trial_plan_id;
  END IF;
  
  -- 2. Update trigger function to assign actual Free Trial billing plan
  -- Drop existing trigger first
  DROP TRIGGER IF EXISTS trigger_create_default_landlord_subscription ON public.user_roles;
  
  -- Update the function to use actual billing plan
  CREATE OR REPLACE FUNCTION public.create_default_landlord_subscription()
  RETURNS trigger
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path TO ''
  AS $function$
  DECLARE
    trial_plan_id uuid;
    new_user_id uuid;
    trial_period_days integer := 30;
    sms_credits_amount integer := 100;
  BEGIN
    -- Store the user_id in a local variable
    new_user_id := NEW.user_id;
    
    -- Only create subscription for property-related roles
    IF NEW.role IN ('Landlord', 'Manager', 'Agent') THEN
      
      -- Get trial settings from billing_settings table
      SELECT 
        COALESCE((setting_value->>'trial_period_days')::integer, 30),
        COALESCE((setting_value->>'default_sms_credits')::integer, 100)
      INTO trial_period_days, sms_credits_amount
      FROM public.billing_settings 
      WHERE setting_key = 'trial_settings'
      LIMIT 1;
      
      -- Get the Free Trial billing plan
      SELECT id INTO trial_plan_id 
      FROM public.billing_plans 
      WHERE name = 'Free Trial' AND is_active = true
      LIMIT 1;
      
      -- Create subscription with actual billing plan
      IF trial_plan_id IS NOT NULL THEN
        INSERT INTO public.landlord_subscriptions (
          landlord_id,
          billing_plan_id,
          status,
          trial_start_date,
          trial_end_date,
          sms_credits_balance,
          auto_renewal,
          trial_limitations
        )
        VALUES (
          new_user_id,
          trial_plan_id,
          'trial',
          now(),
          now() + (trial_period_days || ' days')::interval,
          sms_credits_amount,
          true,
          jsonb_build_object(
            'properties', 2,
            'units_per_property', 10,
            'tenants', 20,
            'maintenance_requests', 50,
            'invoices', 100
          )
        ) ON CONFLICT (landlord_id) DO NOTHING;
      END IF;
    END IF;
    
    RETURN NEW;
  END;
  $function$;
  
  -- Recreate the trigger
  CREATE TRIGGER trigger_create_default_landlord_subscription
    AFTER INSERT ON public.user_roles
    FOR EACH ROW
    EXECUTE FUNCTION public.create_default_landlord_subscription();
  
  -- 3. Fix existing property stakeholders without proper subscriptions
  -- Create subscriptions for all property-related users who don't have them
  INSERT INTO public.landlord_subscriptions (
    landlord_id,
    billing_plan_id,
    status,
    trial_start_date,
    trial_end_date,
    sms_credits_balance,
    auto_renewal,
    trial_limitations
  )
  SELECT 
    ur.user_id,
    free_trial_plan_id,
    'trial',
    now(),
    now() + interval '30 days',
    100,
    true,
    jsonb_build_object(
      'properties', 2,
      'units_per_property', 10,
      'tenants', 20,
      'maintenance_requests', 50,
      'invoices', 100
    )
  FROM public.user_roles ur
  WHERE ur.role IN ('Landlord', 'Manager', 'Agent')
    AND NOT EXISTS (
      SELECT 1 FROM public.landlord_subscriptions ls 
      WHERE ls.landlord_id = ur.user_id
    );
  
  -- 4. Update existing subscriptions that don't have a billing plan
  UPDATE public.landlord_subscriptions 
  SET 
    billing_plan_id = free_trial_plan_id,
    updated_at = now()
  WHERE billing_plan_id IS NULL;
  
  -- 5. Ensure trial settings exist in billing_settings
  INSERT INTO public.billing_settings (setting_key, setting_value, description)
  VALUES (
    'trial_settings',
    jsonb_build_object(
      'trial_period_days', 30,
      'default_sms_credits', 100,
      'grace_period_days', 7
    ),
    'Trial subscription configuration settings'
  ) ON CONFLICT (setting_key) DO NOTHING;
  
  RAISE NOTICE 'Unified subscription management implementation completed successfully';
  
END $$;


-- Migration: 20250807093312_72edc0ae-0ad2-45bd-922b-8f38f63ff35d.sql

-- Unified Subscription Management Implementation (Fixed)

-- 1. First, get the Free Trial billing plan ID
DO $$
DECLARE
  free_trial_plan_id uuid;
BEGIN
  -- Get or create Free Trial plan
  SELECT id INTO free_trial_plan_id 
  FROM public.billing_plans 
  WHERE name = 'Free Trial' 
  LIMIT 1;
  
  -- If no Free Trial plan exists, create one with valid billing_cycle
  IF free_trial_plan_id IS NULL THEN
    INSERT INTO public.billing_plans (
      name, 
      description, 
      price, 
      billing_cycle, 
      billing_model,
      max_properties,
      max_units,
      sms_credits_included,
      features,
      is_active,
      currency
    ) VALUES (
      'Free Trial',
      'Free trial with limited features for new property stakeholders',
      0,
      'monthly',
      'percentage',
      2,
      10,
      100,
      '["Property Management", "Tenant Management", "Basic Reporting", "SMS Notifications"]'::jsonb,
      true,
      'KES'
    ) RETURNING id INTO free_trial_plan_id;
  END IF;
  
  -- 2. Update trigger function to assign actual Free Trial billing plan
  -- Drop existing trigger first
  DROP TRIGGER IF EXISTS trigger_create_default_landlord_subscription ON public.user_roles;
  
  -- Update the function to use actual billing plan
  CREATE OR REPLACE FUNCTION public.create_default_landlord_subscription()
  RETURNS trigger
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path TO ''
  AS $function$
  DECLARE
    trial_plan_id uuid;
    new_user_id uuid;
    trial_period_days integer := 30;
    sms_credits_amount integer := 100;
  BEGIN
    -- Store the user_id in a local variable
    new_user_id := NEW.user_id;
    
    -- Only create subscription for property-related roles
    IF NEW.role IN ('Landlord', 'Manager', 'Agent') THEN
      
      -- Get trial settings from billing_settings table
      SELECT 
        COALESCE((setting_value->>'trial_period_days')::integer, 30),
        COALESCE((setting_value->>'default_sms_credits')::integer, 100)
      INTO trial_period_days, sms_credits_amount
      FROM public.billing_settings 
      WHERE setting_key = 'trial_settings'
      LIMIT 1;
      
      -- Get the Free Trial billing plan
      SELECT id INTO trial_plan_id 
      FROM public.billing_plans 
      WHERE name = 'Free Trial' AND is_active = true
      LIMIT 1;
      
      -- Create subscription with actual billing plan
      IF trial_plan_id IS NOT NULL THEN
        INSERT INTO public.landlord_subscriptions (
          landlord_id,
          billing_plan_id,
          status,
          trial_start_date,
          trial_end_date,
          sms_credits_balance,
          auto_renewal,
          trial_limitations
        )
        VALUES (
          new_user_id,
          trial_plan_id,
          'trial',
          now(),
          now() + (trial_period_days || ' days')::interval,
          sms_credits_amount,
          true,
          jsonb_build_object(
            'properties', 2,
            'units_per_property', 10,
            'tenants', 20,
            'maintenance_requests', 50,
            'invoices', 100
          )
        ) ON CONFLICT (landlord_id) DO NOTHING;
      END IF;
    END IF;
    
    RETURN NEW;
  END;
  $function$;
  
  -- Recreate the trigger
  CREATE TRIGGER trigger_create_default_landlord_subscription
    AFTER INSERT ON public.user_roles
    FOR EACH ROW
    EXECUTE FUNCTION public.create_default_landlord_subscription();
  
  -- 3. Fix existing property stakeholders without proper subscriptions
  -- Create subscriptions for all property-related users who don't have them
  INSERT INTO public.landlord_subscriptions (
    landlord_id,
    billing_plan_id,
    status,
    trial_start_date,
    trial_end_date,
    sms_credits_balance,
    auto_renewal,
    trial_limitations
  )
  SELECT 
    ur.user_id,
    free_trial_plan_id,
    'trial',
    now(),
    now() + interval '30 days',
    100,
    true,
    jsonb_build_object(
      'properties', 2,
      'units_per_property', 10,
      'tenants', 20,
      'maintenance_requests', 50,
      'invoices', 100
    )
  FROM public.user_roles ur
  WHERE ur.role IN ('Landlord', 'Manager', 'Agent')
    AND NOT EXISTS (
      SELECT 1 FROM public.landlord_subscriptions ls 
      WHERE ls.landlord_id = ur.user_id
    );
  
  -- 4. Update existing subscriptions that don't have a billing plan
  UPDATE public.landlord_subscriptions 
  SET 
    billing_plan_id = free_trial_plan_id,
    updated_at = now()
  WHERE billing_plan_id IS NULL;
  
  -- 5. Ensure trial settings exist in billing_settings
  INSERT INTO public.billing_settings (setting_key, setting_value, description)
  VALUES (
    'trial_settings',
    jsonb_build_object(
      'trial_period_days', 30,
      'default_sms_credits', 100,
      'grace_period_days', 7
    ),
    'Trial subscription configuration settings'
  ) ON CONFLICT (setting_key) DO NOTHING;
  
  RAISE NOTICE 'Unified subscription management implementation completed successfully';
  
END $$;


-- Migration: 20250807094443_35a9eb59-b84b-404a-be79-8eb01dfa35c3.sql

-- Fix existing trial periods from 70 days to 30 days

-- Ensure all property stakeholders have subscriptions with Free Trial plan

-- Add trial period setting to billing_settings


-- Migration: 20250807100128_f4030b4e-578f-4b7b-93ef-4816895c44ca.sql

-- Add metadata column to user_roles table to store custom trial configurations
ALTER TABLE user_roles ADD COLUMN IF NOT EXISTS metadata jsonb;


-- Migration: 20250807100652_a3dde00d-9120-4e27-9f51-8234cd471e67.sql

-- Consolidate Free Trial plans and fix trial settings
-- Keep the newer Free Trial plan and deactivate the older one

-- Update the active Free Trial plan to have consistent settings

-- Remove the old trial_period_days setting to eliminate confusion

-- Update trial_settings to be the single source of truth


-- Migration: 20250807102441_349a6071-7f57-4d1c-8915-fb2430016669.sql

-- Step 1: Migrate Mazao Plus from inactive "Free Trial " to active "Free Trial" plan
-- First, get the IDs of both Free Trial plans

-- Step 2: Fix Simon Gichuki's status back to trial

-- Step 3: Delete the old inactive "Free Trial " plan (with trailing space)


-- Migration: 20250807110549_574c9a9b-1180-4789-9278-d1ae8ae2dd9e.sql

-- Update RLS policy for billing_plans to include Manager role
DROP POLICY IF EXISTS "Landlords can view active billing plans" ON public.billing_plans;

CREATE POLICY "Property stakeholders can view active billing plans" 
ON public.billing_plans 
FOR SELECT 
USING (
  is_active = true AND (
    has_role(auth.uid(), 'Landlord'::app_role) OR 
    has_role(auth.uid(), 'Manager'::app_role) OR 
    has_role(auth.uid(), 'Agent'::app_role)
  )
);


-- Migration: 20250807111446_ef8c0852-afbe-45c4-a763-52ec0a47996c.sql

-- Fix RLS policy for landlord_subscriptions to include Manager role
DROP POLICY IF EXISTS "Landlords can view their own subscription" ON public.landlord_subscriptions;

CREATE POLICY "Property stakeholders can view their own subscription" 
ON public.landlord_subscriptions 
FOR SELECT 
USING (
  (has_role(auth.uid(), 'Landlord'::app_role) OR 
   has_role(auth.uid(), 'Manager'::app_role) OR 
   has_role(auth.uid(), 'Agent'::app_role)) AND 
  landlord_id = auth.uid()
);

-- Create INSERT policy for property stakeholders
CREATE POLICY "Property stakeholders can create their own subscription" 
ON public.landlord_subscriptions 
FOR INSERT 
WITH CHECK (
  (has_role(auth.uid(), 'Landlord'::app_role) OR 
   has_role(auth.uid(), 'Manager'::app_role) OR 
   has_role(auth.uid(), 'Agent'::app_role)) AND 
  landlord_id = auth.uid()
);

-- Create UPDATE policy for property stakeholders
CREATE POLICY "Property stakeholders can update their own subscription" 
ON public.landlord_subscriptions 
FOR UPDATE 
USING (
  (has_role(auth.uid(), 'Landlord'::app_role) OR 
   has_role(auth.uid(), 'Manager'::app_role) OR 
   has_role(auth.uid(), 'Agent'::app_role)) AND 
  landlord_id = auth.uid()
)
WITH CHECK (
  (has_role(auth.uid(), 'Landlord'::app_role) OR 
   has_role(auth.uid(), 'Manager'::app_role) OR 
   has_role(auth.uid(), 'Agent'::app_role)) AND 
  landlord_id = auth.uid()
);


-- Migration: 20250807112618_e9d2635b-db2f-4332-adcb-d67381e912cf.sql

-- Add M-Pesa transaction tracking to service charge invoices
ALTER TABLE public.service_charge_invoices 
ADD COLUMN IF NOT EXISTS mpesa_checkout_request_id text,
ADD COLUMN IF NOT EXISTS mpesa_receipt_number text,
ADD COLUMN IF NOT EXISTS payment_phone_number text;

-- Create automated billing settings table
CREATE TABLE IF NOT EXISTS public.automated_billing_settings (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  enabled boolean NOT NULL DEFAULT true,
  billing_day_of_month integer NOT NULL DEFAULT 1,
  grace_period_days integer NOT NULL DEFAULT 7,
  auto_payment_enabled boolean NOT NULL DEFAULT false,
  notification_enabled boolean NOT NULL DEFAULT true,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.automated_billing_settings ENABLE ROW LEVEL SECURITY;

-- Create policy for admins to manage automated billing settings
CREATE POLICY "Admins can manage automated billing settings"
ON public.automated_billing_settings
FOR ALL
USING (has_role(auth.uid(), 'Admin'::app_role));

-- Insert default automated billing settings

-- Create trigger for updated_at
CREATE TRIGGER update_automated_billing_settings_updated_at
BEFORE UPDATE ON public.automated_billing_settings
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();


-- Migration: 20250807113945_8e338fb0-3308-4b01-9bad-7f39b47e1574.sql

-- Make total_units optional in properties table and create auto-calculation trigger
ALTER TABLE public.properties ALTER COLUMN total_units SET DEFAULT 0;

-- Create function to calculate total units
CREATE OR REPLACE FUNCTION public.calculate_property_total_units()
RETURNS TRIGGER AS $$
BEGIN
  -- Update the property's total_units based on actual units count
  UPDATE public.properties 
  SET total_units = (
    SELECT COUNT(*) 
    FROM public.units 
    WHERE property_id = COALESCE(NEW.property_id, OLD.property_id)
  )
  WHERE id = COALESCE(NEW.property_id, OLD.property_id);
  
  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create triggers to auto-update total_units when units are added/removed/updated
CREATE TRIGGER update_property_total_units_on_insert
  AFTER INSERT ON public.units
  FOR EACH ROW
  EXECUTE FUNCTION public.calculate_property_total_units();

CREATE TRIGGER update_property_total_units_on_update
  AFTER UPDATE ON public.units
  FOR EACH ROW
  EXECUTE FUNCTION public.calculate_property_total_units();

CREATE TRIGGER update_property_total_units_on_delete
  AFTER DELETE ON public.units
  FOR EACH ROW
  EXECUTE FUNCTION public.calculate_property_total_units();


-- Migration: 20250807114007_ac77873a-295d-4f70-8f96-4b59ece18e52.sql

-- Fix search path security issues for functions
CREATE OR REPLACE FUNCTION public.calculate_property_total_units()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $$
BEGIN
  -- Update the property's total_units based on actual units count
  UPDATE public.properties 
  SET total_units = (
    SELECT COUNT(*) 
    FROM public.units 
    WHERE property_id = COALESCE(NEW.property_id, OLD.property_id)
  )
  WHERE id = COALESCE(NEW.property_id, OLD.property_id);
  
  RETURN COALESCE(NEW, OLD);
END;
$$;


-- Migration: 20250807140054_51b817af-174c-4821-8076-0d0dee2c208c.sql

-- Add payment_type and metadata columns to mpesa_transactions table
ALTER TABLE public.mpesa_transactions 
ADD COLUMN IF NOT EXISTS payment_type text DEFAULT 'rent',
ADD COLUMN IF NOT EXISTS metadata jsonb DEFAULT NULL;


-- Migration: 20250807144920_210cfb9e-95d8-4e53-9da9-1dab15c31262.sql

-- Create a sample service charge invoice for testing
DO $$
DECLARE
    landlord_uuid UUID;
    invoice_id UUID;
BEGIN
    -- Get a landlord user (first one we find)
    SELECT user_id INTO landlord_uuid
    FROM profiles 
    WHERE role = 'landlord' 
    LIMIT 1;
    
    -- If no landlord found, create a sample one
    IF landlord_uuid IS NULL THEN
        INSERT INTO profiles (user_id, role, first_name, last_name, email, phone)
        VALUES (
            gen_random_uuid(),
            'landlord',
            'John',
            'Doe',
            'john.doe@example.com',
            '+254700000000'
        )
        RETURNING user_id INTO landlord_uuid;
    END IF;
    
    -- Create a sample service charge invoice
    INSERT INTO service_charge_invoices (
        id,
        landlord_id,
        invoice_number,
        billing_period_start,
        billing_period_end,
        rent_collected,
        service_charge_amount,
        sms_charges,
        other_charges,
        total_amount,
        due_date,
        status,
        created_at,
        updated_at
    ) VALUES (
        gen_random_uuid(),
        landlord_uuid,
        'SC-' || TO_CHAR(NOW(), 'YYYY') || '-001',
        DATE_TRUNC('month', NOW() - INTERVAL '1 month'),
        DATE_TRUNC('month', NOW()) - INTERVAL '1 day',
        50000.00, -- KES 50,000 rent collected
        2500.00,  -- 5% service charge
        150.00,   -- SMS charges
        0.00,     -- No other charges
        2650.00,  -- Total service charges
        NOW() + INTERVAL '7 days',
        'pending',
        NOW(),
        NOW()
    )
    RETURNING id INTO invoice_id;
    
    RAISE NOTICE 'Created sample service charge invoice with ID: %', invoice_id;
END $$;


-- Migration: 20250807150052_8861bc19-e05c-4441-b250-da036fcc5e01.sql

-- Generate a sample service charge invoice with real data for testing
DO $$
DECLARE
    landlord_uuid UUID;
    invoice_id UUID;
    current_landlord RECORD;
BEGIN
    -- Find an existing landlord from user_roles
    SELECT ur.user_id INTO landlord_uuid
    FROM user_roles ur
    WHERE ur.role = 'Landlord'
    LIMIT 1;
    
    -- If no landlord found in user_roles, create a sample profile
    IF landlord_uuid IS NULL THEN
        -- Insert a test user profile
        INSERT INTO profiles (id, first_name, last_name, email, phone)
        VALUES (
            gen_random_uuid(),
            'John',
            'Doe',
            'john.doe@example.com',
            '+254722000000'
        )
        RETURNING id INTO landlord_uuid;
        
        -- Add user role for this landlord
        INSERT INTO user_roles (user_id, role)
        VALUES (landlord_uuid, 'Landlord');
    END IF;
    
    -- Create a realistic service charge invoice
    INSERT INTO service_charge_invoices (
        id,
        landlord_id,
        invoice_number,
        billing_period_start,
        billing_period_end,
        rent_collected,
        service_charge_rate,
        service_charge_amount,
        sms_charges,
        other_charges,
        total_amount,
        due_date,
        status,
        created_at,
        updated_at,
        currency
    ) VALUES (
        gen_random_uuid(),
        landlord_uuid,
        'SERVICE-' || TO_CHAR(NOW(), 'YYYY') || '-' || LPAD((EXTRACT(MONTH FROM NOW()))::text, 2, '0') || '-001',
        DATE_TRUNC('month', NOW() - INTERVAL '1 month'),
        DATE_TRUNC('month', NOW()) - INTERVAL '1 day',
        125000.00, -- KES 125,000 rent collected
        5.0,       -- 5% service charge rate
        6250.00,   -- 5% of 125,000
        75.00,     -- SMS charges (30 messages × 2.50)
        0.00,      -- No other charges for now
        6325.00,   -- Total amount due
        NOW() + INTERVAL '30 days',
        'pending',
        NOW(),
        NOW(),
        'KES'
    )
    RETURNING id INTO invoice_id;
    
    -- Also create a paid invoice for demo purposes
    INSERT INTO service_charge_invoices (
        id,
        landlord_id,
        invoice_number,
        billing_period_start,
        billing_period_end,
        rent_collected,
        service_charge_rate,
        service_charge_amount,
        sms_charges,
        other_charges,
        total_amount,
        due_date,
        status,
        payment_date,
        payment_method,
        payment_reference,
        created_at,
        updated_at,
        currency
    ) VALUES (
        gen_random_uuid(),
        landlord_uuid,
        'SERVICE-' || TO_CHAR(NOW() - INTERVAL '1 month', 'YYYY') || '-' || LPAD((EXTRACT(MONTH FROM NOW() - INTERVAL '1 month'))::text, 2, '0') || '-001',
        DATE_TRUNC('month', NOW() - INTERVAL '2 month'),
        DATE_TRUNC('month', NOW() - INTERVAL '1 month') - INTERVAL '1 day',
        98000.00,  -- KES 98,000 rent collected
        5.0,       -- 5% service charge rate
        4900.00,   -- 5% of 98,000
        50.00,     -- SMS charges (20 messages × 2.50)
        0.00,      -- No other charges
        4950.00,   -- Total amount
        NOW() - INTERVAL '15 days',
        'paid',
        NOW() - INTERVAL '10 days',
        'mpesa',
        'QH123456789',
        NOW() - INTERVAL '1 month',
        NOW() - INTERVAL '1 month',
        'KES'
    );
    
    RAISE NOTICE 'Created sample service charge invoices for landlord: %', landlord_uuid;
    RAISE NOTICE 'Pending invoice ID: %', invoice_id;
    
END $$;


-- Migration: 20250807152803_06a267ae-a015-4d65-8b14-3e60feeb1347.sql

-- Update Simon Gichuki's role from Manager to Landlord

-- Also ensure he has a landlord payment preferences record


-- Migration: 20250807153346_fe375890-8b80-40e4-a5e0-ec3473014bef.sql

-- Update Simon Gichuki's auth metadata to reflect correct Landlord role


-- Migration: 20250807155425_555e56f9-ff28-4716-b9d7-82fcf286bc85.sql

-- Remove duplicate payment record with same transaction_id and payment_reference


-- Migration: 20250807155609_ab4fbdc2-12e7-4349-9292-4761469b3cc1.sql

-- Set up automated monthly billing cron job
-- Schedule monthly billing to run on the 1st of each month at 9:00 AM
SELECT cron.schedule(
  'monthly-billing-automation',
  '0 9 1 * *', -- Monthly on the 1st at 9:00 AM
  $$
  SELECT
    net.http_post(
        url:='https://kdpqimetajnhcqseajok.supabase.co/functions/v1/automated-monthly-billing',
        headers:='{"Content-Type": "application/json", "Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImtkcHFpbWV0YWpuaGNxc2Vham9rIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTQwMDQxMTAsImV4cCI6MjA2OTU4MDExMH0.VkqXvocYAYO6RQeDaFv8wVrq2xoKKfQ8UVj41az7ZSk"}'::jsonb,
        body:='{"source": "monthly_cron", "period": "automatic"}'::jsonb
    ) as request_id;
  $$
);

-- Ensure automated billing is enabled by default


-- Migration: 20250807162930_0733f244-e9b8-456e-8fa0-fa261ba0b624.sql

-- Create tables for SMS provider configurations and automation settings
CREATE TABLE IF NOT EXISTS public.sms_providers (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  provider_name text NOT NULL,
  api_key text,
  api_secret text,
  authorization_token text,
  username text,
  sender_id text,
  base_url text,
  unique_identifier text,
  sender_type text,
  country_code text DEFAULT 'KE',
  is_active boolean DEFAULT false,
  is_default boolean DEFAULT false,
  config_data jsonb DEFAULT '{}',
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.sms_providers ENABLE ROW LEVEL SECURITY;

-- Create policies
CREATE POLICY "Admins can manage SMS providers"
ON public.sms_providers
FOR ALL
TO authenticated
USING (has_role(auth.uid(), 'Admin'::app_role));

-- Create table for SMS automation settings
CREATE TABLE IF NOT EXISTS public.sms_automation_settings (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  automation_key text NOT NULL UNIQUE,
  enabled boolean DEFAULT true,
  timing text NOT NULL,
  audience_type text NOT NULL,
  template_id uuid,
  template_content text,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.sms_automation_settings ENABLE ROW LEVEL SECURITY;

-- Create policies
CREATE POLICY "Admins can manage SMS automation settings"
ON public.sms_automation_settings
FOR ALL
TO authenticated
USING (has_role(auth.uid(), 'Admin'::app_role));

-- Create table for SMS usage logs
CREATE TABLE IF NOT EXISTS public.sms_usage_logs (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  landlord_id uuid,
  recipient_phone text NOT NULL,
  message_content text NOT NULL,
  provider_name text NOT NULL,
  cost numeric DEFAULT 0,
  status text NOT NULL,
  sent_at timestamp with time zone DEFAULT now(),
  delivery_status text DEFAULT 'pending',
  error_message text,
  metadata jsonb DEFAULT '{}'
);

-- Enable RLS
ALTER TABLE public.sms_usage_logs ENABLE ROW LEVEL SECURITY;

-- Create policies
CREATE POLICY "Admins can view all SMS usage logs"
ON public.sms_usage_logs
FOR SELECT
TO authenticated
USING (has_role(auth.uid(), 'Admin'::app_role));

CREATE POLICY "Landlords can view their own SMS usage logs"
ON public.sms_usage_logs
FOR SELECT
TO authenticated
USING (has_role(auth.uid(), 'Landlord'::app_role) AND landlord_id = auth.uid());

CREATE POLICY "System can insert SMS usage logs"
ON public.sms_usage_logs
FOR INSERT
TO authenticated
WITH CHECK (true);

-- Create triggers for updated_at
CREATE OR REPLACE FUNCTION public.update_sms_provider_updated_at()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

CREATE TRIGGER update_sms_providers_updated_at
  BEFORE UPDATE ON public.sms_providers
  FOR EACH ROW
  EXECUTE FUNCTION public.update_sms_provider_updated_at();

CREATE TRIGGER update_sms_automation_settings_updated_at
  BEFORE UPDATE ON public.sms_automation_settings
  FOR EACH ROW
  EXECUTE FUNCTION public.update_sms_provider_updated_at();

-- Insert default communication preferences if they don't exist

-- Insert default message templates if they don't exist  

-- Insert default SMS provider configuration

-- Insert default SMS automation settings


-- Migration: 20250807163008_d7b3b8e8-e18f-40d4-981c-f3b11b9b771a.sql

-- Create tables for SMS provider configurations and automation settings (handle existing objects)
CREATE TABLE IF NOT EXISTS public.sms_providers (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  provider_name text NOT NULL,
  api_key text,
  api_secret text,
  authorization_token text,
  username text,
  sender_id text,
  base_url text,
  unique_identifier text,
  sender_type text,
  country_code text DEFAULT 'KE',
  is_active boolean DEFAULT false,
  is_default boolean DEFAULT false,
  config_data jsonb DEFAULT '{}',
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now()
);

-- Enable RLS (ignore if already enabled)
ALTER TABLE public.sms_providers ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they exist
DROP POLICY IF EXISTS "Admins can manage SMS providers" ON public.sms_providers;

-- Create policies
CREATE POLICY "Admins can manage SMS providers"
ON public.sms_providers
FOR ALL
TO authenticated
USING (has_role(auth.uid(), 'Admin'::app_role));

-- Create table for SMS usage logs
CREATE TABLE IF NOT EXISTS public.sms_usage_logs (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  landlord_id uuid,
  recipient_phone text NOT NULL,
  message_content text NOT NULL,
  provider_name text NOT NULL,
  cost numeric DEFAULT 0,
  status text NOT NULL,
  sent_at timestamp with time zone DEFAULT now(),
  delivery_status text DEFAULT 'pending',
  error_message text,
  metadata jsonb DEFAULT '{}'
);

-- Enable RLS
ALTER TABLE public.sms_usage_logs ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they exist
DROP POLICY IF EXISTS "Admins can view all SMS usage logs" ON public.sms_usage_logs;
DROP POLICY IF EXISTS "Landlords can view their own SMS usage logs" ON public.sms_usage_logs;
DROP POLICY IF EXISTS "System can insert SMS usage logs" ON public.sms_usage_logs;

-- Create policies
CREATE POLICY "Admins can view all SMS usage logs"
ON public.sms_usage_logs
FOR SELECT
TO authenticated
USING (has_role(auth.uid(), 'Admin'::app_role));

CREATE POLICY "Landlords can view their own SMS usage logs"
ON public.sms_usage_logs
FOR SELECT
TO authenticated
USING (has_role(auth.uid(), 'Landlord'::app_role) AND landlord_id = auth.uid());

CREATE POLICY "System can insert SMS usage logs"
ON public.sms_usage_logs
FOR INSERT
TO authenticated
WITH CHECK (true);

-- Create triggers for updated_at
CREATE OR REPLACE FUNCTION public.update_sms_provider_updated_at()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

-- Drop existing triggers if they exist
DROP TRIGGER IF EXISTS update_sms_providers_updated_at ON public.sms_providers;

CREATE TRIGGER update_sms_providers_updated_at
  BEFORE UPDATE ON public.sms_providers
  FOR EACH ROW
  EXECUTE FUNCTION public.update_sms_provider_updated_at();

-- Insert default SMS provider configuration


-- Migration: 20250807163123_f890b61f-e3a5-4ea2-a19a-cd24506a1907.sql

-- Create tables for SMS provider configurations and logs
CREATE TABLE IF NOT EXISTS public.sms_providers (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  provider_name text NOT NULL UNIQUE,
  api_key text,
  api_secret text,
  authorization_token text,
  username text,
  sender_id text,
  base_url text,
  unique_identifier text,
  sender_type text,
  country_code text DEFAULT 'KE',
  is_active boolean DEFAULT false,
  is_default boolean DEFAULT false,
  config_data jsonb DEFAULT '{}',
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.sms_providers ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they exist
DROP POLICY IF EXISTS "Admins can manage SMS providers" ON public.sms_providers;

-- Create policies
CREATE POLICY "Admins can manage SMS providers"
ON public.sms_providers
FOR ALL
TO authenticated
USING (has_role(auth.uid(), 'Admin'::app_role));

-- Create table for SMS usage logs
CREATE TABLE IF NOT EXISTS public.sms_usage_logs (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  landlord_id uuid,
  recipient_phone text NOT NULL,
  message_content text NOT NULL,
  provider_name text NOT NULL,
  cost numeric DEFAULT 0,
  status text NOT NULL,
  sent_at timestamp with time zone DEFAULT now(),
  delivery_status text DEFAULT 'pending',
  error_message text,
  metadata jsonb DEFAULT '{}'
);

-- Enable RLS
ALTER TABLE public.sms_usage_logs ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they exist
DROP POLICY IF EXISTS "Admins can view all SMS usage logs" ON public.sms_usage_logs;
DROP POLICY IF EXISTS "Landlords can view their own SMS usage logs" ON public.sms_usage_logs;
DROP POLICY IF EXISTS "System can insert SMS usage logs" ON public.sms_usage_logs;

-- Create policies
CREATE POLICY "Admins can view all SMS usage logs"
ON public.sms_usage_logs
FOR SELECT
TO authenticated
USING (has_role(auth.uid(), 'Admin'::app_role));

CREATE POLICY "Landlords can view their own SMS usage logs"
ON public.sms_usage_logs
FOR SELECT
TO authenticated
USING (has_role(auth.uid(), 'Landlord'::app_role) AND landlord_id = auth.uid());

CREATE POLICY "System can insert SMS usage logs"
ON public.sms_usage_logs
FOR INSERT
TO authenticated
WITH CHECK (true);

-- Create triggers for updated_at
CREATE OR REPLACE FUNCTION public.update_sms_provider_updated_at()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

-- Drop existing triggers if they exist
DROP TRIGGER IF EXISTS update_sms_providers_updated_at ON public.sms_providers;

CREATE TRIGGER update_sms_providers_updated_at
  BEFORE UPDATE ON public.sms_providers
  FOR EACH ROW
  EXECUTE FUNCTION public.update_sms_provider_updated_at();

-- Insert default SMS provider configuration


-- Migration: 20250807163213_f269207d-8a98-4b98-b48e-871965834356.sql

-- Check if sms_providers table exists and add unique constraint
DO $$
BEGIN
    -- Add unique constraint to provider_name if it doesn't exist
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.table_constraints 
        WHERE constraint_name = 'sms_providers_provider_name_key' 
        AND table_name = 'sms_providers' 
        AND table_schema = 'public'
    ) THEN
        ALTER TABLE public.sms_providers ADD CONSTRAINT sms_providers_provider_name_key UNIQUE (provider_name);
    END IF;
END $$;

-- Create table for SMS usage logs if it doesn't exist
CREATE TABLE IF NOT EXISTS public.sms_usage_logs (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  landlord_id uuid,
  recipient_phone text NOT NULL,
  message_content text NOT NULL,
  provider_name text NOT NULL,
  cost numeric DEFAULT 0,
  status text NOT NULL,
  sent_at timestamp with time zone DEFAULT now(),
  delivery_status text DEFAULT 'pending',
  error_message text,
  metadata jsonb DEFAULT '{}'
);

-- Enable RLS on sms_usage_logs
ALTER TABLE public.sms_usage_logs ENABLE ROW LEVEL SECURITY;

-- Drop and recreate policies for sms_usage_logs
DROP POLICY IF EXISTS "Admins can view all SMS usage logs" ON public.sms_usage_logs;
DROP POLICY IF EXISTS "Landlords can view their own SMS usage logs" ON public.sms_usage_logs;
DROP POLICY IF EXISTS "System can insert SMS usage logs" ON public.sms_usage_logs;

CREATE POLICY "Admins can view all SMS usage logs"
ON public.sms_usage_logs
FOR SELECT
TO authenticated
USING (has_role(auth.uid(), 'Admin'::app_role));

CREATE POLICY "Landlords can view their own SMS usage logs"
ON public.sms_usage_logs
FOR SELECT
TO authenticated
USING (has_role(auth.uid(), 'Landlord'::app_role) AND landlord_id = auth.uid());

CREATE POLICY "System can insert SMS usage logs"
ON public.sms_usage_logs
FOR INSERT
TO authenticated
WITH CHECK (true);

-- Insert default SMS provider configuration (update if exists)


-- Migration: 20250807164043_6189221f-69f6-4f68-91bc-a90e80ba11dd.sql

-- PART 1: Role Unification - Consolidate all property-related roles to 'landlord'

-- First, update existing role enum to include new sub-user role
ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'landlord_subuser';

-- Update all existing property-related roles to 'landlord'

-- Create sub_users table for landlord delegation system
CREATE TABLE IF NOT EXISTS public.sub_users (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  parent_landlord_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  sub_user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  permissions jsonb NOT NULL DEFAULT '{"manage_properties": false, "manage_tenants": false, "manage_leases": false, "manage_maintenance": false, "view_reports": false}'::jsonb,
  title text, -- Partner, Agent, Manager, etc.
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  created_by uuid REFERENCES auth.users(id),
  UNIQUE(parent_landlord_id, sub_user_id)
);

-- Enable RLS on sub_users table
ALTER TABLE public.sub_users ENABLE ROW LEVEL SECURITY;

-- RLS policies for sub_users table
CREATE POLICY "Landlords can manage their sub-users"
ON public.sub_users
FOR ALL
USING (
  parent_landlord_id = auth.uid() AND 
  has_role(auth.uid(), 'Landlord'::app_role)
)
WITH CHECK (
  parent_landlord_id = auth.uid() AND 
  has_role(auth.uid(), 'Landlord'::app_role)
);

CREATE POLICY "Sub-users can view their own record"
ON public.sub_users
FOR SELECT
USING (
  sub_user_id = auth.uid() AND 
  has_role(auth.uid(), 'landlord_subuser'::app_role)
);

CREATE POLICY "Admins can manage all sub-users"
ON public.sub_users
FOR ALL
USING (has_role(auth.uid(), 'Admin'::app_role));

-- Create function to get parent landlord ID for sub-users
CREATE OR REPLACE FUNCTION public.get_parent_landlord_id(_user_id uuid)
RETURNS uuid
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT parent_landlord_id
  FROM public.sub_users
  WHERE sub_user_id = _user_id AND is_active = true
  LIMIT 1;
$$;

-- Create function to check if user is a sub-user
CREATE OR REPLACE FUNCTION public.is_sub_user(_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.sub_users
    WHERE sub_user_id = _user_id AND is_active = true
  );
$$;

-- Create function to check sub-user permissions
CREATE OR REPLACE FUNCTION public.has_sub_user_permission(_user_id uuid, _permission text)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT COALESCE(
    (permissions ->> _permission)::boolean,
    false
  )
  FROM public.sub_users
  WHERE sub_user_id = _user_id AND is_active = true;
$$;

-- Add trigger for updated_at
CREATE TRIGGER update_sub_users_updated_at
BEFORE UPDATE ON public.sub_users
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Create activity log table for sub-user actions
CREATE TABLE IF NOT EXISTS public.sub_user_activity_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  sub_user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  parent_landlord_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  action text NOT NULL,
  entity_type text,
  entity_id uuid,
  details jsonb,
  ip_address inet,
  user_agent text,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Enable RLS on activity logs
ALTER TABLE public.sub_user_activity_logs ENABLE ROW LEVEL SECURITY;

-- RLS policies for activity logs
CREATE POLICY "Landlords can view their sub-user activity logs"
ON public.sub_user_activity_logs
FOR SELECT
USING (
  parent_landlord_id = auth.uid() AND 
  has_role(auth.uid(), 'Landlord'::app_role)
);

CREATE POLICY "System can insert activity logs"
ON public.sub_user_activity_logs
FOR INSERT
WITH CHECK (true);

CREATE POLICY "Admins can view all activity logs"
ON public.sub_user_activity_logs
FOR SELECT
USING (has_role(auth.uid(), 'Admin'::app_role));


-- Migration: 20250807165409_7c522503-9b00-464c-a1db-d286fd399a53.sql

-- Create support tickets table
CREATE TABLE public.support_tickets (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  title TEXT NOT NULL,
  description TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'in_progress', 'resolved', 'closed')),
  priority TEXT NOT NULL DEFAULT 'medium' CHECK (priority IN ('low', 'medium', 'high', 'urgent')),
  category TEXT NOT NULL,
  user_id UUID NOT NULL,
  assigned_to UUID,
  resolution_notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create support messages table
CREATE TABLE public.support_messages (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  ticket_id UUID NOT NULL REFERENCES public.support_tickets(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  message TEXT NOT NULL,
  is_staff_reply BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create system logs table
CREATE TABLE public.system_logs (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  type TEXT NOT NULL CHECK (type IN ('error', 'warning', 'info')),
  message TEXT NOT NULL,
  service TEXT NOT NULL,
  details JSONB,
  user_id UUID,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS on all tables
ALTER TABLE public.support_tickets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.support_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.system_logs ENABLE ROW LEVEL SECURITY;

-- Support tickets RLS policies
CREATE POLICY "Users can view their own tickets" ON public.support_tickets
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own tickets" ON public.support_tickets
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own tickets" ON public.support_tickets
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Admins can manage all tickets" ON public.support_tickets
  FOR ALL USING (has_role(auth.uid(), 'Admin'::app_role));

-- Support messages RLS policies
CREATE POLICY "Users can view messages for their tickets" ON public.support_messages
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.support_tickets 
      WHERE id = ticket_id AND user_id = auth.uid()
    )
  );

CREATE POLICY "Users can create messages for their tickets" ON public.support_messages
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.support_tickets 
      WHERE id = ticket_id AND user_id = auth.uid()
    ) AND user_id = auth.uid()
  );

CREATE POLICY "Admins can manage all messages" ON public.support_messages
  FOR ALL USING (has_role(auth.uid(), 'Admin'::app_role));

-- System logs RLS policies
CREATE POLICY "Admins can view all system logs" ON public.system_logs
  FOR SELECT USING (has_role(auth.uid(), 'Admin'::app_role));

CREATE POLICY "System can insert logs" ON public.system_logs
  FOR INSERT WITH CHECK (true);

-- Create triggers for updated_at
CREATE TRIGGER update_support_tickets_updated_at
  BEFORE UPDATE ON public.support_tickets
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Create indexes for performance
CREATE INDEX idx_support_tickets_user_id ON public.support_tickets(user_id);
CREATE INDEX idx_support_tickets_status ON public.support_tickets(status);
CREATE INDEX idx_support_tickets_priority ON public.support_tickets(priority);
CREATE INDEX idx_support_messages_ticket_id ON public.support_messages(ticket_id);
CREATE INDEX idx_system_logs_type ON public.system_logs(type);
CREATE INDEX idx_system_logs_service ON public.system_logs(service);
CREATE INDEX idx_system_logs_created_at ON public.system_logs(created_at);

-- Create function to log system events
CREATE OR REPLACE FUNCTION public.log_system_event(
  _type TEXT,
  _message TEXT,
  _service TEXT,
  _details JSONB DEFAULT NULL,
  _user_id UUID DEFAULT NULL
) RETURNS void
LANGUAGE sql
SECURITY DEFINER
SET search_path = ''
AS $$
  INSERT INTO public.system_logs (type, message, service, details, user_id)
  VALUES (_type, _message, _service, _details, _user_id);
$$;


-- Migration: 20250807165851_541b77fa-29e0-4250-943f-210e94fd20a4.sql

-- Create support_tickets table
CREATE TABLE public.support_tickets (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  title TEXT NOT NULL,
  description TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'in_progress', 'resolved', 'closed')),
  priority TEXT NOT NULL DEFAULT 'medium' CHECK (priority IN ('low', 'medium', 'high', 'urgent')),
  category TEXT NOT NULL DEFAULT 'general' CHECK (category IN ('technical', 'billing', 'general', 'maintenance')),
  user_id UUID NOT NULL,
  assigned_to UUID NULL,
  resolution_notes TEXT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create support_messages table
CREATE TABLE public.support_messages (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  ticket_id UUID NOT NULL REFERENCES public.support_tickets(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  message TEXT NOT NULL,
  is_staff_reply BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create system_logs table
CREATE TABLE public.system_logs (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  type TEXT NOT NULL CHECK (type IN ('error', 'warning', 'info')),
  message TEXT NOT NULL,
  service TEXT NOT NULL,
  metadata JSONB NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.support_tickets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.support_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.system_logs ENABLE ROW LEVEL SECURITY;

-- RLS policies for support_tickets
CREATE POLICY "Users can view their own tickets" 
ON public.support_tickets 
FOR SELECT 
USING (auth.uid() = user_id OR has_role(auth.uid(), 'Admin'::app_role));

CREATE POLICY "Users can create their own tickets" 
ON public.support_tickets 
FOR INSERT 
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own tickets" 
ON public.support_tickets 
FOR UPDATE 
USING (auth.uid() = user_id OR has_role(auth.uid(), 'Admin'::app_role));

CREATE POLICY "Admins can manage all tickets" 
ON public.support_tickets 
FOR ALL 
USING (has_role(auth.uid(), 'Admin'::app_role));

-- RLS policies for support_messages
CREATE POLICY "Users can view messages for their tickets" 
ON public.support_messages 
FOR SELECT 
USING (
  EXISTS (
    SELECT 1 FROM public.support_tickets 
    WHERE id = support_messages.ticket_id 
    AND (user_id = auth.uid() OR has_role(auth.uid(), 'Admin'::app_role))
  )
);

CREATE POLICY "Users can create messages for their tickets" 
ON public.support_messages 
FOR INSERT 
WITH CHECK (
  auth.uid() = user_id AND
  EXISTS (
    SELECT 1 FROM public.support_tickets 
    WHERE id = support_messages.ticket_id 
    AND (user_id = auth.uid() OR has_role(auth.uid(), 'Admin'::app_role))
  )
);

CREATE POLICY "Admins can manage all messages" 
ON public.support_messages 
FOR ALL 
USING (has_role(auth.uid(), 'Admin'::app_role));

-- RLS policies for system_logs
CREATE POLICY "Admins can view system logs" 
ON public.system_logs 
FOR SELECT 
USING (has_role(auth.uid(), 'Admin'::app_role));

CREATE POLICY "System can insert logs" 
ON public.system_logs 
FOR INSERT 
WITH CHECK (true);

-- Create updated_at triggers
CREATE TRIGGER update_support_tickets_updated_at
BEFORE UPDATE ON public.support_tickets
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Create indexes for better performance
CREATE INDEX idx_support_tickets_user_id ON public.support_tickets(user_id);
CREATE INDEX idx_support_tickets_status ON public.support_tickets(status);
CREATE INDEX idx_support_tickets_priority ON public.support_tickets(priority);
CREATE INDEX idx_support_tickets_created_at ON public.support_tickets(created_at);
CREATE INDEX idx_support_messages_ticket_id ON public.support_messages(ticket_id);
CREATE INDEX idx_system_logs_type ON public.system_logs(type);
CREATE INDEX idx_system_logs_service ON public.system_logs(service);
CREATE INDEX idx_system_logs_created_at ON public.system_logs(created_at);

-- Create function to log system events
CREATE OR REPLACE FUNCTION public.log_system_event(
  _type TEXT,
  _message TEXT,
  _service TEXT,
  _metadata JSONB DEFAULT NULL
)
RETURNS VOID
LANGUAGE SQL
SECURITY DEFINER
AS $$
  INSERT INTO public.system_logs (type, message, service, metadata)
  VALUES (_type, _message, _service, _metadata);
$$;


-- Migration: 20250807170410_6bc07c5f-027e-4c0d-93a9-83ed0710d3d5.sql

-- Add foreign key constraints to support_tickets table
ALTER TABLE public.support_tickets 
ADD CONSTRAINT support_tickets_user_id_fkey 
FOREIGN KEY (user_id) REFERENCES public.profiles(id) ON DELETE CASCADE;

ALTER TABLE public.support_tickets 
ADD CONSTRAINT support_tickets_assigned_to_fkey 
FOREIGN KEY (assigned_to) REFERENCES public.profiles(id) ON DELETE SET NULL;

-- Add foreign key constraint to support_messages table
ALTER TABLE public.support_messages 
ADD CONSTRAINT support_messages_user_id_fkey 
FOREIGN KEY (user_id) REFERENCES public.profiles(id) ON DELETE CASCADE;


-- Migration: 20250807173804_fb076369-227d-4e2a-a125-c5c8894d5a50.sql

-- Add missing INSERT policy for notifications table
CREATE POLICY "System can create notifications" 
ON public.notifications 
FOR INSERT 
WITH CHECK (true);

-- Add policy for users to insert their own notifications
CREATE POLICY "Users can create their own notifications" 
ON public.notifications 
FOR INSERT 
WITH CHECK (auth.uid() = user_id);

-- Add policy for support message authors to insert notifications  
CREATE POLICY "Support messages can create notifications"
ON public.notifications 
FOR INSERT 
WITH CHECK (
  type = 'support' AND 
  (related_type = 'support_ticket' OR related_type IS NULL)
);


-- Migration: 20250807200351_a1b70f3f-add9-446a-8f62-cbb61d8b53e1.sql

-- ==================================================
-- PHASE 1: DATA CLEANUP & INTEGRITY FIXES
-- ==================================================

-- First, let's fix the immediate issue: David Wanjau should remain a Landlord only
-- Remove the duplicate Tenant role for the user who should be a Landlord

-- ==================================================
-- PHASE 2: EMAIL UNIQUENESS ENFORCEMENT
-- ==================================================

-- Add unique constraint to profiles email (this will prevent duplicate emails)
ALTER TABLE public.profiles 
ADD CONSTRAINT unique_email UNIQUE (email);

-- Make email non-nullable (ensure every user has an email)
ALTER TABLE public.profiles 
ALTER COLUMN email SET NOT NULL;

-- ==================================================
-- PHASE 3: ROLE CHANGE AUDIT LOGGING
-- ==================================================

-- Create role change audit table
CREATE TABLE public.role_change_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    old_role public.app_role,
    new_role public.app_role NOT NULL,
    changed_by UUID NOT NULL REFERENCES public.profiles(id),
    reason TEXT,
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Enable RLS on role change logs
ALTER TABLE public.role_change_logs ENABLE ROW LEVEL SECURITY;

-- Create RLS policies for role change logs
CREATE POLICY "Admins can manage role change logs"
ON public.role_change_logs
FOR ALL
TO authenticated
USING (has_role(auth.uid(), 'Admin'::app_role));

CREATE POLICY "Users can view their own role change history"
ON public.role_change_logs
FOR SELECT
TO authenticated
USING (user_id = auth.uid());

-- ==================================================
-- PHASE 4: DUPLICATE DETECTION FUNCTIONS
-- ==================================================

-- Function to detect duplicate emails before insert/update
CREATE OR REPLACE FUNCTION public.check_email_uniqueness()
RETURNS TRIGGER AS $$
BEGIN
    -- Check if email already exists for a different user
    IF EXISTS (
        SELECT 1 FROM public.profiles 
        WHERE email = NEW.email 
        AND id != NEW.id
    ) THEN
        RAISE EXCEPTION 'Email address % already exists for another user', NEW.email;
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger to enforce email uniqueness
CREATE TRIGGER enforce_email_uniqueness
    BEFORE INSERT OR UPDATE ON public.profiles
    FOR EACH ROW
    EXECUTE FUNCTION public.check_email_uniqueness();

-- ==================================================
-- PHASE 5: ROLE CHANGE LOGGING FUNCTION
-- ==================================================

-- Function to log role changes
CREATE OR REPLACE FUNCTION public.log_role_change()
RETURNS TRIGGER AS $$
BEGIN
    -- Log role insertions (new roles)
    IF TG_OP = 'INSERT' THEN
        INSERT INTO public.role_change_logs (
            user_id, old_role, new_role, changed_by, reason, metadata
        ) VALUES (
            NEW.user_id, 
            NULL, 
            NEW.role, 
            COALESCE(auth.uid(), NEW.user_id),
            'Role assigned',
            jsonb_build_object(
                'operation', 'INSERT',
                'table', 'user_roles',
                'timestamp', now()
            )
        );
        RETURN NEW;
    END IF;
    
    -- Log role updates (role changes)
    IF TG_OP = 'UPDATE' THEN
        IF OLD.role != NEW.role THEN
            INSERT INTO public.role_change_logs (
                user_id, old_role, new_role, changed_by, reason, metadata
            ) VALUES (
                NEW.user_id, 
                OLD.role, 
                NEW.role, 
                COALESCE(auth.uid(), NEW.user_id),
                'Role updated',
                jsonb_build_object(
                    'operation', 'UPDATE',
                    'table', 'user_roles',
                    'old_value', OLD.role,
                    'new_value', NEW.role,
                    'timestamp', now()
                )
            );
        END IF;
        RETURN NEW;
    END IF;
    
    -- Log role deletions (role removal)
    IF TG_OP = 'DELETE' THEN
        INSERT INTO public.role_change_logs (
            user_id, old_role, new_role, changed_by, reason, metadata
        ) VALUES (
            OLD.user_id, 
            OLD.role, 
            NULL, 
            COALESCE(auth.uid(), OLD.user_id),
            'Role removed',
            jsonb_build_object(
                'operation', 'DELETE',
                'table', 'user_roles',
                'timestamp', now()
            )
        );
        RETURN OLD;
    END IF;
    
    RETURN NULL;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create trigger for role change logging
CREATE TRIGGER log_user_role_changes
    AFTER INSERT OR UPDATE OR DELETE ON public.user_roles
    FOR EACH ROW
    EXECUTE FUNCTION public.log_role_change();

-- ==================================================
-- PHASE 6: PREVENT DUPLICATE ROLES FOR SAME USER
-- ==================================================

-- Add unique constraint to prevent same user having duplicate roles
ALTER TABLE public.user_roles 
ADD CONSTRAINT unique_user_role UNIQUE (user_id, role);

-- ==================================================
-- PHASE 7: USER CREATION HELPER FUNCTIONS
-- ==================================================

-- Function to safely create user with role (prevents duplicates)
CREATE OR REPLACE FUNCTION public.create_user_safe(
    p_email TEXT,
    p_first_name TEXT,
    p_last_name TEXT,
    p_phone TEXT,
    p_role public.app_role
) RETURNS JSONB AS $$
DECLARE
    existing_user_id UUID;
    new_user_id UUID;
    similar_users JSONB;
BEGIN
    -- Check for exact email match
    SELECT id INTO existing_user_id
    FROM public.profiles 
    WHERE email = p_email;
    
    IF existing_user_id IS NOT NULL THEN
        RETURN jsonb_build_object(
            'success', false,
            'error', 'EMAIL_EXISTS',
            'message', 'A user with this email already exists',
            'existing_user_id', existing_user_id
        );
    END IF;
    
    -- Check for similar users (same phone or name)
    SELECT jsonb_agg(
        jsonb_build_object(
            'id', id,
            'email', email,
            'name', first_name || ' ' || last_name,
            'phone', phone
        )
    ) INTO similar_users
    FROM public.profiles
    WHERE phone = p_phone 
       OR (first_name = p_first_name AND last_name = p_last_name);
    
    -- Create the new user
    new_user_id := gen_random_uuid();
    
    INSERT INTO public.profiles (id, email, first_name, last_name, phone)
    VALUES (new_user_id, p_email, p_first_name, p_last_name, p_phone);
    
    -- Assign the role
    INSERT INTO public.user_roles (user_id, role)
    VALUES (new_user_id, p_role);
    
    RETURN jsonb_build_object(
        'success', true,
        'user_id', new_user_id,
        'message', 'User created successfully',
        'similar_users', COALESCE(similar_users, '[]'::jsonb)
    );
    
EXCEPTION WHEN OTHERS THEN
    RETURN jsonb_build_object(
        'success', false,
        'error', SQLSTATE,
        'message', SQLERRM
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ==================================================
-- PHASE 8: DATA INTEGRITY REPORT FUNCTION
-- ==================================================

-- Function to generate data integrity report
CREATE OR REPLACE FUNCTION public.get_data_integrity_report()
RETURNS JSONB AS $$
DECLARE
    duplicate_emails JSONB;
    multiple_roles JSONB;
    orphaned_roles JSONB;
    recent_role_changes JSONB;
BEGIN
    -- Check for duplicate emails (should be none after our fixes)
    SELECT jsonb_agg(
        jsonb_build_object(
            'email', email,
            'user_count', user_count,
            'users', users
        )
    ) INTO duplicate_emails
    FROM (
        SELECT 
            email,
            COUNT(*) as user_count,
            jsonb_agg(jsonb_build_object('id', id, 'name', first_name || ' ' || last_name)) as users
        FROM public.profiles 
        WHERE email IS NOT NULL
        GROUP BY email
        HAVING COUNT(*) > 1
    ) dups;
    
    -- Check for users with multiple roles
    SELECT jsonb_agg(
        jsonb_build_object(
            'user_id', id,
            'email', email,
            'name', first_name || ' ' || last_name,
            'roles', roles,
            'role_count', role_count
        )
    ) INTO multiple_roles
    FROM (
        SELECT 
            p.id, p.email, p.first_name, p.last_name,
            array_agg(ur.role) as roles,
            COUNT(ur.role) as role_count
        FROM public.profiles p
        LEFT JOIN public.user_roles ur ON p.id = ur.user_id
        GROUP BY p.id, p.email, p.first_name, p.last_name
        HAVING COUNT(ur.role) > 1
    ) multi;
    
    -- Check for orphaned roles (roles without profiles)
    SELECT jsonb_agg(
        jsonb_build_object(
            'user_id', user_id,
            'role', role
        )
    ) INTO orphaned_roles
    FROM public.user_roles ur
    LEFT JOIN public.profiles p ON ur.user_id = p.id
    WHERE p.id IS NULL;
    
    -- Get recent role changes
    SELECT jsonb_agg(
        jsonb_build_object(
            'user_id', user_id,
            'user_email', p.email,
            'user_name', p.first_name || ' ' || p.last_name,
            'old_role', old_role,
            'new_role', new_role,
            'changed_by', changed_by,
            'reason', reason,
            'created_at', created_at
        ) ORDER BY created_at DESC
    ) INTO recent_role_changes
    FROM public.role_change_logs rcl
    LEFT JOIN public.profiles p ON rcl.user_id = p.id
    WHERE created_at >= now() - INTERVAL '7 days'
    LIMIT 20;
    
    RETURN jsonb_build_object(
        'duplicate_emails', COALESCE(duplicate_emails, '[]'::jsonb),
        'multiple_roles', COALESCE(multiple_roles, '[]'::jsonb),
        'orphaned_roles', COALESCE(orphaned_roles, '[]'::jsonb),
        'recent_role_changes', COALESCE(recent_role_changes, '[]'::jsonb),
        'generated_at', now()
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant permissions to admins
GRANT EXECUTE ON FUNCTION public.create_user_safe TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_data_integrity_report TO authenticated;


-- Migration: 20250807201825_528f838d-1a6a-4858-ae59-e82f50a54cda.sql

CREATE OR REPLACE FUNCTION public.get_data_integrity_report()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $function$
DECLARE
    duplicate_emails JSONB;
    multiple_roles JSONB;
    orphaned_roles JSONB;
    recent_role_changes JSONB;
BEGIN
    -- Check for duplicate emails (should be none after our fixes)
    SELECT jsonb_agg(
        jsonb_build_object(
            'email', email,
            'user_count', user_count,
            'users', users
        )
    ) INTO duplicate_emails
    FROM (
        SELECT 
            email,
            COUNT(*) as user_count,
            jsonb_agg(jsonb_build_object('id', id, 'name', first_name || ' ' || last_name)) as users
        FROM public.profiles 
        WHERE email IS NOT NULL
        GROUP BY email
        HAVING COUNT(*) > 1
    ) dups;
    
    -- Check for users with multiple roles
    SELECT jsonb_agg(
        jsonb_build_object(
            'user_id', id,
            'email', email,
            'name', first_name || ' ' || last_name,
            'roles', roles,
            'role_count', role_count
        )
    ) INTO multiple_roles
    FROM (
        SELECT 
            p.id, p.email, p.first_name, p.last_name,
            array_agg(ur.role) as roles,
            COUNT(ur.role) as role_count
        FROM public.profiles p
        LEFT JOIN public.user_roles ur ON p.id = ur.user_id
        GROUP BY p.id, p.email, p.first_name, p.last_name
        HAVING COUNT(ur.role) > 1
    ) multi;
    
    -- Check for orphaned roles (roles without profiles)
    SELECT jsonb_agg(
        jsonb_build_object(
            'user_id', user_id,
            'role', role
        )
    ) INTO orphaned_roles
    FROM public.user_roles ur
    LEFT JOIN public.profiles p ON ur.user_id = p.id
    WHERE p.id IS NULL;
    
    -- Get recent role changes
    SELECT jsonb_agg(
        jsonb_build_object(
            'user_id', rcl.user_id,
            'user_email', p.email,
            'user_name', p.first_name || ' ' || p.last_name,
            'old_role', rcl.old_role,
            'new_role', rcl.new_role,
            'changed_by', rcl.changed_by,
            'reason', rcl.reason,
            'created_at', rcl.created_at
        ) ORDER BY rcl.created_at DESC
    ) INTO recent_role_changes
    FROM public.role_change_logs rcl
    LEFT JOIN public.profiles p ON rcl.user_id = p.id
    WHERE rcl.created_at >= now() - INTERVAL '7 days'
    LIMIT 20;
    
    RETURN jsonb_build_object(
        'duplicate_emails', COALESCE(duplicate_emails, '[]'::jsonb),
        'multiple_roles', COALESCE(multiple_roles, '[]'::jsonb),
        'orphaned_roles', COALESCE(orphaned_roles, '[]'::jsonb),
        'recent_role_changes', COALESCE(recent_role_changes, '[]'::jsonb),
        'generated_at', now()
    );
END;
$function$


-- Migration: 20250807202815_8d8820c7-8ff3-4697-b74f-edfeeb15abf5.sql

-- Create bulk upload logs table for audit trail
CREATE TABLE public.bulk_upload_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  operation_type TEXT NOT NULL CHECK (operation_type IN ('tenant', 'unit', 'property')),
  file_name TEXT NOT NULL,
  total_records INTEGER NOT NULL DEFAULT 0,
  successful_records INTEGER NOT NULL DEFAULT 0,
  failed_records INTEGER NOT NULL DEFAULT 0,
  validation_errors JSONB DEFAULT '[]'::jsonb,
  processing_time_ms INTEGER NOT NULL DEFAULT 0,
  uploaded_by UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable Row Level Security
ALTER TABLE public.bulk_upload_logs ENABLE ROW LEVEL SECURITY;

-- Create policies
CREATE POLICY "Admins can view all bulk upload logs" 
ON public.bulk_upload_logs 
FOR SELECT 
USING (has_role(auth.uid(), 'Admin'::app_role));

CREATE POLICY "Users can view their own bulk upload logs" 
ON public.bulk_upload_logs 
FOR SELECT 
USING (uploaded_by = auth.uid());

CREATE POLICY "Property stakeholders can insert bulk upload logs" 
ON public.bulk_upload_logs 
FOR INSERT 
WITH CHECK (
  uploaded_by = auth.uid() AND
  (has_role(auth.uid(), 'Admin'::app_role) OR 
   has_role(auth.uid(), 'Landlord'::app_role) OR 
   has_role(auth.uid(), 'Manager'::app_role) OR 
   has_role(auth.uid(), 'Agent'::app_role))
);

-- Create trigger for updated_at
CREATE TRIGGER update_bulk_upload_logs_updated_at
  BEFORE UPDATE ON public.bulk_upload_logs
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Create indexes for performance
CREATE INDEX idx_bulk_upload_logs_uploaded_by ON public.bulk_upload_logs(uploaded_by);
CREATE INDEX idx_bulk_upload_logs_operation_type ON public.bulk_upload_logs(operation_type);
CREATE INDEX idx_bulk_upload_logs_created_at ON public.bulk_upload_logs(created_at DESC);


-- Migration: 20250807210955_dccad5a4-4bdd-4731-aa19-7ad6cf208a31.sql

-- Create user_audit_logs table for tracking admin actions
CREATE TABLE public.user_audit_logs (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  action TEXT NOT NULL,
  entity_type TEXT,
  entity_id UUID,
  details JSONB DEFAULT '{}',
  performed_by UUID NOT NULL,
  ip_address INET,
  user_agent TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create user_status table for managing user status
CREATE TABLE public.user_status (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL UNIQUE,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'suspended', 'deleted')),
  reason TEXT,
  changed_by UUID,
  changed_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create impersonation_sessions table for tracking impersonation
CREATE TABLE public.impersonation_sessions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  admin_user_id UUID NOT NULL,
  impersonated_user_id UUID NOT NULL,
  session_token TEXT NOT NULL UNIQUE,
  started_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  ended_at TIMESTAMP WITH TIME ZONE,
  ip_address INET,
  user_agent TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS on all tables
ALTER TABLE public.user_audit_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_status ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.impersonation_sessions ENABLE ROW LEVEL SECURITY;

-- Create RLS policies for user_audit_logs
CREATE POLICY "Admins can manage audit logs" 
ON public.user_audit_logs 
FOR ALL 
USING (has_role(auth.uid(), 'Admin'::app_role));

-- Create RLS policies for user_status
CREATE POLICY "Admins can manage user status" 
ON public.user_status 
FOR ALL 
USING (has_role(auth.uid(), 'Admin'::app_role));

CREATE POLICY "Users can view their own status" 
ON public.user_status 
FOR SELECT 
USING (user_id = auth.uid());

-- Create RLS policies for impersonation_sessions
CREATE POLICY "Admins can manage impersonation sessions" 
ON public.impersonation_sessions 
FOR ALL 
USING (has_role(auth.uid(), 'Admin'::app_role));

-- Create log_user_audit function
CREATE OR REPLACE FUNCTION public.log_user_audit(
  _user_id UUID,
  _action TEXT,
  _entity_type TEXT DEFAULT NULL,
  _entity_id UUID DEFAULT NULL,
  _details JSONB DEFAULT '{}',
  _performed_by UUID DEFAULT NULL,
  _ip_address INET DEFAULT NULL,
  _user_agent TEXT DEFAULT NULL
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $$
BEGIN
  INSERT INTO public.user_audit_logs (
    user_id, action, entity_type, entity_id, details, 
    performed_by, ip_address, user_agent
  ) VALUES (
    _user_id, _action, _entity_type, _entity_id, _details,
    COALESCE(_performed_by, auth.uid()), _ip_address, _user_agent
  );
END;
$$;

-- Create get_user_audit_history function
CREATE OR REPLACE FUNCTION public.get_user_audit_history(
  _user_id UUID,
  _limit INTEGER DEFAULT 50,
  _offset INTEGER DEFAULT 0
)
RETURNS TABLE(
  id UUID,
  action TEXT,
  entity_type TEXT,
  entity_id UUID,
  details JSONB,
  performed_by UUID,
  ip_address INET,
  user_agent TEXT,
  created_at TIMESTAMP WITH TIME ZONE
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    ual.id, ual.action, ual.entity_type, ual.entity_id, ual.details,
    ual.performed_by, ual.ip_address, ual.user_agent, ual.created_at
  FROM public.user_audit_logs ual
  WHERE ual.user_id = _user_id
  ORDER BY ual.created_at DESC
  LIMIT _limit OFFSET _offset;
END;
$$;

-- Create suspend_user function
CREATE OR REPLACE FUNCTION public.suspend_user(
  _user_id UUID,
  _reason TEXT DEFAULT 'Administrative action',
  _performed_by UUID DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $$
DECLARE
  v_performed_by UUID;
BEGIN
  v_performed_by := COALESCE(_performed_by, auth.uid());
  
  -- Insert or update user status
  INSERT INTO public.user_status (user_id, status, reason, changed_by)
  VALUES (_user_id, 'suspended', _reason, v_performed_by)
  ON CONFLICT (user_id) 
  DO UPDATE SET 
    status = 'suspended',
    reason = _reason,
    changed_by = v_performed_by,
    changed_at = now(),
    updated_at = now();
  
  -- Log the action
  PERFORM public.log_user_audit(
    _user_id, 'suspend', 'user', _user_id,
    jsonb_build_object('reason', _reason),
    v_performed_by
  );
  
  RETURN jsonb_build_object(
    'success', true,
    'message', 'User suspended successfully'
  );
  
EXCEPTION WHEN OTHERS THEN
  RETURN jsonb_build_object(
    'success', false,
    'error', SQLERRM
  );
END;
$$;

-- Create activate_user function
CREATE OR REPLACE FUNCTION public.activate_user(
  _user_id UUID,
  _performed_by UUID DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $$
DECLARE
  v_performed_by UUID;
BEGIN
  v_performed_by := COALESCE(_performed_by, auth.uid());
  
  -- Insert or update user status
  INSERT INTO public.user_status (user_id, status, reason, changed_by)
  VALUES (_user_id, 'active', 'User activated', v_performed_by)
  ON CONFLICT (user_id) 
  DO UPDATE SET 
    status = 'active',
    reason = 'User activated',
    changed_by = v_performed_by,
    changed_at = now(),
    updated_at = now();
  
  -- Log the action
  PERFORM public.log_user_audit(
    _user_id, 'activate', 'user', _user_id,
    jsonb_build_object('reason', 'User activated'),
    v_performed_by
  );
  
  RETURN jsonb_build_object(
    'success', true,
    'message', 'User activated successfully'
  );
  
EXCEPTION WHEN OTHERS THEN
  RETURN jsonb_build_object(
    'success', false,
    'error', SQLERRM
  );
END;
$$;

-- Create soft_delete_user function
CREATE OR REPLACE FUNCTION public.soft_delete_user(
  _user_id UUID,
  _reason TEXT DEFAULT 'Administrative deletion',
  _performed_by UUID DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $$
DECLARE
  v_performed_by UUID;
BEGIN
  v_performed_by := COALESCE(_performed_by, auth.uid());
  
  -- Insert or update user status
  INSERT INTO public.user_status (user_id, status, reason, changed_by)
  VALUES (_user_id, 'deleted', _reason, v_performed_by)
  ON CONFLICT (user_id) 
  DO UPDATE SET 
    status = 'deleted',
    reason = _reason,
    changed_by = v_performed_by,
    changed_at = now(),
    updated_at = now();
  
  -- Log the action
  PERFORM public.log_user_audit(
    _user_id, 'soft_delete', 'user', _user_id,
    jsonb_build_object('reason', _reason),
    v_performed_by
  );
  
  RETURN jsonb_build_object(
    'success', true,
    'message', 'User soft deleted successfully'
  );
  
EXCEPTION WHEN OTHERS THEN
  RETURN jsonb_build_object(
    'success', false,
    'error', SQLERRM
  );
END;
$$;

-- Create triggers for updated_at columns
CREATE TRIGGER update_user_status_updated_at
  BEFORE UPDATE ON public.user_status
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_impersonation_sessions_updated_at
  BEFORE UPDATE ON public.impersonation_sessions
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();


-- Migration: 20250807213255_23ee5db8-12ae-404e-9caa-2a782f646896.sql

-- Create user_sessions table to support admin tools and session auditing
CREATE TABLE IF NOT EXISTS public.user_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  login_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  logout_at TIMESTAMPTZ NULL,
  ip_address INET NULL,
  user_agent TEXT NULL,
  is_active BOOLEAN NOT NULL DEFAULT true,
  last_activity TIMESTAMPTZ NULL DEFAULT now(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.user_sessions ENABLE ROW LEVEL SECURITY;

-- Policies
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'user_sessions' AND policyname = 'Admins can manage all user sessions'
  ) THEN
    CREATE POLICY "Admins can manage all user sessions"
    ON public.user_sessions
    AS RESTRICTIVE
    FOR ALL
    USING (has_role(auth.uid(), 'Admin'::app_role))
    WITH CHECK (has_role(auth.uid(), 'Admin'::app_role));
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'user_sessions' AND policyname = 'Users can view their own sessions'
  ) THEN
    CREATE POLICY "Users can view their own sessions"
    ON public.user_sessions
    AS RESTRICTIVE
    FOR SELECT
    USING (user_id = auth.uid());
  END IF;
END $$;

-- Trigger to keep updated_at fresh
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger WHERE tgname = 'update_user_sessions_updated_at'
  ) THEN
    CREATE TRIGGER update_user_sessions_updated_at
    BEFORE UPDATE ON public.user_sessions
    FOR EACH ROW
    EXECUTE FUNCTION public.update_updated_at_column();
  END IF;
END $$;

-- Helpful indexes
CREATE INDEX IF NOT EXISTS idx_user_sessions_user_id ON public.user_sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_user_sessions_active ON public.user_sessions(is_active);



-- Migration: 20250808104755_a2139218-6f19-49a9-8974-1233c5ac4381.sql

-- Create centralized PDF templates and branding tables
-- 1) pdf_templates
CREATE TABLE IF NOT EXISTS public.pdf_templates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  type text NOT NULL CHECK (type IN ('invoice','report','letter','notice','lease','receipt','statement','demand_letter')),
  description text,
  content jsonb NOT NULL,
  version integer NOT NULL DEFAULT 1,
  is_active boolean NOT NULL DEFAULT true,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.pdf_templates ENABLE ROW LEVEL SECURITY;

-- RLS policies
CREATE POLICY "Admins can manage pdf templates" ON public.pdf_templates
  FOR ALL TO authenticated USING (has_role(auth.uid(), 'Admin'::app_role)) WITH CHECK (has_role(auth.uid(), 'Admin'::app_role));

CREATE POLICY "Stakeholders can view active templates" ON public.pdf_templates
  FOR SELECT TO authenticated USING (
    is_active = true AND (
      has_role(auth.uid(), 'Landlord'::app_role) OR has_role(auth.uid(), 'Manager'::app_role) OR has_role(auth.uid(), 'Agent'::app_role) OR has_role(auth.uid(), 'Admin'::app_role)
    )
  );

-- 2) branding_profiles (platform and landlord-level branding)
CREATE TABLE IF NOT EXISTS public.branding_profiles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  scope text NOT NULL CHECK (scope IN ('platform','landlord')),
  landlord_id uuid,
  company_name text NOT NULL,
  company_tagline text,
  company_address text,
  company_phone text,
  company_email text,
  logo_url text,
  colors jsonb,
  footer_text text,
  website_url text,
  metadata jsonb DEFAULT '{}'::jsonb,
  is_default boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.branding_profiles ENABLE ROW LEVEL SECURITY;

-- Policies
CREATE POLICY "Admins can manage branding" ON public.branding_profiles
  FOR ALL TO authenticated USING (has_role(auth.uid(), 'Admin'::app_role)) WITH CHECK (has_role(auth.uid(), 'Admin'::app_role));

CREATE POLICY "Landlords manage their branding" ON public.branding_profiles
  FOR ALL TO authenticated USING (scope = 'landlord' AND landlord_id = auth.uid()) WITH CHECK (scope = 'landlord' AND landlord_id = auth.uid());

CREATE POLICY "Stakeholders can view default platform branding" ON public.branding_profiles
  FOR SELECT TO authenticated USING (scope = 'platform' AND is_default = true);

-- 3) pdf_template_bindings (which template to use per document type/role/landlord)
CREATE TABLE IF NOT EXISTS public.pdf_template_bindings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  template_id uuid NOT NULL REFERENCES public.pdf_templates(id) ON DELETE CASCADE,
  document_type text NOT NULL CHECK (document_type IN ('invoice','report','letter','notice','lease','receipt','statement','demand_letter')),
  role text NOT NULL CHECK (role IN ('Admin','Landlord','Manager','Agent','Tenant')),
  landlord_id uuid,
  is_active boolean NOT NULL DEFAULT true,
  priority integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.pdf_template_bindings ENABLE ROW LEVEL SECURITY;

-- Policies
CREATE POLICY "Admins can manage bindings" ON public.pdf_template_bindings
  FOR ALL TO authenticated USING (has_role(auth.uid(), 'Admin'::app_role)) WITH CHECK (has_role(auth.uid(), 'Admin'::app_role));

CREATE POLICY "Landlords manage their bindings" ON public.pdf_template_bindings
  FOR ALL TO authenticated USING ((landlord_id IS NOT NULL) AND landlord_id = auth.uid()) WITH CHECK ((landlord_id IS NOT NULL) AND landlord_id = auth.uid());

CREATE POLICY "Stakeholders can view active bindings" ON public.pdf_template_bindings
  FOR SELECT TO authenticated USING (
    is_active = true AND (
      landlord_id IS NULL OR landlord_id = auth.uid()
    )
  );

-- Helpful index
CREATE INDEX IF NOT EXISTS idx_pdf_template_bindings_lookup ON public.pdf_template_bindings (document_type, role, landlord_id, is_active, priority);

-- Update triggers for updated_at columns
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS trigger AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS set_timestamp_on_pdf_templates ON public.pdf_templates;
CREATE TRIGGER set_timestamp_on_pdf_templates
BEFORE UPDATE ON public.pdf_templates
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

DROP TRIGGER IF EXISTS set_timestamp_on_branding_profiles ON public.branding_profiles;
CREATE TRIGGER set_timestamp_on_branding_profiles
BEFORE UPDATE ON public.branding_profiles
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

DROP TRIGGER IF EXISTS set_timestamp_on_pdf_template_bindings ON public.pdf_template_bindings;
CREATE TRIGGER set_timestamp_on_pdf_template_bindings
BEFORE UPDATE ON public.pdf_template_bindings
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Seed a default platform branding row if none exists



-- Migration: 20250808104830_2c5452b4-cf8f-464e-acc9-e64330b785fa.sql

-- Fix security linter warning for update_updated_at_column by setting search_path and security definer
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;



-- Migration: 20250812181136-.sql

-- 1) Ensure "Free Trial" billing plan exists and is active with price 0
-- Create it if missing

-- Ensure existing "Free Trial" (if any) is active and free

-- 2) Create trigger to auto-provision default landlord subscription on role assignment
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger WHERE tgname = 'trigger_create_default_landlord_subscription'
  ) THEN
    EXECUTE $$
      CREATE TRIGGER trigger_create_default_landlord_subscription
      AFTER INSERT ON public.user_roles
      FOR EACH ROW
      WHEN (NEW.role = 'Landlord'::public.app_role)
      EXECUTE FUNCTION public.create_default_landlord_subscription();
    $$;
  END IF;
END$$;

-- 3) Backfill: Create trial subscriptions for existing Landlords without a subscription
DO $$
DECLARE
  trial_days integer := 14;
  sms_default integer := 100;
  trial_plan_id uuid;
BEGIN
  -- Read trial days from settings: prefer trial_settings, else trial_period_days, else 14
  SELECT COALESCE(
    (SELECT (setting_value->>'trial_period_days')::int FROM public.billing_settings WHERE setting_key = 'trial_settings' LIMIT 1),
    (SELECT (setting_value)::int FROM public.billing_settings WHERE setting_key = 'trial_period_days' LIMIT 1),
    14
  ) INTO trial_days;

  -- Read default SMS credits: prefer trial_settings, else default_sms_credits, else 100
  SELECT COALESCE(
    (SELECT (setting_value->>'default_sms_credits')::int FROM public.billing_settings WHERE setting_key = 'trial_settings' LIMIT 1),
    (SELECT (setting_value)::int FROM public.billing_settings WHERE setting_key = 'default_sms_credits' LIMIT 1),
    100
  ) INTO sms_default;

  -- Prefer "Free Trial" plan; fallback to any active plan by lowest price
  SELECT id INTO trial_plan_id
  FROM public.billing_plans
  WHERE name = 'Free Trial' AND is_active = true
  ORDER BY created_at ASC
  LIMIT 1;

  IF trial_plan_id IS NULL THEN
    SELECT id INTO trial_plan_id
    FROM public.billing_plans
    WHERE is_active = true
    ORDER BY price ASC, created_at ASC
    LIMIT 1;
  END IF;

  -- Insert trial subscriptions for Landlords missing one
  INSERT INTO public.landlord_subscriptions (
    landlord_id,
    billing_plan_id,
    status,
    trial_start_date,
    trial_end_date,
    subscription_start_date,
    sms_credits_balance,
    auto_renewal
  )
  SELECT
    ur.user_id,
    trial_plan_id,
    'trial',
    now(),
    now() + make_interval(days => trial_days),
    now(),
    sms_default,
    true
  FROM public.user_roles ur
  LEFT JOIN public.landlord_subscriptions ls ON ls.landlord_id = ur.user_id
  WHERE ur.role = 'Landlord'::public.app_role
    AND ls.landlord_id IS NULL;
END$$;


-- Migration: 20250812204537-.sql

-- 1) Add per-subscription grace period column
ALTER TABLE public.landlord_subscriptions
ADD COLUMN IF NOT EXISTS grace_period_days integer NOT NULL DEFAULT 7;

-- 2) Update create_default_landlord_subscription() to set grace_period_days from settings
CREATE OR REPLACE FUNCTION public.create_default_landlord_subscription()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  trial_plan_id uuid;
  trial_days integer := 14;
  sms_default integer := 100;
  grace_days integer := 7;
BEGIN
  IF NEW.role = 'Landlord'::public.app_role THEN
    -- Read trial days from settings: prefer trial_settings, else trial_period_days, else 14
    SELECT COALESCE(
      (SELECT (setting_value->>'trial_period_days')::int FROM public.billing_settings WHERE setting_key = 'trial_settings' LIMIT 1),
      (SELECT (setting_value)::int FROM public.billing_settings WHERE setting_key = 'trial_period_days' LIMIT 1),
      14
    ) INTO trial_days;

    -- Read default SMS credits: prefer trial_settings, else default_sms_credits, else 100
    SELECT COALESCE(
      (SELECT (setting_value->>'default_sms_credits')::int FROM public.billing_settings WHERE setting_key = 'trial_settings' LIMIT 1),
      (SELECT (setting_value)::int FROM public.billing_settings WHERE setting_key = 'default_sms_credits' LIMIT 1),
      100
    ) INTO sms_default;

    -- Read grace period days: prefer trial_settings, else automated_billing_settings, else 7
    SELECT COALESCE(
      (SELECT (setting_value->>'grace_period_days')::int FROM public.billing_settings WHERE setting_key = 'trial_settings' LIMIT 1),
      (SELECT grace_period_days FROM public.automated_billing_settings LIMIT 1),
      7
    ) INTO grace_days;

    -- Prefer "Free Trial" plan; fallback to any active plan by lowest price
    SELECT id INTO trial_plan_id
    FROM public.billing_plans
    WHERE name = 'Free Trial' AND is_active = true
    LIMIT 1;

    IF trial_plan_id IS NULL THEN
      SELECT id INTO trial_plan_id
      FROM public.billing_plans
      WHERE is_active = true
      ORDER BY price ASC, created_at ASC
      LIMIT 1;
    END IF;

    IF trial_plan_id IS NOT NULL THEN
      INSERT INTO public.landlord_subscriptions (
        landlord_id,
        billing_plan_id,
        status,
        trial_start_date,
        trial_end_date,
        subscription_start_date,
        sms_credits_balance,
        auto_renewal,
        grace_period_days
      )
      VALUES (
        NEW.user_id,
        trial_plan_id,
        'trial',
        now(),
        now() + make_interval(days => trial_days),
        now(),
        sms_default,
        true,
        grace_days
      )
      ON CONFLICT (landlord_id) DO NOTHING;
    END IF;
  END IF;

  RETURN NEW;
END;
$function$;

-- 3) Update get_trial_status() to respect per-subscription grace_period_days
CREATE OR REPLACE FUNCTION public.get_trial_status(_user_id uuid)
RETURNS text
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path TO ''
AS $function$
DECLARE
  subscription_record RECORD;
  v_grace_days integer := 7;
BEGIN
  -- Get subscription info
  SELECT * INTO subscription_record
  FROM public.landlord_subscriptions
  WHERE landlord_id = _user_id;
  
  -- If no subscription, return null
  IF subscription_record IS NULL THEN
    RETURN NULL;
  END IF;
  
  -- Return current status if not trial-related
  IF subscription_record.status NOT IN ('trial', 'trial_expired', 'suspended') THEN
    RETURN subscription_record.status;
  END IF;
  
  -- Determine grace period per subscription
  v_grace_days := COALESCE(subscription_record.grace_period_days, 7);
  
  -- Check trial status based on dates
  IF subscription_record.trial_end_date IS NULL THEN
    RETURN 'trial';
  END IF;
  
  -- Active trial
  IF now() <= subscription_record.trial_end_date THEN
    RETURN 'trial';
  END IF;
  
  -- Grace period
  IF now() <= (subscription_record.trial_end_date + make_interval(days => v_grace_days)) THEN
    RETURN 'trial_expired';
  END IF;
  
  -- Suspended after grace period
  RETURN 'suspended';
END;
$function$;

-- 4) Backfill helper to safely revert trial lengths around a cutoff
-- Parameters:
--  _cutoff: timestamp splitting old/new cohorts
--  _pre_cutoff_days: trial days to enforce for accounts created before cutoff
--  _post_cutoff_days: trial days to enforce for accounts created at/after cutoff
--  _include_active: whether to include 'active' subs (default false)
--  _dry_run: if true, only report what would change
CREATE OR REPLACE FUNCTION public.backfill_trial_periods(
  _cutoff timestamptz,
  _pre_cutoff_days integer,
  _post_cutoff_days integer,
  _include_active boolean DEFAULT false,
  _dry_run boolean DEFAULT true
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $function$
DECLARE
  updated_count int := 0;
  examined_count int := 0;
  to_update_count int := 0;
BEGIN
  -- Count examined rows
  SELECT COUNT(*) INTO examined_count
  FROM public.landlord_subscriptions ls
  WHERE ls.trial_start_date IS NOT NULL
    AND ls.trial_end_date IS NOT NULL
    AND (ls.status IN ('trial','trial_expired','suspended') OR (_include_active AND ls.status = 'active'));

  -- Rows that would be updated
  WITH candidates AS (
    SELECT 
      ls.id,
      ls.trial_start_date,
      ls.trial_end_date,
      ls.created_at,
      (EXTRACT(epoch FROM (ls.trial_end_date - ls.trial_start_date)) / 86400)::int AS current_days,
      CASE WHEN ls.created_at < _cutoff THEN _pre_cutoff_days ELSE _post_cutoff_days END AS desired_days
    FROM public.landlord_subscriptions ls
    WHERE ls.trial_start_date IS NOT NULL
      AND ls.trial_end_date IS NOT NULL
      AND (ls.status IN ('trial','trial_expired','suspended') OR (_include_active AND ls.status = 'active'))
  ),
  diffs AS (
    SELECT id, trial_start_date, created_at, current_days, desired_days
    FROM candidates
    WHERE current_days IN (_pre_cutoff_days, _post_cutoff_days)
      AND current_days <> desired_days
  )
  SELECT COUNT(*) INTO to_update_count FROM diffs;

  IF _dry_run THEN
    RETURN jsonb_build_object(
      'dry_run', true,
      'examined', examined_count,
      'would_update', to_update_count,
      'cutoff', _cutoff,
      'pre_cutoff_days', _pre_cutoff_days,
      'post_cutoff_days', _post_cutoff_days
    );
  END IF;

  -- Perform updates
  WITH diffs AS (
    SELECT 
      ls.id,
      ls.trial_start_date,
      CASE WHEN ls.created_at < _cutoff THEN _pre_cutoff_days ELSE _post_cutoff_days END AS desired_days
    FROM public.landlord_subscriptions ls
    WHERE ls.trial_start_date IS NOT NULL
      AND ls.trial_end_date IS NOT NULL
      AND (ls.status IN ('trial','trial_expired','suspended') OR (_include_active AND ls.status = 'active'))
      AND ((EXTRACT(epoch FROM (ls.trial_end_date - ls.trial_start_date)) / 86400)::int) IN (_pre_cutoff_days, _post_cutoff_days)
      AND ((EXTRACT(epoch FROM (ls.trial_end_date - ls.trial_start_date)) / 86400)::int) <> CASE WHEN ls.created_at < _cutoff THEN _pre_cutoff_days ELSE _post_cutoff_days END
  )
  UPDATE public.landlord_subscriptions ls
  SET trial_end_date = diffs.trial_start_date + make_interval(days => diffs.desired_days),
      updated_at = now()
  FROM diffs
  WHERE ls.id = diffs.id;

  GET DIAGNOSTICS updated_count = ROW_COUNT;

  RETURN jsonb_build_object(
    'dry_run', false,
    'examined', examined_count,
    'updated', updated_count,
    'cutoff', _cutoff,
    'pre_cutoff_days', _pre_cutoff_days,
    'post_cutoff_days', _post_cutoff_days
  );
END;
$function$;


-- Migration: 20250812204810-.sql

-- Dry-run backfill based on inferred cutoff (first 70-day creation time)
select public.backfill_trial_periods(
  timestamp '2025-08-07 09:00:08.306142+00',
  30,
  70,
  false,
  true
) as result;


-- Migration: 20250812205617-.sql

-- Upsert trial_settings with cutoff and policy days
DO $$
DECLARE
  v_exists BOOLEAN;
BEGIN
  -- Update existing trial_settings if present
  UPDATE public.billing_settings
  SET 
    setting_value = COALESCE(setting_value, '{}'::jsonb) || jsonb_build_object(
      'cutoff_date_utc', '2025-08-07T09:00:08.306142Z',
      'pre_cutoff_days', 30,
      'post_cutoff_days', 70
    ),
    description = COALESCE(description, 'Trial settings with historical policy cutoff')
  WHERE setting_key = 'trial_settings';

  GET DIAGNOSTICS v_exists = ROW_COUNT > 0;

  -- If no row existed, insert a sensible default including the cutoff
  IF NOT v_exists THEN
    INSERT INTO public.billing_settings (setting_key, setting_value, description)
    VALUES (
      'trial_settings',
      jsonb_build_object(
        'trial_period_days', 70,
        'default_sms_credits', 100,
        'grace_period_days', 7,
        'cutoff_date_utc', '2025-08-07T09:00:08.306142Z',
        'pre_cutoff_days', 30,
        'post_cutoff_days', 70
      ),
      'Trial settings with historical policy cutoff (pre: 30 days, post: 70 days)'
    );
  END IF;
END$$;



-- Migration: 20250813175429_41bd54b2-b893-40ad-be5d-51b20029681b.sql

-- Add landlord_id column to email_templates table for landlord-specific templates
ALTER TABLE public.email_templates 
ADD COLUMN landlord_id UUID REFERENCES auth.users(id) ON DELETE CASCADE;

-- Add landlord_id column to message_templates table for landlord-specific templates  
ALTER TABLE public.message_templates
ADD COLUMN landlord_id UUID REFERENCES auth.users(id) ON DELETE CASCADE;

-- Update RLS policies for email_templates to support landlord access
DROP POLICY IF EXISTS "Admins can manage email templates" ON public.email_templates;
DROP POLICY IF EXISTS "Landlords can view their email templates" ON public.email_templates;

CREATE POLICY "Admins can manage all email templates" 
ON public.email_templates 
FOR ALL 
USING (has_role(auth.uid(), 'Admin'::app_role));

CREATE POLICY "Landlords can manage their own email templates"
ON public.email_templates
FOR ALL
USING (
  (landlord_id = auth.uid() AND has_role(auth.uid(), 'Landlord'::app_role)) OR
  has_role(auth.uid(), 'Admin'::app_role)
);

CREATE POLICY "Landlords can view global email templates"
ON public.email_templates
FOR SELECT
USING (
  (landlord_id IS NULL AND enabled = true AND has_role(auth.uid(), 'Landlord'::app_role)) OR
  (landlord_id = auth.uid() AND has_role(auth.uid(), 'Landlord'::app_role)) OR
  has_role(auth.uid(), 'Admin'::app_role)
);

-- Update RLS policies for message_templates to support landlord access
DROP POLICY IF EXISTS "Admins can manage message templates" ON public.message_templates;
DROP POLICY IF EXISTS "Landlords can view their message templates" ON public.message_templates;

CREATE POLICY "Admins can manage all message templates"
ON public.message_templates
FOR ALL
USING (has_role(auth.uid(), 'Admin'::app_role));

CREATE POLICY "Landlords can manage their own message templates"
ON public.message_templates
FOR ALL
USING (
  (landlord_id = auth.uid() AND has_role(auth.uid(), 'Landlord'::app_role)) OR
  has_role(auth.uid(), 'Admin'::app_role)
);

CREATE POLICY "Landlords can view global message templates"
ON public.message_templates
FOR SELECT
USING (
  (landlord_id IS NULL AND enabled = true AND has_role(auth.uid(), 'Landlord'::app_role)) OR
  (landlord_id = auth.uid() AND has_role(auth.uid(), 'Landlord'::app_role)) OR
  has_role(auth.uid(), 'Admin'::app_role)
);


-- Migration: 20250814091905_02d033db-4d5a-434b-896f-a856e9782bb6.sql

-- Create database triggers for automatic notification generation

-- Function to create payment notifications
CREATE OR REPLACE FUNCTION create_payment_notification()
RETURNS TRIGGER AS $$
DECLARE
  tenant_user_id UUID;
  notification_title TEXT;
  notification_message TEXT;
BEGIN
  -- Get the tenant's user_id
  SELECT t.user_id INTO tenant_user_id
  FROM tenants t
  WHERE t.id = NEW.tenant_id;
  
  -- Only create notification if tenant has a user account
  IF tenant_user_id IS NOT NULL THEN
    -- Set notification content based on payment status
    IF NEW.status = 'completed' THEN
      notification_title := 'Payment Received';
      notification_message := 'Your payment of ' || NEW.amount || ' has been successfully processed.';
    ELSIF NEW.status = 'pending' THEN
      notification_title := 'Payment Pending';
      notification_message := 'Your payment of ' || NEW.amount || ' is being processed.';
    ELSIF NEW.status = 'failed' THEN
      notification_title := 'Payment Failed';
      notification_message := 'Your payment of ' || NEW.amount || ' could not be processed. Please try again.';
    ELSE
      notification_title := 'Payment Status Update';
      notification_message := 'Your payment status has been updated to ' || NEW.status || '.';
    END IF;
    
    -- Insert notification
    INSERT INTO public.notifications (
      user_id, title, message, type, related_id, related_type
    ) VALUES (
      tenant_user_id, 
      notification_title, 
      notification_message, 
      'payment', 
      NEW.id::text, 
      'payment'
    );
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger for payment notifications
DROP TRIGGER IF EXISTS payment_notification_trigger ON payments;
CREATE TRIGGER payment_notification_trigger
  AFTER INSERT OR UPDATE OF status ON payments
  FOR EACH ROW
  EXECUTE FUNCTION create_payment_notification();

-- Function to create maintenance request notifications
CREATE OR REPLACE FUNCTION create_maintenance_notification()
RETURNS TRIGGER AS $$
DECLARE
  tenant_user_id UUID;
  notification_title TEXT;
  notification_message TEXT;
BEGIN
  -- Get the tenant's user_id
  SELECT t.user_id INTO tenant_user_id
  FROM tenants t
  WHERE t.id = NEW.tenant_id;
  
  -- Only create notification if tenant has a user account and status changed
  IF tenant_user_id IS NOT NULL AND (TG_OP = 'INSERT' OR OLD.status != NEW.status) THEN
    notification_title := 'Maintenance Request Update';
    
    IF TG_OP = 'INSERT' THEN
      notification_message := 'Your maintenance request "' || NEW.title || '" has been received and is being reviewed.';
    ELSE
      notification_message := 'Your maintenance request "' || NEW.title || '" status has been updated to ' || NEW.status || '.';
    END IF;
    
    -- Insert notification
    INSERT INTO public.notifications (
      user_id, title, message, type, related_id, related_type
    ) VALUES (
      tenant_user_id, 
      notification_title, 
      notification_message, 
      'maintenance', 
      NEW.id::text, 
      'maintenance_request'
    );
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger for maintenance notifications
DROP TRIGGER IF EXISTS maintenance_notification_trigger ON maintenance_requests;
CREATE TRIGGER maintenance_notification_trigger
  AFTER INSERT OR UPDATE OF status ON maintenance_requests
  FOR EACH ROW
  EXECUTE FUNCTION create_maintenance_notification();

-- Function to create lease expiration notifications
CREATE OR REPLACE FUNCTION create_lease_expiration_notification()
RETURNS TRIGGER AS $$
DECLARE
  tenant_user_id UUID;
  days_until_expiry INTEGER;
  notification_title TEXT;
  notification_message TEXT;
BEGIN
  -- Get the tenant's user_id
  SELECT t.user_id INTO tenant_user_id
  FROM tenants t
  WHERE t.id = NEW.tenant_id;
  
  -- Calculate days until lease expiry
  days_until_expiry := NEW.lease_end_date - CURRENT_DATE;
  
  -- Only create notification if tenant has a user account and lease is expiring soon
  IF tenant_user_id IS NOT NULL AND days_until_expiry <= 30 AND days_until_expiry > 0 THEN
    IF days_until_expiry <= 7 THEN
      notification_title := 'Lease Expiring Soon';
      notification_message := 'Your lease expires in ' || days_until_expiry || ' days. Please contact your landlord to discuss renewal.';
    ELSIF days_until_expiry <= 30 THEN
      notification_title := 'Lease Renewal Reminder';
      notification_message := 'Your lease expires in ' || days_until_expiry || ' days. Consider discussing renewal options with your landlord.';
    END IF;
    
    -- Insert notification
    INSERT INTO public.notifications (
      user_id, title, message, type, related_id, related_type
    ) VALUES (
      tenant_user_id, 
      notification_title, 
      notification_message, 
      'lease', 
      NEW.id::text, 
      'lease'
    );
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger for lease expiration notifications
DROP TRIGGER IF EXISTS lease_expiration_notification_trigger ON leases;
CREATE TRIGGER lease_expiration_notification_trigger
  AFTER INSERT OR UPDATE OF lease_end_date ON leases
  FOR EACH ROW
  EXECUTE FUNCTION create_lease_expiration_notification();

-- Function to create invoice notifications
CREATE OR REPLACE FUNCTION create_invoice_notification()
RETURNS TRIGGER AS $$
DECLARE
  tenant_user_id UUID;
  notification_title TEXT;
  notification_message TEXT;
BEGIN
  -- Get the tenant's user_id
  SELECT t.user_id INTO tenant_user_id
  FROM tenants t
  WHERE t.id = NEW.tenant_id;
  
  -- Only create notification if tenant has a user account
  IF tenant_user_id IS NOT NULL THEN
    IF TG_OP = 'INSERT' THEN
      notification_title := 'New Invoice';
      notification_message := 'A new invoice #' || NEW.invoice_number || ' for ' || NEW.amount || ' has been generated.';
    ELSIF OLD.status != NEW.status THEN
      notification_title := 'Invoice Status Update';
      notification_message := 'Invoice #' || NEW.invoice_number || ' status has been updated to ' || NEW.status || '.';
    ELSE
      RETURN NEW; -- No notification needed
    END IF;
    
    -- Insert notification
    INSERT INTO public.notifications (
      user_id, title, message, type, related_id, related_type
    ) VALUES (
      tenant_user_id, 
      notification_title, 
      notification_message, 
      'payment', 
      NEW.id::text, 
      'invoice'
    );
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger for invoice notifications
DROP TRIGGER IF EXISTS invoice_notification_trigger ON invoices;
CREATE TRIGGER invoice_notification_trigger
  AFTER INSERT OR UPDATE OF status ON invoices
  FOR EACH ROW
  EXECUTE FUNCTION create_invoice_notification();


-- Migration: 20250814093047_2a792421-da02-4ec9-8a23-fcdd476b9c5c.sql

-- Fix database function security issues by adding proper search_path settings
-- This prevents SQL injection through search path manipulation

-- Update all existing functions to include SECURITY DEFINER SET search_path = ''
-- Functions with security implications

ALTER FUNCTION public.set_property_owner() SECURITY DEFINER SET search_path = '';
ALTER FUNCTION public.get_transaction_status(text) SECURITY DEFINER SET search_path = '';
ALTER FUNCTION public.has_permission(uuid, text) SECURITY DEFINER SET search_path = '';
ALTER FUNCTION public.set_expense_creator() SECURITY DEFINER SET search_path = '';
ALTER FUNCTION public.update_meter_readings_updated_at() SECURITY DEFINER SET search_path = '';
ALTER FUNCTION public.update_email_logs_updated_at() SECURITY DEFINER SET search_path = '';
ALTER FUNCTION public.set_announcement_creator() SECURITY DEFINER SET search_path = '';
ALTER FUNCTION public.is_user_tenant(uuid) SECURITY DEFINER SET search_path = '';
ALTER FUNCTION public.get_user_tenant_ids(uuid) SECURITY DEFINER SET search_path = '';
ALTER FUNCTION public.get_user_permissions(uuid) SECURITY DEFINER SET search_path = '';
ALTER FUNCTION public.can_user_manage_tenant(uuid, uuid) SECURITY DEFINER SET search_path = '';
ALTER FUNCTION public.update_updated_at_column() SECURITY DEFINER SET search_path = '';
ALTER FUNCTION public.log_user_activity(uuid, text, text, uuid, jsonb, inet, text) SECURITY DEFINER SET search_path = '';
ALTER FUNCTION public.create_service_charge_invoice(uuid, date, date, numeric, numeric, numeric) SECURITY DEFINER SET search_path = '';
ALTER FUNCTION public.check_trial_limitation(uuid, text, integer) SECURITY DEFINER SET search_path = '';
ALTER FUNCTION public.log_trial_status_change(uuid, text, text, text, jsonb) SECURITY DEFINER SET search_path = '';
ALTER FUNCTION public.get_trial_status(uuid) SECURITY DEFINER SET search_path = '';
ALTER FUNCTION public.create_default_landlord_subscription() SECURITY DEFINER SET search_path = 'public';
ALTER FUNCTION public.calculate_property_total_units() SECURITY DEFINER SET search_path = '';
ALTER FUNCTION public.backfill_trial_periods(timestamp with time zone, integer, integer, boolean, boolean) SECURITY DEFINER SET search_path = '';
ALTER FUNCTION public.create_user_with_role(text, text, text, text, app_role) SECURITY DEFINER SET search_path = '';
ALTER FUNCTION public.get_tenant_unit_ids(uuid) SECURITY DEFINER SET search_path = '';
ALTER FUNCTION public.get_tenant_property_ids(uuid) SECURITY DEFINER SET search_path = '';
ALTER FUNCTION public.generate_monthly_service_invoices() SECURITY DEFINER SET search_path = '';
ALTER FUNCTION public.log_maintenance_action(uuid, uuid, text, text, text, jsonb) SECURITY DEFINER SET search_path = '';
ALTER FUNCTION public.log_system_event(text, text, text, jsonb, uuid) SECURITY DEFINER SET search_path = '';
ALTER FUNCTION public.create_user_safe(text, text, text, text, app_role) SECURITY DEFINER SET search_path = '';
ALTER FUNCTION public.get_data_integrity_report() SECURITY DEFINER SET search_path = '';
ALTER FUNCTION public.log_user_audit(uuid, text, text, uuid, jsonb, uuid, inet, text) SECURITY DEFINER SET search_path = '';
ALTER FUNCTION public.get_user_audit_history(uuid, integer, integer) SECURITY DEFINER SET search_path = '';
ALTER FUNCTION public.suspend_user(uuid, text, uuid) SECURITY DEFINER SET search_path = '';
ALTER FUNCTION public.activate_user(uuid, uuid) SECURITY DEFINER SET search_path = '';
ALTER FUNCTION public.soft_delete_user(uuid, text, uuid) SECURITY DEFINER SET search_path = '';
ALTER FUNCTION public.has_role(uuid, app_role) SECURITY DEFINER SET search_path = '';
ALTER FUNCTION public.handle_new_user() SECURITY DEFINER SET search_path = '';

-- Move extensions from public schema to dedicated schema
-- Create extensions schema
CREATE SCHEMA IF NOT EXISTS extensions;

-- Note: Extension movement would require careful coordination with Supabase team
-- This is typically handled at the platform level for hosted databases

-- Create table for tracking system health and performance
CREATE TABLE IF NOT EXISTS public.system_health_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  service TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('healthy', 'degraded', 'down')),
  response_time_ms INTEGER,
  error_count INTEGER DEFAULT 0,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Enable RLS on system health logs
ALTER TABLE public.system_health_logs ENABLE ROW LEVEL SECURITY;

-- Create policy for system health logs (Admin only)
CREATE POLICY "Only admins can access system health logs" ON public.system_health_logs
FOR ALL USING (
  EXISTS (
    SELECT 1 FROM public.user_roles 
    WHERE user_id = auth.uid() AND role = 'Admin'
  )
);

-- Create function to log system health
CREATE OR REPLACE FUNCTION public.log_system_health(
  _service text,
  _status text,
  _response_time_ms integer DEFAULT NULL,
  _error_count integer DEFAULT 0,
  _metadata jsonb DEFAULT '{}'
)
RETURNS void
LANGUAGE sql
SECURITY DEFINER
SET search_path = ''
AS $$
  INSERT INTO public.system_health_logs (
    service, status, response_time_ms, error_count, metadata
  ) VALUES (
    _service, _status, _response_time_ms, _error_count, _metadata
  );
$$;


-- Migration: 20250814105614_1801b14f-3192-4bc4-87eb-4e99bb4c6de5.sql

-- Fix critical security vulnerabilities by implementing proper RLS policies for user data tables

-- 1. Enable RLS on profiles table (if not already enabled)
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- 2. Create RLS policies for profiles table
-- Drop existing policies if they exist to avoid conflicts
DROP POLICY IF EXISTS "Users can view own profile" ON public.profiles;
DROP POLICY IF EXISTS "Users can update own profile" ON public.profiles;
DROP POLICY IF EXISTS "Users can insert own profile" ON public.profiles;
DROP POLICY IF EXISTS "Admins can view all profiles" ON public.profiles;
DROP POLICY IF EXISTS "Admins can manage all profiles" ON public.profiles;

-- Allow users to view only their own profile
CREATE POLICY "Users can view own profile" ON public.profiles
  FOR SELECT
  USING (auth.uid() = id);

-- Allow users to update only their own profile
CREATE POLICY "Users can update own profile" ON public.profiles
  FOR UPDATE
  USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id);

-- Allow users to insert their own profile (for new signups)
CREATE POLICY "Users can insert own profile" ON public.profiles
  FOR INSERT
  WITH CHECK (auth.uid() = id);

-- Allow admins to manage all profiles
CREATE POLICY "Admins can manage all profiles" ON public.profiles
  FOR ALL
  USING (has_role(auth.uid(), 'Admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'Admin'::app_role));

-- 3. Enable RLS on tenants table (if not already enabled)
ALTER TABLE public.tenants ENABLE ROW LEVEL SECURITY;

-- 4. Create RLS policies for tenants table
-- Drop existing policies if they exist to avoid conflicts
DROP POLICY IF EXISTS "Tenants can view own record" ON public.tenants;
DROP POLICY IF EXISTS "Tenants can update own record" ON public.tenants;
DROP POLICY IF EXISTS "Property stakeholders can manage tenants" ON public.tenants;
DROP POLICY IF EXISTS "Admins can manage all tenants" ON public.tenants;

-- Allow tenants to view only their own record
CREATE POLICY "Tenants can view own record" ON public.tenants
  FOR SELECT
  USING (auth.uid() = user_id);

-- Allow tenants to update only their own record (limited fields)
CREATE POLICY "Tenants can update own record" ON public.tenants
  FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Allow property owners/managers to manage tenants for their properties
CREATE POLICY "Property stakeholders can manage tenants" ON public.tenants
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.leases l
      JOIN public.units u ON l.unit_id = u.id
      JOIN public.properties p ON u.property_id = p.id
      WHERE l.tenant_id = tenants.id 
        AND (p.owner_id = auth.uid() OR p.manager_id = auth.uid())
    )
  );

-- Allow admins to manage all tenant records
CREATE POLICY "Admins can manage all tenants" ON public.tenants
  FOR ALL
  USING (has_role(auth.uid(), 'Admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'Admin'::app_role));

-- 5. Ensure user_roles table has proper RLS (should already be secure but let's verify)
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they exist
DROP POLICY IF EXISTS "Users can view own roles" ON public.user_roles;
DROP POLICY IF EXISTS "Admins can manage all roles" ON public.user_roles;

-- Allow users to view only their own roles
CREATE POLICY "Users can view own roles" ON public.user_roles
  FOR SELECT
  USING (auth.uid() = user_id);

-- Allow admins to manage all user roles
CREATE POLICY "Admins can manage all roles" ON public.user_roles
  FOR ALL
  USING (has_role(auth.uid(), 'Admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'Admin'::app_role));

-- 6. Create a function to safely get user profile data (for admin use cases)
CREATE OR REPLACE FUNCTION public.get_user_profile_safe(_user_id UUID)
RETURNS TABLE(
  id UUID,
  email TEXT,
  first_name TEXT,
  last_name TEXT,
  phone TEXT,
  created_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ
)
LANGUAGE SQL
SECURITY DEFINER
SET search_path = ''
AS $$
  -- Only allow admins or the user themselves to access profile data
  SELECT 
    p.id,
    p.email,
    p.first_name,
    p.last_name,
    p.phone,
    p.created_at,
    p.updated_at
  FROM public.profiles p
  WHERE p.id = _user_id
    AND (
      auth.uid() = _user_id 
      OR public.has_role(auth.uid(), 'Admin'::public.app_role)
    );
$$;

-- 7. Create audit logging for sensitive data access
CREATE TABLE IF NOT EXISTS public.data_access_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  accessed_by UUID NOT NULL,
  accessed_table TEXT NOT NULL,
  accessed_record_id UUID,
  access_type TEXT NOT NULL, -- SELECT, INSERT, UPDATE, DELETE
  accessed_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  ip_address INET,
  user_agent TEXT
);

-- Enable RLS on audit logs
ALTER TABLE public.data_access_logs ENABLE ROW LEVEL SECURITY;

-- Only admins can view audit logs
CREATE POLICY "Admins can view audit logs" ON public.data_access_logs
  FOR SELECT
  USING (has_role(auth.uid(), 'Admin'::app_role));

-- System can insert audit logs
CREATE POLICY "System can insert audit logs" ON public.data_access_logs
  FOR INSERT
  WITH CHECK (true);

-- Comment on the security measures
COMMENT ON POLICY "Users can view own profile" ON public.profiles IS 
'Security: Users can only access their own profile data to prevent data leaks';

COMMENT ON POLICY "Admins can manage all profiles" ON public.profiles IS 
'Security: Admin access to profiles for legitimate administrative purposes';

COMMENT ON POLICY "Tenants can view own record" ON public.tenants IS 
'Security: Tenants can only access their own tenant record to prevent personal information exposure';

COMMENT ON POLICY "Property stakeholders can manage tenants" ON public.tenants IS 
'Security: Property owners/managers can only access tenants for their own properties';

COMMENT ON TABLE public.data_access_logs IS 
'Security: Audit trail for accessing sensitive user data';


-- Migration: 20250814105756_3d9a1ae3-2333-4647-b78d-4f1c55bdc1dc.sql

-- Fix function search path security issues by updating existing functions
-- This addresses the "Function Search Path Mutable" security warnings

-- Update functions that don't have SET search_path = '' for security
-- These functions need to be recreated with proper security settings

-- 1. Fix the has_role function (if it exists without proper search path)
CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role app_role)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles
    WHERE user_id = _user_id
      AND role = _role
  )
$$;

-- 2. Fix other security-sensitive functions that may be missing search_path

-- Update the get_trial_status function
CREATE OR REPLACE FUNCTION public.get_trial_status(_user_id uuid)
RETURNS text
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  subscription_record RECORD;
  v_grace_days integer := 7;
BEGIN
  -- Get subscription info
  SELECT * INTO subscription_record
  FROM public.landlord_subscriptions
  WHERE landlord_id = _user_id;
  
  -- If no subscription, return null
  IF subscription_record IS NULL THEN
    RETURN NULL;
  END IF;
  
  -- Return current status if not trial-related
  IF subscription_record.status NOT IN ('trial', 'trial_expired', 'suspended') THEN
    RETURN subscription_record.status;
  END IF;
  
  -- Determine grace period per subscription
  v_grace_days := COALESCE(subscription_record.grace_period_days, 7);
  
  -- Check trial status based on dates
  IF subscription_record.trial_end_date IS NULL THEN
    RETURN 'trial';
  END IF;
  
  -- Active trial
  IF now() <= subscription_record.trial_end_date THEN
    RETURN 'trial';
  END IF;
  
  -- Grace period
  IF now() <= (subscription_record.trial_end_date + make_interval(days => v_grace_days)) THEN
    RETURN 'trial_expired';
  END IF;
  
  -- Suspended after grace period
  RETURN 'suspended';
END;
$$;

-- Update the check_trial_limitation function
CREATE OR REPLACE FUNCTION public.check_trial_limitation(_user_id uuid, _feature text, _current_count integer DEFAULT 1)
RETURNS boolean
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  subscription_record RECORD;
  feature_limit integer;
BEGIN
  -- Get subscription info
  SELECT * INTO subscription_record
  FROM public.landlord_subscriptions
  WHERE landlord_id = _user_id;
  
  -- If no subscription or not on trial, allow
  IF subscription_record IS NULL OR subscription_record.status != 'trial' THEN
    RETURN true;
  END IF;
  
  -- Check if trial is expired
  IF subscription_record.trial_end_date < now() THEN
    RETURN false;
  END IF;
  
  -- Get feature limit from trial_limitations
  feature_limit := (subscription_record.trial_limitations ->> _feature)::integer;
  
  -- If no limit set, allow
  IF feature_limit IS NULL THEN
    RETURN true;
  END IF;
  
  -- Check if current count exceeds limit
  RETURN _current_count <= feature_limit;
END;
$$;

-- Update the is_user_tenant function
CREATE OR REPLACE FUNCTION public.is_user_tenant(_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.tenants
    WHERE user_id = _user_id
  )
$$;

-- Update the get_user_tenant_ids function
CREATE OR REPLACE FUNCTION public.get_user_tenant_ids(_user_id uuid)
RETURNS uuid[]
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT array_agg(id)
  FROM public.tenants
  WHERE user_id = _user_id
$$;

-- Update the get_tenant_unit_ids function
CREATE OR REPLACE FUNCTION public.get_tenant_unit_ids(_user_id uuid)
RETURNS uuid[]
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT array_agg(DISTINCT l.unit_id)
  FROM public.leases l
  JOIN public.tenants t ON t.id = l.tenant_id
  WHERE t.user_id = _user_id;
$$;

-- Update the get_tenant_property_ids function
CREATE OR REPLACE FUNCTION public.get_tenant_property_ids(_user_id uuid)
RETURNS uuid[]
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT array_agg(DISTINCT u.property_id)
  FROM public.units u
  JOIN public.leases l ON l.unit_id = u.id
  JOIN public.tenants t ON t.id = l.tenant_id
  WHERE t.user_id = _user_id;
$$;

-- Update the can_user_manage_tenant function
CREATE OR REPLACE FUNCTION public.can_user_manage_tenant(_user_id uuid, _tenant_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.leases l
    JOIN public.units u ON l.unit_id = u.id
    JOIN public.properties p ON u.property_id = p.id
    WHERE l.tenant_id = _tenant_id 
      AND (p.owner_id = _user_id OR p.manager_id = _user_id)
  ) OR EXISTS (
    SELECT 1
    FROM public.user_roles ur
    WHERE ur.user_id = _user_id AND ur.role = 'Admin'
  );
$$;

-- Update the get_user_permissions function
CREATE OR REPLACE FUNCTION public.get_user_permissions(_user_id uuid)
RETURNS TABLE(permission_name text, category text, description text)
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT DISTINCT p.name, p.category, p.description
  FROM public.user_roles ur
  JOIN public.role_permissions rp ON ur.role = rp.role
  JOIN public.permissions p ON rp.permission_id = p.id
  WHERE ur.user_id = _user_id
  ORDER BY p.category, p.name
$$;

-- Update the get_transaction_status function
CREATE OR REPLACE FUNCTION public.get_transaction_status(p_checkout_request_id text)
RETURNS text
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT status 
  FROM public.mpesa_transactions 
  WHERE checkout_request_id = p_checkout_request_id
  LIMIT 1;
$$;

-- Comment on the security improvement
COMMENT ON FUNCTION public.has_role(uuid, app_role) IS 
'Security: Function updated with SET search_path = '''' to prevent search path attacks';

COMMENT ON FUNCTION public.get_trial_status(uuid) IS 
'Security: Function updated with SET search_path = '''' to prevent search path attacks';

COMMENT ON FUNCTION public.check_trial_limitation(uuid, text, integer) IS 
'Security: Function updated with SET search_path = '''' to prevent search path attacks';


-- Migration: 20250814110229_f7c83271-9e39-423d-abc3-aabea1c98cd3.sql

-- Fix infinite recursion in RLS policies by simplifying them

-- 1. Drop the problematic policies that are causing infinite recursion
DROP POLICY IF EXISTS "Property stakeholders can manage tenants" ON public.tenants;
DROP POLICY IF EXISTS "Property owners can manage their leases" ON public.leases;
DROP POLICY IF EXISTS "Tenants can view their own leases" ON public.leases;

-- 2. Create simpler, non-recursive policies for tenants table
-- Tenants can only view and update their own record (simple user_id check)
CREATE POLICY "Tenants can view own record" ON public.tenants
  FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Tenants can update own record" ON public.tenants
  FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Only admins can insert/delete tenant records (to prevent unauthorized tenant creation)
CREATE POLICY "Admins can manage all tenants" ON public.tenants
  FOR ALL
  USING (has_role(auth.uid(), 'Admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'Admin'::app_role));

-- 3. Create simpler policies for leases table
-- Tenants can view their own leases (direct tenant_id check only)
CREATE POLICY "Tenants can view own leases" ON public.leases
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.tenants t
      WHERE t.id = leases.tenant_id 
        AND t.user_id = auth.uid()
    )
  );

-- Property stakeholders can manage leases through a security definer function
-- First, create a security definer function to check property ownership
CREATE OR REPLACE FUNCTION public.user_owns_property(_property_id UUID, _user_id UUID)
RETURNS BOOLEAN
LANGUAGE SQL
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.properties p
    WHERE p.id = _property_id 
      AND (p.owner_id = _user_id OR p.manager_id = _user_id)
  );
$$;

-- Now create the lease policy using the function
CREATE POLICY "Property stakeholders can manage leases" ON public.leases
  FOR ALL
  USING (
    has_role(auth.uid(), 'Admin'::app_role) OR
    public.user_owns_property(
      (SELECT u.property_id FROM public.units u WHERE u.id = leases.unit_id),
      auth.uid()
    )
  );

-- 4. Ensure units table has proper policies
ALTER TABLE public.units ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Property stakeholders can manage units" ON public.units;

CREATE POLICY "Property stakeholders can manage units" ON public.units
  FOR ALL
  USING (
    has_role(auth.uid(), 'Admin'::app_role) OR
    public.user_owns_property(units.property_id, auth.uid())
  );

-- 5. Ensure properties table has proper policies
ALTER TABLE public.properties ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Property stakeholders can manage properties" ON public.properties;

CREATE POLICY "Property owners can manage their properties" ON public.properties
  FOR ALL
  USING (
    has_role(auth.uid(), 'Admin'::app_role) OR
    owner_id = auth.uid() OR 
    manager_id = auth.uid()
  );

-- 6. Add comments explaining the security approach
COMMENT ON POLICY "Tenants can view own record" ON public.tenants IS 
'Security: Direct user_id check prevents infinite recursion while ensuring tenants only see their own data';

COMMENT ON POLICY "Tenants can view own leases" ON public.leases IS 
'Security: Uses EXISTS subquery to check tenant ownership without complex joins that cause recursion';

COMMENT ON FUNCTION public.user_owns_property(UUID, UUID) IS 
'Security: Security definer function to safely check property ownership without causing RLS recursion';


-- Migration: 20250814110249_17f1d105-2ce9-4040-b4ba-ba002005a3fd.sql

-- Fix infinite recursion by completely rebuilding RLS policies

-- 1. Drop ALL existing policies for problematic tables
DROP POLICY IF EXISTS "Tenants can view own record" ON public.tenants;
DROP POLICY IF EXISTS "Tenants can update own record" ON public.tenants;
DROP POLICY IF EXISTS "Property stakeholders can manage tenants" ON public.tenants;
DROP POLICY IF EXISTS "Admins can manage all tenants" ON public.tenants;

DROP POLICY IF EXISTS "Property owners can manage their leases" ON public.leases;
DROP POLICY IF EXISTS "Tenants can view their own leases" ON public.leases;
DROP POLICY IF EXISTS "Tenants can view own leases" ON public.leases;
DROP POLICY IF EXISTS "Property stakeholders can manage leases" ON public.leases;

DROP POLICY IF EXISTS "Property stakeholders can manage units" ON public.units;
DROP POLICY IF EXISTS "Property owners can manage their properties" ON public.properties;

-- 2. Create a security definer function to safely check property ownership
CREATE OR REPLACE FUNCTION public.user_owns_property(_property_id UUID, _user_id UUID)
RETURNS BOOLEAN
LANGUAGE SQL
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.properties p
    WHERE p.id = _property_id 
      AND (p.owner_id = _user_id OR p.manager_id = _user_id)
  );
$$;

-- 3. Create simple, non-recursive policies for tenants table
CREATE POLICY "Tenants can view own record" ON public.tenants
  FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Tenants can update own record" ON public.tenants
  FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Admins can manage all tenants" ON public.tenants
  FOR ALL
  USING (has_role(auth.uid(), 'Admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'Admin'::app_role));

-- 4. Create simple policies for leases table that avoid recursion
CREATE POLICY "Tenants can view own leases" ON public.leases
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.tenants t
      WHERE t.id = leases.tenant_id 
        AND t.user_id = auth.uid()
    )
  );

CREATE POLICY "Admins can manage all leases" ON public.leases
  FOR ALL
  USING (has_role(auth.uid(), 'Admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'Admin'::app_role));

-- 5. Simplified property and unit policies
CREATE POLICY "Property owners can manage their properties" ON public.properties
  FOR ALL
  USING (
    has_role(auth.uid(), 'Admin'::app_role) OR
    owner_id = auth.uid() OR 
    manager_id = auth.uid()
  );

CREATE POLICY "Property stakeholders can manage units" ON public.units
  FOR ALL
  USING (
    has_role(auth.uid(), 'Admin'::app_role) OR
    public.user_owns_property(units.property_id, auth.uid())
  );


-- Migration: 20250814110317_97a7360f-c256-41eb-94d1-86deaf8a705b.sql

-- Fix infinite recursion by completely rebuilding RLS policies

-- 1. Drop ALL existing policies for problematic tables
DROP POLICY IF EXISTS "Tenants can view own record" ON public.tenants;
DROP POLICY IF EXISTS "Tenants can update own record" ON public.tenants;
DROP POLICY IF EXISTS "Property stakeholders can manage tenants" ON public.tenants;
DROP POLICY IF EXISTS "Admins can manage all tenants" ON public.tenants;

DROP POLICY IF EXISTS "Property owners can manage their leases" ON public.leases;
DROP POLICY IF EXISTS "Tenants can view their own leases" ON public.leases;
DROP POLICY IF EXISTS "Tenants can view own leases" ON public.leases;
DROP POLICY IF EXISTS "Property stakeholders can manage leases" ON public.leases;

DROP POLICY IF EXISTS "Property stakeholders can manage units" ON public.units;
DROP POLICY IF EXISTS "Property owners can manage their properties" ON public.properties;

-- 2. Create a security definer function to safely check property ownership
CREATE OR REPLACE FUNCTION public.user_owns_property(_property_id UUID, _user_id UUID)
RETURNS BOOLEAN
LANGUAGE SQL
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.properties p
    WHERE p.id = _property_id 
      AND (p.owner_id = _user_id OR p.manager_id = _user_id)
  );
$$;

-- 3. Create simple, non-recursive policies for tenants table
CREATE POLICY "Tenants can view own record" ON public.tenants
  FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Tenants can update own record" ON public.tenants
  FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Admins can manage all tenants" ON public.tenants
  FOR ALL
  USING (has_role(auth.uid(), 'Admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'Admin'::app_role));

-- 4. Create simple policies for leases table that avoid recursion
CREATE POLICY "Tenants can view own leases" ON public.leases
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.tenants t
      WHERE t.id = leases.tenant_id 
        AND t.user_id = auth.uid()
    )
  );

CREATE POLICY "Admins can manage all leases" ON public.leases
  FOR ALL
  USING (has_role(auth.uid(), 'Admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'Admin'::app_role));

-- 5. Simplified property and unit policies
CREATE POLICY "Property owners can manage their properties" ON public.properties
  FOR ALL
  USING (
    has_role(auth.uid(), 'Admin'::app_role) OR
    owner_id = auth.uid() OR 
    manager_id = auth.uid()
  );

CREATE POLICY "Property stakeholders can manage units" ON public.units
  FOR ALL
  USING (
    has_role(auth.uid(), 'Admin'::app_role) OR
    public.user_owns_property(units.property_id, auth.uid())
  );


-- Migration: 20250814110344_d180446b-691f-42ab-a900-fb0f18178cf5.sql

-- Temporarily disable RLS to clean up policies completely

-- Disable RLS temporarily to allow policy cleanup
ALTER TABLE public.tenants DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.leases DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.units DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.properties DISABLE ROW LEVEL SECURITY;

-- Clean up ALL policies without RLS interference
DROP POLICY IF EXISTS "Tenants can view own record" ON public.tenants;
DROP POLICY IF EXISTS "Tenants can update own record" ON public.tenants;
DROP POLICY IF EXISTS "Property stakeholders can manage tenants" ON public.tenants;
DROP POLICY IF EXISTS "Admins can manage all tenants" ON public.tenants;

DROP POLICY IF EXISTS "Property owners can manage their leases" ON public.leases;
DROP POLICY IF EXISTS "Tenants can view their own leases" ON public.leases;
DROP POLICY IF EXISTS "Tenants can view own leases" ON public.leases;
DROP POLICY IF EXISTS "Property stakeholders can manage leases" ON public.leases;
DROP POLICY IF EXISTS "Admins can manage all leases" ON public.leases;

DROP POLICY IF EXISTS "Property stakeholders can manage units" ON public.units;
DROP POLICY IF EXISTS "Property owners can manage their properties" ON public.properties;

-- Re-enable RLS
ALTER TABLE public.tenants ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.leases ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.units ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.properties ENABLE ROW LEVEL SECURITY;

-- Create security definer function for property ownership checks
CREATE OR REPLACE FUNCTION public.user_owns_property(_property_id UUID, _user_id UUID)
RETURNS BOOLEAN
LANGUAGE SQL
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.properties p
    WHERE p.id = _property_id 
      AND (p.owner_id = _user_id OR p.manager_id = _user_id)
  );
$$;

-- Create simple, non-recursive policies

-- Tenants table policies
CREATE POLICY "Tenants can view own record" ON public.tenants
  FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Tenants can update own record" ON public.tenants
  FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Admins can manage all tenants" ON public.tenants
  FOR ALL
  USING (has_role(auth.uid(), 'Admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'Admin'::app_role));

-- Leases table policies  
CREATE POLICY "Tenants can view own leases" ON public.leases
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.tenants t
      WHERE t.id = leases.tenant_id 
        AND t.user_id = auth.uid()
    )
  );

CREATE POLICY "Admins can manage all leases" ON public.leases
  FOR ALL
  USING (has_role(auth.uid(), 'Admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'Admin'::app_role));

-- Properties table policies
CREATE POLICY "Property owners can manage their properties" ON public.properties
  FOR ALL
  USING (
    has_role(auth.uid(), 'Admin'::app_role) OR
    owner_id = auth.uid() OR 
    manager_id = auth.uid()
  );

-- Units table policies
CREATE POLICY "Property stakeholders can manage units" ON public.units
  FOR ALL
  USING (
    has_role(auth.uid(), 'Admin'::app_role) OR
    public.user_owns_property(units.property_id, auth.uid())
  );


-- Migration: 20250814110402_f6fa7a27-88ad-4732-a5e1-4803e97a4dcd.sql

-- Temporarily disable RLS to clean up policies completely

-- Disable RLS temporarily to allow policy cleanup
ALTER TABLE public.tenants DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.leases DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.units DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.properties DISABLE ROW LEVEL SECURITY;

-- Clean up ALL policies without RLS interference
DROP POLICY IF EXISTS "Tenants can view own record" ON public.tenants;
DROP POLICY IF EXISTS "Tenants can update own record" ON public.tenants;
DROP POLICY IF EXISTS "Property stakeholders can manage tenants" ON public.tenants;
DROP POLICY IF EXISTS "Admins can manage all tenants" ON public.tenants;

DROP POLICY IF EXISTS "Property owners can manage their leases" ON public.leases;
DROP POLICY IF EXISTS "Tenants can view their own leases" ON public.leases;
DROP POLICY IF EXISTS "Tenants can view own leases" ON public.leases;
DROP POLICY IF EXISTS "Property stakeholders can manage leases" ON public.leases;
DROP POLICY IF EXISTS "Admins can manage all leases" ON public.leases;

DROP POLICY IF EXISTS "Property stakeholders can manage units" ON public.units;
DROP POLICY IF EXISTS "Property owners can manage their properties" ON public.properties;

-- Re-enable RLS
ALTER TABLE public.tenants ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.leases ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.units ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.properties ENABLE ROW LEVEL SECURITY;

-- Create security definer function for property ownership checks
CREATE OR REPLACE FUNCTION public.user_owns_property(_property_id UUID, _user_id UUID)
RETURNS BOOLEAN
LANGUAGE SQL
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.properties p
    WHERE p.id = _property_id 
      AND (p.owner_id = _user_id OR p.manager_id = _user_id)
  );
$$;

-- Create simple, non-recursive policies

-- Tenants table policies
CREATE POLICY "Tenants can view own record" ON public.tenants
  FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Tenants can update own record" ON public.tenants
  FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Admins can manage all tenants" ON public.tenants
  FOR ALL
  USING (has_role(auth.uid(), 'Admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'Admin'::app_role));

-- Leases table policies  
CREATE POLICY "Tenants can view own leases" ON public.leases
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.tenants t
      WHERE t.id = leases.tenant_id 
        AND t.user_id = auth.uid()
    )
  );

CREATE POLICY "Admins can manage all leases" ON public.leases
  FOR ALL
  USING (has_role(auth.uid(), 'Admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'Admin'::app_role));

-- Properties table policies
CREATE POLICY "Property owners can manage their properties" ON public.properties
  FOR ALL
  USING (
    has_role(auth.uid(), 'Admin'::app_role) OR
    owner_id = auth.uid() OR 
    manager_id = auth.uid()
  );

-- Units table policies
CREATE POLICY "Property stakeholders can manage units" ON public.units
  FOR ALL
  USING (
    has_role(auth.uid(), 'Admin'::app_role) OR
    public.user_owns_property(units.property_id, auth.uid())
  );


-- Migration: 20250814110904_67578ad0-e40d-4421-a73f-95c49dcb6639.sql

-- Continue security fixes for remaining database functions

-- Update update_service_invoice_updated_at function
CREATE OR REPLACE FUNCTION public.update_service_invoice_updated_at()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $function$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$function$;

-- Update set_announcement_creator function  
CREATE OR REPLACE FUNCTION public.set_announcement_creator()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $function$
BEGIN
  -- Set created_by to the authenticated user
  NEW.created_by := auth.uid();
  RETURN NEW;
END;
$function$;


-- Migration: 20250814110933_af74c5ee-2951-4cfe-9ce4-512cb31595a9.sql

-- Security Fix: Add search_path protection to database functions
-- This prevents SQL injection attacks through search_path manipulation

-- Update create_payment_notification function
CREATE OR REPLACE FUNCTION public.create_payment_notification()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $function$
DECLARE
  tenant_user_id UUID;
  notification_title TEXT;
  notification_message TEXT;
BEGIN
  -- Get the tenant's user_id
  SELECT t.user_id INTO tenant_user_id
  FROM public.tenants t
  WHERE t.id = NEW.tenant_id;
  
  -- Only create notification if tenant has a user account
  IF tenant_user_id IS NOT NULL THEN
    -- Set notification content based on payment status
    IF NEW.status = 'completed' THEN
      notification_title := 'Payment Received';
      notification_message := 'Your payment of ' || NEW.amount || ' has been successfully processed.';
    ELSIF NEW.status = 'pending' THEN
      notification_title := 'Payment Pending';
      notification_message := 'Your payment of ' || NEW.amount || ' is being processed.';
    ELSIF NEW.status = 'failed' THEN
      notification_title := 'Payment Failed';
      notification_message := 'Your payment of ' || NEW.amount || ' could not be processed. Please try again.';
    ELSE
      notification_title := 'Payment Status Update';
      notification_message := 'Your payment status has been updated to ' || NEW.status || '.';
    END IF;
    
    -- Insert notification
    INSERT INTO public.notifications (
      user_id, title, message, type, related_id, related_type
    ) VALUES (
      tenant_user_id, 
      notification_title, 
      notification_message, 
      'payment', 
      NEW.id::text, 
      'payment'
    );
  END IF;
  
  RETURN NEW;
END;
$function$;

-- Update generate_invoice_number function
CREATE OR REPLACE FUNCTION public.generate_invoice_number()
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $function$
DECLARE
    next_id bigint;
    invoice_number text;
BEGIN
    -- Get the next sequence value
    SELECT nextval('public.invoice_number_seq') INTO next_id;
    
    -- Generate invoice number with proper formatting
    invoice_number := 'INV-' || TO_CHAR(EXTRACT(YEAR FROM CURRENT_DATE), 'YYYY') || '-' || LPAD(next_id::text, 6, '0');
    
    RETURN invoice_number;
END;
$function$;

-- Update update_trial_updated_at function
CREATE OR REPLACE FUNCTION public.update_trial_updated_at()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $function$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$function$;

-- Update create_maintenance_notification function
CREATE OR REPLACE FUNCTION public.create_maintenance_notification()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $function$
DECLARE
  tenant_user_id UUID;
  notification_title TEXT;
  notification_message TEXT;
BEGIN
  -- Get the tenant's user_id
  SELECT t.user_id INTO tenant_user_id
  FROM public.tenants t
  WHERE t.id = NEW.tenant_id;
  
  -- Only create notification if tenant has a user account and status changed
  IF tenant_user_id IS NOT NULL AND (TG_OP = 'INSERT' OR OLD.status != NEW.status) THEN
    notification_title := 'Maintenance Request Update';
    
    IF TG_OP = 'INSERT' THEN
      notification_message := 'Your maintenance request "' || NEW.title || '" has been received and is being reviewed.';
    ELSE
      notification_message := 'Your maintenance request "' || NEW.title || '" status has been updated to ' || NEW.status || '.';
    END IF;
    
    -- Insert notification
    INSERT INTO public.notifications (
      user_id, title, message, type, related_id, related_type
    ) VALUES (
      tenant_user_id, 
      notification_title, 
      notification_message, 
      'maintenance', 
      NEW.id::text, 
      'maintenance_request'
    );
  END IF;
  
  RETURN NEW;
END;
$function$;

-- Update create_lease_expiration_notification function
CREATE OR REPLACE FUNCTION public.create_lease_expiration_notification()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $function$
DECLARE
  tenant_user_id UUID;
  days_until_expiry INTEGER;
  notification_title TEXT;
  notification_message TEXT;
BEGIN
  -- Get the tenant's user_id
  SELECT t.user_id INTO tenant_user_id
  FROM public.tenants t
  WHERE t.id = NEW.tenant_id;
  
  -- Calculate days until lease expiry
  days_until_expiry := NEW.lease_end_date - CURRENT_DATE;
  
  -- Only create notification if tenant has a user account and lease is expiring soon
  IF tenant_user_id IS NOT NULL AND days_until_expiry <= 30 AND days_until_expiry > 0 THEN
    IF days_until_expiry <= 7 THEN
      notification_title := 'Lease Expiring Soon';
      notification_message := 'Your lease expires in ' || days_until_expiry || ' days. Please contact your landlord to discuss renewal.';
    ELSIF days_until_expiry <= 30 THEN
      notification_title := 'Lease Renewal Reminder';
      notification_message := 'Your lease expires in ' || days_until_expiry || ' days. Consider discussing renewal options with your landlord.';
    END IF;
    
    -- Insert notification
    INSERT INTO public.notifications (
      user_id, title, message, type, related_id, related_type
    ) VALUES (
      tenant_user_id, 
      notification_title, 
      notification_message, 
      'lease', 
      NEW.id::text, 
      'lease'
    );
  END IF;
  
  RETURN NEW;
END;
$function$;

-- Update create_invoice_notification function
CREATE OR REPLACE FUNCTION public.create_invoice_notification()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $function$
DECLARE
  tenant_user_id UUID;
  notification_title TEXT;
  notification_message TEXT;
BEGIN
  -- Get the tenant's user_id
  SELECT t.user_id INTO tenant_user_id
  FROM public.tenants t
  WHERE t.id = NEW.tenant_id;
  
  -- Only create notification if tenant has a user account
  IF tenant_user_id IS NOT NULL THEN
    IF TG_OP = 'INSERT' THEN
      notification_title := 'New Invoice';
      notification_message := 'A new invoice #' || NEW.invoice_number || ' for ' || NEW.amount || ' has been generated.';
    ELSIF OLD.status != NEW.status THEN
      notification_title := 'Invoice Status Update';
      notification_message := 'Invoice #' || NEW.invoice_number || ' status has been updated to ' || NEW.status || '.';
    ELSE
      RETURN NEW; -- No notification needed
    END IF;
    
    -- Insert notification
    INSERT INTO public.notifications (
      user_id, title, message, type, related_id, related_type
    ) VALUES (
      tenant_user_id, 
      notification_title, 
      notification_message, 
      'payment', 
      NEW.id::text, 
      'invoice'
    );
  END IF;
  
  RETURN NEW;
END;
$function$;


-- Migration: 20250814110950_6357eee8-a970-4af8-8b2e-4f7608ba5d4b.sql

-- Fix remaining database functions that don't have SET search_path = '' protection

-- Update check_email_uniqueness function
CREATE OR REPLACE FUNCTION public.check_email_uniqueness()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $function$
BEGIN
    -- Check if email already exists for a different user
    IF EXISTS (
        SELECT 1 FROM public.profiles 
        WHERE email = NEW.email 
        AND id != NEW.id
    ) THEN
        RAISE EXCEPTION 'Email address % already exists for another user', NEW.email;
    END IF;
    
    RETURN NEW;
END;
$function$;

-- Update log_role_change function
CREATE OR REPLACE FUNCTION public.log_role_change()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $function$
BEGIN
    -- Log role insertions (new roles)
    IF TG_OP = 'INSERT' THEN
        INSERT INTO public.role_change_logs (
            user_id, old_role, new_role, changed_by, reason, metadata
        ) VALUES (
            NEW.user_id, 
            NULL, 
            NEW.role, 
            COALESCE(auth.uid(), NEW.user_id),
            'Role assigned',
            jsonb_build_object(
                'operation', 'INSERT',
                'table', 'user_roles',
                'timestamp', now()
            )
        );
        RETURN NEW;
    END IF;
    
    -- Log role updates (role changes)
    IF TG_OP = 'UPDATE' THEN
        IF OLD.role != NEW.role THEN
            INSERT INTO public.role_change_logs (
                user_id, old_role, new_role, changed_by, reason, metadata
            ) VALUES (
                NEW.user_id, 
                OLD.role, 
                NEW.role, 
                COALESCE(auth.uid(), NEW.user_id),
                'Role updated',
                jsonb_build_object(
                    'operation', 'UPDATE',
                    'table', 'user_roles',
                    'old_value', OLD.role,
                    'new_value', NEW.role,
                    'timestamp', now()
                )
            );
        END IF;
        RETURN NEW;
    END IF;
    
    -- Log role deletions (role removal)
    IF TG_OP = 'DELETE' THEN
        INSERT INTO public.role_change_logs (
            user_id, old_role, new_role, changed_by, reason, metadata
        ) VALUES (
            OLD.user_id, 
            OLD.role, 
            NULL, 
            COALESCE(auth.uid(), OLD.user_id),
            'Role removed',
            jsonb_build_object(
                'operation', 'DELETE',
                'table', 'user_roles',
                'timestamp', now()
            )
        );
        RETURN OLD;
    END IF;
    
    RETURN NULL;
END;
$function$;


-- Migration: 20250814111017_f1d97186-e42a-475f-8e87-939ba8876295.sql

-- Continue security hardening for remaining database functions

-- Update update_service_invoice_updated_at function
CREATE OR REPLACE FUNCTION public.update_service_invoice_updated_at()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $function$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$function$;

-- Update set_announcement_creator function
CREATE OR REPLACE FUNCTION public.set_announcement_creator()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $function$
BEGIN
  -- Set created_by to the authenticated user
  NEW.created_by := auth.uid();
  RETURN NEW;
END;
$function$;


-- Migration: 20250814111042_f3e05357-cbc6-4864-a40a-bef785c1f888.sql

-- Fix remaining functions without SET search_path
-- This includes some critical functions that need hardening

-- Fix check_email_uniqueness function
CREATE OR REPLACE FUNCTION public.check_email_uniqueness()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $function$
BEGIN
    -- Check if email already exists for a different user
    IF EXISTS (
        SELECT 1 FROM public.profiles 
        WHERE email = NEW.email 
        AND id != NEW.id
    ) THEN
        RAISE EXCEPTION 'Email address % already exists for another user', NEW.email;
    END IF;
    
    RETURN NEW;
END;
$function$;

-- Fix log_role_change function
CREATE OR REPLACE FUNCTION public.log_role_change()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $function$
BEGIN
    -- Log role insertions (new roles)
    IF TG_OP = 'INSERT' THEN
        INSERT INTO public.role_change_logs (
            user_id, old_role, new_role, changed_by, reason, metadata
        ) VALUES (
            NEW.user_id, 
            NULL, 
            NEW.role, 
            COALESCE(auth.uid(), NEW.user_id),
            'Role assigned',
            jsonb_build_object(
                'operation', 'INSERT',
                'table', 'user_roles',
                'timestamp', now()
            )
        );
        RETURN NEW;
    END IF;
    
    -- Log role updates (role changes)
    IF TG_OP = 'UPDATE' THEN
        IF OLD.role != NEW.role THEN
            INSERT INTO public.role_change_logs (
                user_id, old_role, new_role, changed_by, reason, metadata
            ) VALUES (
                NEW.user_id, 
                OLD.role, 
                NEW.role, 
                COALESCE(auth.uid(), NEW.user_id),
                'Role updated',
                jsonb_build_object(
                    'operation', 'UPDATE',
                    'table', 'user_roles',
                    'old_value', OLD.role,
                    'new_value', NEW.role,
                    'timestamp', now()
                )
            );
        END IF;
        RETURN NEW;
    END IF;
    
    -- Log role deletions (role removal)
    IF TG_OP = 'DELETE' THEN
        INSERT INTO public.role_change_logs (
            user_id, old_role, new_role, changed_by, reason, metadata
        ) VALUES (
            OLD.user_id, 
            OLD.role, 
            NULL, 
            COALESCE(auth.uid(), OLD.user_id),
            'Role removed',
            jsonb_build_object(
                'operation', 'DELETE',
                'table', 'user_roles',
                'timestamp', now()
            )
        );
        RETURN OLD;
    END IF;
    
    RETURN NULL;
END;
$function$;


-- Migration: 20250814111108_d70efdc2-5e6b-41df-9969-dcd77151af69.sql

-- Fix final database function that needs security update
CREATE OR REPLACE FUNCTION public.generate_service_invoice_number()
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $function$
BEGIN
    RETURN public.generate_invoice_number();
END;
$function$;


-- Migration: 20250814111146_606fd066-2340-4880-a781-b34804e84e10.sql

-- Fix the remaining function that needs proper search_path
CREATE OR REPLACE FUNCTION public.create_default_landlord_subscription()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $function$
DECLARE
  trial_plan_id uuid;
  trial_days integer := 14;
  sms_default integer := 100;
  grace_days integer := 7;
BEGIN
  IF NEW.role = 'Landlord'::public.app_role THEN
    -- Read trial days from settings: prefer trial_settings, else trial_period_days, else 14
    SELECT COALESCE(
      (SELECT (setting_value->>'trial_period_days')::int FROM public.billing_settings WHERE setting_key = 'trial_settings' LIMIT 1),
      (SELECT (setting_value)::int FROM public.billing_settings WHERE setting_key = 'trial_period_days' LIMIT 1),
      14
    ) INTO trial_days;

    -- Read default SMS credits: prefer trial_settings, else default_sms_credits, else 100
    SELECT COALESCE(
      (SELECT (setting_value->>'default_sms_credits')::int FROM public.billing_settings WHERE setting_key = 'trial_settings' LIMIT 1),
      (SELECT (setting_value)::int FROM public.billing_settings WHERE setting_key = 'default_sms_credits' LIMIT 1),
      100
    ) INTO sms_default;

    -- Read grace period days: prefer trial_settings, else automated_billing_settings, else 7
    SELECT COALESCE(
      (SELECT (setting_value->>'grace_period_days')::int FROM public.billing_settings WHERE setting_key = 'trial_settings' LIMIT 1),
      (SELECT grace_period_days FROM public.automated_billing_settings LIMIT 1),
      7
    ) INTO grace_days;

    -- Prefer "Free Trial" plan; fallback to any active plan by lowest price
    SELECT id INTO trial_plan_id
    FROM public.billing_plans
    WHERE name = 'Free Trial' AND is_active = true
    LIMIT 1;

    IF trial_plan_id IS NULL THEN
      SELECT id INTO trial_plan_id
      FROM public.billing_plans
      WHERE is_active = true
      ORDER BY price ASC, created_at ASC
      LIMIT 1;
    END IF;

    IF trial_plan_id IS NOT NULL THEN
      INSERT INTO public.landlord_subscriptions (
        landlord_id,
        billing_plan_id,
        status,
        trial_start_date,
        trial_end_date,
        subscription_start_date,
        sms_credits_balance,
        auto_renewal,
        grace_period_days
      )
      VALUES (
        NEW.user_id,
        trial_plan_id,
        'trial',
        now(),
        now() + make_interval(days => trial_days),
        now(),
        sms_default,
        true,
        grace_days
      )
      ON CONFLICT (landlord_id) DO NOTHING;
    END IF;
  END IF;

  RETURN NEW;
END;
$function$;

-- Also fix generate_service_invoice_number to add proper security
CREATE OR REPLACE FUNCTION public.generate_service_invoice_number()
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $function$
BEGIN
    RETURN public.generate_invoice_number();
END;
$function$;


-- Migration: 20250814111655_5f7c89e2-8a75-4a58-8564-12760c513054.sql

-- Fix critical privilege escalation vulnerability in user_roles table
-- Remove the overly permissive policy that allows Landlords to manage all roles

DROP POLICY IF EXISTS "Landlords can manage user roles" ON public.user_roles;

-- Create secure role management functions
CREATE OR REPLACE FUNCTION public.can_assign_role(_assigner_id uuid, _target_role app_role)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $$
BEGIN
  -- Only Admins can assign Admin roles
  IF _target_role = 'Admin' THEN
    RETURN public.has_role(_assigner_id, 'Admin');
  END IF;
  
  -- Admins can assign any role
  IF public.has_role(_assigner_id, 'Admin') THEN
    RETURN true;
  END IF;
  
  -- Landlords can only assign non-admin roles
  IF public.has_role(_assigner_id, 'Landlord') THEN
    RETURN _target_role IN ('Manager', 'Agent', 'Tenant');
  END IF;
  
  -- No one else can assign roles
  RETURN false;
END;
$$;

CREATE OR REPLACE FUNCTION public.can_remove_role(_remover_id uuid, _target_user_id uuid, _target_role app_role)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $$
BEGIN
  -- Cannot remove your own Admin role (prevents lockout)
  IF _remover_id = _target_user_id AND _target_role = 'Admin' THEN
    RETURN false;
  END IF;
  
  -- Only Admins can remove Admin roles
  IF _target_role = 'Admin' THEN
    RETURN public.has_role(_remover_id, 'Admin');
  END IF;
  
  -- Admins can remove any non-self-admin role
  IF public.has_role(_remover_id, 'Admin') THEN
    RETURN true;
  END IF;
  
  -- Landlords can only remove non-admin roles within their properties
  IF public.has_role(_remover_id, 'Landlord') THEN
    RETURN _target_role IN ('Manager', 'Agent', 'Tenant') AND
           EXISTS (
             SELECT 1 FROM public.properties p 
             WHERE p.owner_id = _remover_id AND 
                   (p.manager_id = _target_user_id OR 
                    EXISTS (SELECT 1 FROM public.units u 
                           JOIN public.leases l ON u.id = l.unit_id 
                           JOIN public.tenants t ON l.tenant_id = t.id 
                           WHERE u.property_id = p.id AND t.user_id = _target_user_id))
           );
  END IF;
  
  RETURN false;
END;
$$;

-- Create new secure RLS policies for user_roles
CREATE POLICY "Admins can view all user roles" 
ON public.user_roles 
FOR SELECT 
USING (public.has_role(auth.uid(), 'Admin'));

CREATE POLICY "Users can view their own roles" 
ON public.user_roles 
FOR SELECT 
USING (user_id = auth.uid());

CREATE POLICY "Landlords can view roles within their properties" 
ON public.user_roles 
FOR SELECT 
USING (
  public.has_role(auth.uid(), 'Landlord') AND
  (role IN ('Manager', 'Agent', 'Tenant') AND
   EXISTS (
     SELECT 1 FROM public.properties p 
     WHERE p.owner_id = auth.uid() AND 
           (p.manager_id = user_id OR 
            EXISTS (SELECT 1 FROM public.units u 
                   JOIN public.leases l ON u.id = l.unit_id 
                   JOIN public.tenants t ON l.tenant_id = t.id 
                   WHERE u.property_id = p.id AND t.user_id = user_id))
   ))
);

CREATE POLICY "Secure role assignment" 
ON public.user_roles 
FOR INSERT 
WITH CHECK (
  public.can_assign_role(auth.uid(), role) AND
  -- Prevent self-privilege escalation except for Admins
  (auth.uid() != user_id OR public.has_role(auth.uid(), 'Admin'))
);

CREATE POLICY "Secure role removal" 
ON public.user_roles 
FOR DELETE 
USING (public.can_remove_role(auth.uid(), user_id, role));

CREATE POLICY "Secure role updates" 
ON public.user_roles 
FOR UPDATE 
USING (
  public.can_remove_role(auth.uid(), user_id, role) AND
  public.can_assign_role(auth.uid(), role)
)
WITH CHECK (
  public.can_assign_role(auth.uid(), role) AND
  -- Prevent self-privilege escalation except for Admins
  (auth.uid() != user_id OR public.has_role(auth.uid(), 'Admin'))
);

-- Add role change auditing trigger
CREATE OR REPLACE FUNCTION public.audit_role_changes()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $$
BEGIN
  -- Log role changes for security monitoring
  IF TG_OP = 'INSERT' THEN
    PERFORM public.log_user_audit(
      NEW.user_id, 
      'role_assigned', 
      'user_role', 
      NEW.id::uuid,
      jsonb_build_object(
        'role', NEW.role,
        'assigned_by', auth.uid(),
        'operation', 'INSERT'
      ),
      auth.uid()
    );
    RETURN NEW;
  END IF;
  
  IF TG_OP = 'UPDATE' THEN
    PERFORM public.log_user_audit(
      NEW.user_id, 
      'role_updated', 
      'user_role', 
      NEW.id::uuid,
      jsonb_build_object(
        'old_role', OLD.role,
        'new_role', NEW.role,
        'updated_by', auth.uid(),
        'operation', 'UPDATE'
      ),
      auth.uid()
    );
    RETURN NEW;
  END IF;
  
  IF TG_OP = 'DELETE' THEN
    PERFORM public.log_user_audit(
      OLD.user_id, 
      'role_removed', 
      'user_role', 
      OLD.id::uuid,
      jsonb_build_object(
        'role', OLD.role,
        'removed_by', auth.uid(),
        'operation', 'DELETE'
      ),
      auth.uid()
    );
    RETURN OLD;
  END IF;
  
  RETURN NULL;
END;
$$;

-- Create the audit trigger
DROP TRIGGER IF EXISTS audit_role_changes_trigger ON public.user_roles;
CREATE TRIGGER audit_role_changes_trigger
  AFTER INSERT OR UPDATE OR DELETE ON public.user_roles
  FOR EACH ROW EXECUTE FUNCTION public.audit_role_changes();

-- Add constraint to prevent multiple admin roles for the same user (optional defense)
CREATE UNIQUE INDEX IF NOT EXISTS unique_admin_per_user 
ON public.user_roles (user_id) 
WHERE role = 'Admin';

-- Log this security fix


-- Migration: 20250814113232_af180356-634f-4654-87cc-c1fcf1fda5c4.sql

-- Fix critical privilege escalation vulnerability in user_roles table
-- First, check and remove existing problematic policies

DROP POLICY IF EXISTS "Landlords can manage user roles" ON public.user_roles;
DROP POLICY IF EXISTS "Users can view their own roles" ON public.user_roles;
DROP POLICY IF EXISTS "Admins can view all user roles" ON public.user_roles;
DROP POLICY IF EXISTS "Landlords can view roles within their properties" ON public.user_roles;
DROP POLICY IF EXISTS "Secure role assignment" ON public.user_roles;
DROP POLICY IF EXISTS "Secure role removal" ON public.user_roles;
DROP POLICY IF EXISTS "Secure role updates" ON public.user_roles;

-- Create secure role management functions
CREATE OR REPLACE FUNCTION public.can_assign_role(_assigner_id uuid, _target_role app_role)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $$
BEGIN
  -- Only Admins can assign Admin roles
  IF _target_role = 'Admin' THEN
    RETURN public.has_role(_assigner_id, 'Admin');
  END IF;
  
  -- Admins can assign any role
  IF public.has_role(_assigner_id, 'Admin') THEN
    RETURN true;
  END IF;
  
  -- Landlords can only assign non-admin roles within their organization
  IF public.has_role(_assigner_id, 'Landlord') THEN
    RETURN _target_role IN ('Manager', 'Agent', 'Tenant');
  END IF;
  
  -- No one else can assign roles
  RETURN false;
END;
$$;

CREATE OR REPLACE FUNCTION public.can_remove_role(_remover_id uuid, _target_user_id uuid, _target_role app_role)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $$
BEGIN
  -- Cannot remove your own Admin role (prevents lockout)
  IF _remover_id = _target_user_id AND _target_role = 'Admin' THEN
    RETURN false;
  END IF;
  
  -- Only Admins can remove Admin roles
  IF _target_role = 'Admin' THEN
    RETURN public.has_role(_remover_id, 'Admin');
  END IF;
  
  -- Admins can remove any non-self-admin role
  IF public.has_role(_remover_id, 'Admin') THEN
    RETURN true;
  END IF;
  
  -- Landlords can only remove non-admin roles within their scope
  IF public.has_role(_remover_id, 'Landlord') THEN
    RETURN _target_role IN ('Manager', 'Agent', 'Tenant');
  END IF;
  
  RETURN false;
END;
$$;

-- Create new secure RLS policies for user_roles
CREATE POLICY "Secure: Admins view all roles" 
ON public.user_roles 
FOR SELECT 
USING (public.has_role(auth.uid(), 'Admin'));

CREATE POLICY "Secure: Users view own roles" 
ON public.user_roles 
FOR SELECT 
USING (user_id = auth.uid());

CREATE POLICY "Secure: Role assignment control" 
ON public.user_roles 
FOR INSERT 
WITH CHECK (
  public.can_assign_role(auth.uid(), role) AND
  -- Prevent self-privilege escalation except for Admins
  (auth.uid() != user_id OR public.has_role(auth.uid(), 'Admin'))
);

CREATE POLICY "Secure: Role removal control" 
ON public.user_roles 
FOR DELETE 
USING (public.can_remove_role(auth.uid(), user_id, role));

CREATE POLICY "Secure: Role update control" 
ON public.user_roles 
FOR UPDATE 
USING (
  public.can_remove_role(auth.uid(), user_id, role) AND
  public.can_assign_role(auth.uid(), role)
)
WITH CHECK (
  public.can_assign_role(auth.uid(), role) AND
  -- Prevent self-privilege escalation except for Admins
  (auth.uid() != user_id OR public.has_role(auth.uid(), 'Admin'))
);

-- Add role change auditing trigger
CREATE OR REPLACE FUNCTION public.audit_role_changes()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $$
BEGIN
  -- Log role changes for security monitoring
  IF TG_OP = 'INSERT' THEN
    PERFORM public.log_user_audit(
      NEW.user_id, 
      'role_assigned', 
      'user_role', 
      NEW.id::uuid,
      jsonb_build_object(
        'role', NEW.role,
        'assigned_by', auth.uid(),
        'operation', 'INSERT'
      ),
      auth.uid()
    );
    RETURN NEW;
  END IF;
  
  IF TG_OP = 'UPDATE' THEN
    PERFORM public.log_user_audit(
      NEW.user_id, 
      'role_updated', 
      'user_role', 
      NEW.id::uuid,
      jsonb_build_object(
        'old_role', OLD.role,
        'new_role', NEW.role,
        'updated_by', auth.uid(),
        'operation', 'UPDATE'
      ),
      auth.uid()
    );
    RETURN NEW;
  END IF;
  
  IF TG_OP = 'DELETE' THEN
    PERFORM public.log_user_audit(
      OLD.user_id, 
      'role_removed', 
      'user_role', 
      OLD.id::uuid,
      jsonb_build_object(
        'role', OLD.role,
        'removed_by', auth.uid(),
        'operation', 'DELETE'
      ),
      auth.uid()
    );
    RETURN OLD;
  END IF;
  
  RETURN NULL;
END;
$$;

-- Create the audit trigger
DROP TRIGGER IF EXISTS audit_role_changes_trigger ON public.user_roles;
CREATE TRIGGER audit_role_changes_trigger
  AFTER INSERT OR UPDATE OR DELETE ON public.user_roles
  FOR EACH ROW EXECUTE FUNCTION public.audit_role_changes();

-- Add constraint to prevent multiple admin roles for the same user
CREATE UNIQUE INDEX IF NOT EXISTS unique_admin_per_user 
ON public.user_roles (user_id) 
WHERE role = 'Admin';

-- Log this security fix


-- Migration: 20250814113529_d695d12b-7308-4017-89c1-15a1be771f63.sql

-- Fix critical privilege escalation vulnerability in user_roles table
-- First, remove existing problematic policies

DROP POLICY IF EXISTS "Landlords can manage user roles" ON public.user_roles;
DROP POLICY IF EXISTS "Users can view their own roles" ON public.user_roles;
DROP POLICY IF EXISTS "Admins can view all user roles" ON public.user_roles;
DROP POLICY IF EXISTS "Landlords can view roles within their properties" ON public.user_roles;
DROP POLICY IF EXISTS "Secure role assignment" ON public.user_roles;
DROP POLICY IF EXISTS "Secure role removal" ON public.user_roles;
DROP POLICY IF EXISTS "Secure role updates" ON public.user_roles;

-- Create secure role management functions
CREATE OR REPLACE FUNCTION public.can_assign_role(_assigner_id uuid, _target_role app_role)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $$
BEGIN
  -- Only Admins can assign Admin roles
  IF _target_role = 'Admin' THEN
    RETURN public.has_role(_assigner_id, 'Admin');
  END IF;
  
  -- Admins can assign any role
  IF public.has_role(_assigner_id, 'Admin') THEN
    RETURN true;
  END IF;
  
  -- Landlords can only assign non-admin roles within their organization
  IF public.has_role(_assigner_id, 'Landlord') THEN
    RETURN _target_role IN ('Manager', 'Agent', 'Tenant');
  END IF;
  
  -- No one else can assign roles
  RETURN false;
END;
$$;

CREATE OR REPLACE FUNCTION public.can_remove_role(_remover_id uuid, _target_user_id uuid, _target_role app_role)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $$
BEGIN
  -- Cannot remove your own Admin role (prevents lockout)
  IF _remover_id = _target_user_id AND _target_role = 'Admin' THEN
    RETURN false;
  END IF;
  
  -- Only Admins can remove Admin roles
  IF _target_role = 'Admin' THEN
    RETURN public.has_role(_remover_id, 'Admin');
  END IF;
  
  -- Admins can remove any non-self-admin role
  IF public.has_role(_remover_id, 'Admin') THEN
    RETURN true;
  END IF;
  
  -- Landlords can only remove non-admin roles within their scope
  IF public.has_role(_remover_id, 'Landlord') THEN
    RETURN _target_role IN ('Manager', 'Agent', 'Tenant');
  END IF;
  
  RETURN false;
END;
$$;

-- Create new secure RLS policies for user_roles
CREATE POLICY "Secure: Admins view all roles" 
ON public.user_roles 
FOR SELECT 
USING (public.has_role(auth.uid(), 'Admin'));

CREATE POLICY "Secure: Users view own roles" 
ON public.user_roles 
FOR SELECT 
USING (user_id = auth.uid());

CREATE POLICY "Secure: Role assignment control" 
ON public.user_roles 
FOR INSERT 
WITH CHECK (
  public.can_assign_role(auth.uid(), role) AND
  -- Prevent self-privilege escalation except for Admins
  (auth.uid() != user_id OR public.has_role(auth.uid(), 'Admin'))
);

CREATE POLICY "Secure: Role removal control" 
ON public.user_roles 
FOR DELETE 
USING (public.can_remove_role(auth.uid(), user_id, role));

CREATE POLICY "Secure: Role update control" 
ON public.user_roles 
FOR UPDATE 
USING (
  public.can_remove_role(auth.uid(), user_id, role) AND
  public.can_assign_role(auth.uid(), role)
)
WITH CHECK (
  public.can_assign_role(auth.uid(), role) AND
  -- Prevent self-privilege escalation except for Admins
  (auth.uid() != user_id OR public.has_role(auth.uid(), 'Admin'))
);

-- Add role change auditing trigger
CREATE OR REPLACE FUNCTION public.audit_role_changes()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $$
BEGIN
  -- Log role changes for security monitoring
  IF TG_OP = 'INSERT' THEN
    PERFORM public.log_user_audit(
      NEW.user_id, 
      'role_assigned', 
      'user_role', 
      NEW.id::uuid,
      jsonb_build_object(
        'role', NEW.role,
        'assigned_by', auth.uid(),
        'operation', 'INSERT'
      ),
      auth.uid()
    );
    RETURN NEW;
  END IF;
  
  IF TG_OP = 'UPDATE' THEN
    PERFORM public.log_user_audit(
      NEW.user_id, 
      'role_updated', 
      'user_role', 
      NEW.id::uuid,
      jsonb_build_object(
        'old_role', OLD.role,
        'new_role', NEW.role,
        'updated_by', auth.uid(),
        'operation', 'UPDATE'
      ),
      auth.uid()
    );
    RETURN NEW;
  END IF;
  
  IF TG_OP = 'DELETE' THEN
    PERFORM public.log_user_audit(
      OLD.user_id, 
      'role_removed', 
      'user_role', 
      OLD.id::uuid,
      jsonb_build_object(
        'role', OLD.role,
        'removed_by', auth.uid(),
        'operation', 'DELETE'
      ),
      auth.uid()
    );
    RETURN OLD;
  END IF;
  
  RETURN NULL;
END;
$$;

-- Create the audit trigger
DROP TRIGGER IF EXISTS audit_role_changes_trigger ON public.user_roles;
CREATE TRIGGER audit_role_changes_trigger
  AFTER INSERT OR UPDATE OR DELETE ON public.user_roles
  FOR EACH ROW EXECUTE FUNCTION public.audit_role_changes();

-- Add constraint to prevent multiple admin roles for the same user
CREATE UNIQUE INDEX IF NOT EXISTS unique_admin_per_user 
ON public.user_roles (user_id) 
WHERE role = 'Admin';

-- Log this security fix using proper log function
PERFORM public.log_system_event(
  'security', 
  'Fixed critical privilege escalation vulnerability in user roles',
  'database',
  jsonb_build_object(
    'fix_type', 'privilege_escalation',
    'severity', 'critical',
    'description', 'Removed overly permissive RLS policies and added secure role management functions',
    'timestamp', now()
  )
);


-- Migration: 20250814113602_6bb20b8c-f79d-4988-9894-3f5f16937ae2.sql

-- Fix critical privilege escalation vulnerability in user_roles table
-- Remove existing problematic policies

DROP POLICY IF EXISTS "Landlords can manage user roles" ON public.user_roles;
DROP POLICY IF EXISTS "Users can view their own roles" ON public.user_roles;
DROP POLICY IF EXISTS "Admins can view all user roles" ON public.user_roles;
DROP POLICY IF EXISTS "Landlords can view roles within their properties" ON public.user_roles;
DROP POLICY IF EXISTS "Secure role assignment" ON public.user_roles;
DROP POLICY IF EXISTS "Secure role removal" ON public.user_roles;
DROP POLICY IF EXISTS "Secure role updates" ON public.user_roles;

-- Create secure role management functions
CREATE OR REPLACE FUNCTION public.can_assign_role(_assigner_id uuid, _target_role app_role)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $$
BEGIN
  -- Only Admins can assign Admin roles
  IF _target_role = 'Admin' THEN
    RETURN public.has_role(_assigner_id, 'Admin');
  END IF;
  
  -- Admins can assign any role
  IF public.has_role(_assigner_id, 'Admin') THEN
    RETURN true;
  END IF;
  
  -- Landlords can only assign non-admin roles
  IF public.has_role(_assigner_id, 'Landlord') THEN
    RETURN _target_role IN ('Manager', 'Agent', 'Tenant');
  END IF;
  
  -- No one else can assign roles
  RETURN false;
END;
$$;

CREATE OR REPLACE FUNCTION public.can_remove_role(_remover_id uuid, _target_user_id uuid, _target_role app_role)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $$
BEGIN
  -- Cannot remove your own Admin role (prevents lockout)
  IF _remover_id = _target_user_id AND _target_role = 'Admin' THEN
    RETURN false;
  END IF;
  
  -- Only Admins can remove Admin roles
  IF _target_role = 'Admin' THEN
    RETURN public.has_role(_remover_id, 'Admin');
  END IF;
  
  -- Admins can remove any non-self-admin role
  IF public.has_role(_remover_id, 'Admin') THEN
    RETURN true;
  END IF;
  
  -- Landlords can only remove non-admin roles
  IF public.has_role(_remover_id, 'Landlord') THEN
    RETURN _target_role IN ('Manager', 'Agent', 'Tenant');
  END IF;
  
  RETURN false;
END;
$$;

-- Create new secure RLS policies for user_roles
CREATE POLICY "Secure: Admins view all roles" 
ON public.user_roles 
FOR SELECT 
USING (public.has_role(auth.uid(), 'Admin'));

CREATE POLICY "Secure: Users view own roles" 
ON public.user_roles 
FOR SELECT 
USING (user_id = auth.uid());

CREATE POLICY "Secure: Role assignment control" 
ON public.user_roles 
FOR INSERT 
WITH CHECK (
  public.can_assign_role(auth.uid(), role) AND
  -- Prevent self-privilege escalation except for Admins
  (auth.uid() != user_id OR public.has_role(auth.uid(), 'Admin'))
);

CREATE POLICY "Secure: Role removal control" 
ON public.user_roles 
FOR DELETE 
USING (public.can_remove_role(auth.uid(), user_id, role));

CREATE POLICY "Secure: Role update control" 
ON public.user_roles 
FOR UPDATE 
USING (
  public.can_remove_role(auth.uid(), user_id, role) AND
  public.can_assign_role(auth.uid(), role)
)
WITH CHECK (
  public.can_assign_role(auth.uid(), role) AND
  -- Prevent self-privilege escalation except for Admins
  (auth.uid() != user_id OR public.has_role(auth.uid(), 'Admin'))
);

-- Add role change auditing trigger
CREATE OR REPLACE FUNCTION public.audit_role_changes()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $$
BEGIN
  -- Log role changes for security monitoring
  IF TG_OP = 'INSERT' THEN
    PERFORM public.log_user_audit(
      NEW.user_id, 
      'role_assigned', 
      'user_role', 
      NEW.id::uuid,
      jsonb_build_object(
        'role', NEW.role,
        'assigned_by', auth.uid(),
        'operation', 'INSERT'
      ),
      auth.uid()
    );
    RETURN NEW;
  END IF;
  
  IF TG_OP = 'UPDATE' THEN
    PERFORM public.log_user_audit(
      NEW.user_id, 
      'role_updated', 
      'user_role', 
      NEW.id::uuid,
      jsonb_build_object(
        'old_role', OLD.role,
        'new_role', NEW.role,
        'updated_by', auth.uid(),
        'operation', 'UPDATE'
      ),
      auth.uid()
    );
    RETURN NEW;
  END IF;
  
  IF TG_OP = 'DELETE' THEN
    PERFORM public.log_user_audit(
      OLD.user_id, 
      'role_removed', 
      'user_role', 
      OLD.id::uuid,
      jsonb_build_object(
        'role', OLD.role,
        'removed_by', auth.uid(),
        'operation', 'DELETE'
      ),
      auth.uid()
    );
    RETURN OLD;
  END IF;
  
  RETURN NULL;
END;
$$;

-- Create the audit trigger
DROP TRIGGER IF EXISTS audit_role_changes_trigger ON public.user_roles;
CREATE TRIGGER audit_role_changes_trigger
  AFTER INSERT OR UPDATE OR DELETE ON public.user_roles
  FOR EACH ROW EXECUTE FUNCTION public.audit_role_changes();

-- Add constraint to prevent multiple admin roles for the same user
CREATE UNIQUE INDEX IF NOT EXISTS unique_admin_per_user 
ON public.user_roles (user_id) 
WHERE role = 'Admin';


-- Migration: 20250814113741_920079c9-f0fd-423c-9759-222b01d10427.sql

-- Fix critical privilege escalation vulnerability in user_roles table
-- Remove existing problematic policies

DROP POLICY IF EXISTS "Landlords can manage user roles" ON public.user_roles;
DROP POLICY IF EXISTS "Users can view their own roles" ON public.user_roles;
DROP POLICY IF EXISTS "Admins can view all user roles" ON public.user_roles;
DROP POLICY IF EXISTS "Landlords can view roles within their properties" ON public.user_roles;
DROP POLICY IF EXISTS "Secure role assignment" ON public.user_roles;
DROP POLICY IF EXISTS "Secure role removal" ON public.user_roles;
DROP POLICY IF EXISTS "Secure role updates" ON public.user_roles;

-- Create secure role management functions
CREATE OR REPLACE FUNCTION public.can_assign_role(_assigner_id uuid, _target_role app_role)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $$
BEGIN
  -- Only Admins can assign Admin roles
  IF _target_role = 'Admin' THEN
    RETURN public.has_role(_assigner_id, 'Admin');
  END IF;
  
  -- Admins can assign any role
  IF public.has_role(_assigner_id, 'Admin') THEN
    RETURN true;
  END IF;
  
  -- Landlords can only assign non-admin roles
  IF public.has_role(_assigner_id, 'Landlord') THEN
    RETURN _target_role IN ('Manager', 'Agent', 'Tenant');
  END IF;
  
  -- No one else can assign roles
  RETURN false;
END;
$$;

CREATE OR REPLACE FUNCTION public.can_remove_role(_remover_id uuid, _target_user_id uuid, _target_role app_role)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $$
BEGIN
  -- Cannot remove your own Admin role (prevents lockout)
  IF _remover_id = _target_user_id AND _target_role = 'Admin' THEN
    RETURN false;
  END IF;
  
  -- Only Admins can remove Admin roles
  IF _target_role = 'Admin' THEN
    RETURN public.has_role(_remover_id, 'Admin');
  END IF;
  
  -- Admins can remove any non-self-admin role
  IF public.has_role(_remover_id, 'Admin') THEN
    RETURN true;
  END IF;
  
  -- Landlords can only remove non-admin roles
  IF public.has_role(_remover_id, 'Landlord') THEN
    RETURN _target_role IN ('Manager', 'Agent', 'Tenant');
  END IF;
  
  RETURN false;
END;
$$;

-- Create new secure RLS policies for user_roles
CREATE POLICY "Secure: Admins view all roles" 
ON public.user_roles 
FOR SELECT 
USING (public.has_role(auth.uid(), 'Admin'));

CREATE POLICY "Secure: Users view own roles" 
ON public.user_roles 
FOR SELECT 
USING (user_id = auth.uid());

CREATE POLICY "Secure: Role assignment control" 
ON public.user_roles 
FOR INSERT 
WITH CHECK (
  public.can_assign_role(auth.uid(), role) AND
  -- Prevent self-privilege escalation except for Admins
  (auth.uid() != user_id OR public.has_role(auth.uid(), 'Admin'))
);

CREATE POLICY "Secure: Role removal control" 
ON public.user_roles 
FOR DELETE 
USING (public.can_remove_role(auth.uid(), user_id, role));

CREATE POLICY "Secure: Role update control" 
ON public.user_roles 
FOR UPDATE 
USING (
  public.can_remove_role(auth.uid(), user_id, role) AND
  public.can_assign_role(auth.uid(), role)
)
WITH CHECK (
  public.can_assign_role(auth.uid(), role) AND
  -- Prevent self-privilege escalation except for Admins
  (auth.uid() != user_id OR public.has_role(auth.uid(), 'Admin'))
);

-- Add role change auditing trigger
CREATE OR REPLACE FUNCTION public.audit_role_changes()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $$
BEGIN
  -- Log role changes for security monitoring
  IF TG_OP = 'INSERT' THEN
    PERFORM public.log_user_audit(
      NEW.user_id, 
      'role_assigned', 
      'user_role', 
      NEW.id::uuid,
      jsonb_build_object(
        'role', NEW.role,
        'assigned_by', auth.uid(),
        'operation', 'INSERT'
      ),
      auth.uid()
    );
    RETURN NEW;
  END IF;
  
  IF TG_OP = 'UPDATE' THEN
    PERFORM public.log_user_audit(
      NEW.user_id, 
      'role_updated', 
      'user_role', 
      NEW.id::uuid,
      jsonb_build_object(
        'old_role', OLD.role,
        'new_role', NEW.role,
        'updated_by', auth.uid(),
        'operation', 'UPDATE'
      ),
      auth.uid()
    );
    RETURN NEW;
  END IF;
  
  IF TG_OP = 'DELETE' THEN
    PERFORM public.log_user_audit(
      OLD.user_id, 
      'role_removed', 
      'user_role', 
      OLD.id::uuid,
      jsonb_build_object(
        'role', OLD.role,
        'removed_by', auth.uid(),
        'operation', 'DELETE'
      ),
      auth.uid()
    );
    RETURN OLD;
  END IF;
  
  RETURN NULL;
END;
$$;

-- Create the audit trigger
DROP TRIGGER IF EXISTS audit_role_changes_trigger ON public.user_roles;
CREATE TRIGGER audit_role_changes_trigger
  AFTER INSERT OR UPDATE OR DELETE ON public.user_roles
  FOR EACH ROW EXECUTE FUNCTION public.audit_role_changes();

-- Add constraint to prevent multiple admin roles for the same user
CREATE UNIQUE INDEX IF NOT EXISTS unique_admin_per_user 
ON public.user_roles (user_id) 
WHERE role = 'Admin';


-- Migration: 20250814192939_06aa2ff6-cf0c-41fb-bc6c-d51aedb1528d.sql

-- Create the master PDF template with Zira Homes professional layout

-- Get the template ID for creating bindings
WITH template_data AS (
    SELECT id as template_id FROM public.pdf_templates 
    WHERE name = 'Zira Professional Template' AND is_active = true 
    LIMIT 1
),
document_types AS (
    SELECT unnest(ARRAY['invoice', 'report', 'letter', 'notice', 'lease', 'receipt']) as doc_type
),
user_roles AS (
    SELECT unnest(ARRAY['Admin', 'Landlord', 'Manager', 'Agent', 'Tenant']) as role,
           unnest(ARRAY[100, 90, 80, 70, 60]) as priority
)


-- Migration: 20250814193020_abe479c2-68ba-4c87-8267-cf45e4d8eb72.sql

-- Create the master PDF template with Zira Homes professional layout

-- Create additional templates for each document type

-- Get template IDs and create bindings for all document types and roles
WITH template_data AS (
    SELECT id as template_id, type as doc_type 
    FROM public.pdf_templates 
    WHERE name LIKE 'Zira%Template' AND is_active = true
),
user_roles AS (
    SELECT unnest(ARRAY['Admin', 'Landlord', 'Manager', 'Agent', 'Tenant']) as role,
           unnest(ARRAY[100, 90, 80, 70, 60]) as priority
)


-- Migration: 20250814193539_bdb2c3f4-5b3f-4d14-99db-a727308b6d9c.sql

  v_end   date := coalesce(p_end_date, now()::date);
  v_result jsonb;
begin
  with
  relevant_invoices as (
    select 
      inv.*,
      u.id as unit_id,
      u.unit_number,
      p.id as property_id,
      p.name as property_name,
      t.id as tenant_id,
      t.first_name,
      t.last_name
    from public.invoices inv
    join public.leases l on inv.lease_id = l.id
    join public.units u on l.unit_id = u.id
    join public.properties p on u.property_id = p.id
    join public.tenants t on inv.tenant_id = t.id
    where inv.invoice_date >= v_start
      and inv.invoice_date <= v_end
      and (p.owner_id = auth.uid() or p.manager_id = auth.uid())
  ),
  payments_for_period as (
    select 
      pay.*
    from public.payments pay
    join public.leases l on pay.lease_id = l.id
    join public.units u on l.unit_id = u.id
    join public.properties p on u.property_id = p.id
    where pay.payment_date >= v_start
      and pay.payment_date <= v_end
      and pay.status = 'completed'
      and (p.owner_id = auth.uid() or p.manager_id = auth.uid())
  ),
  payments_by_invoice as (
    select 
      invoice_id, 
      coalesce(sum(amount), 0)::numeric as amount_paid
    from public.payments
    where status = 'completed'
      and payment_date <= v_end
      and invoice_id is not null
    group by invoice_id
  ),
  invoice_with_paid as (
    select 
      ri.*,
      coalesce(pbi.amount_paid, 0)::numeric as amount_paid_total
    from relevant_invoices ri
    left join payments_by_invoice pbi on pbi.invoice_id = ri.id
  ),
  kpis as (
    select
      -- Expected (due) is the sum of invoices in the period
      coalesce(sum(ri.amount), 0)::numeric as total_due,
      -- Collected is the sum of completed payments in the period
      (select coalesce(sum(amount), 0)::numeric from payments_for_period) as total_collected,
      -- Outstanding = due - collected (bounded at >= 0)
      greatest(
        coalesce(sum(ri.amount), 0)::numeric 
        - (select coalesce(sum(amount), 0)::numeric from payments_for_period),
        0
      )::numeric as outstanding_amount,
      -- Collection rate = collected / due * 100
      case 
        when coalesce(sum(ri.amount), 0) > 0 then
          round(((select coalesce(sum(amount), 0)::numeric from payments_for_period) / coalesce(sum(ri.amount), 0)::numeric) * 100, 1)
        else 0
      end as collection_rate,
      -- Late payments = invoices past due with not fully paid
      sum(
        case 
          when ri.due_date < current_date and coalesce(ri.status, 'pending') <> 'paid' 
          then 1 
          else 0 
        end
      )::integer as late_payments
    from relevant_invoices ri
  ),
  collection_trend as (
    select 
      to_char(date_trunc('month', d), 'Mon') as month,
      coalesce((
        select sum(pay.amount)::numeric
        from public.payments pay
        join public.leases l on pay.lease_id = l.id
        join public.units u on l.unit_id = u.id
        join public.properties p on u.property_id = p.id
        where pay.payment_date >= date_trunc('month', d)
          and pay.payment_date < (date_trunc('month', d) + interval '1 month')
          and pay.status = 'completed'
          and (p.owner_id = auth.uid() or p.manager_id = auth.uid())
      ), 0) as collected,
      coalesce((
        select sum(inv.amount)::numeric
        from public.invoices inv
        join public.leases l on inv.lease_id = l.id
        join public.units u on l.unit_id = u.id
        join public.properties p on u.property_id = p.id
        where inv.invoice_date >= date_trunc('month', d)
          and inv.invoice_date < (date_trunc('month', d) + interval '1 month')
          and (p.owner_id = auth.uid() or p.manager_id = auth.uid())
      ), 0) as expected
    from generate_series(date_trunc('month', v_start), date_trunc('month', v_end), interval '1 month') d
  ),
  payment_status as (
    select 'Paid'::text as name, count(*)::integer as value
    from invoice_with_paid
    where amount_paid_total >= amount
    union all
    select 'Partial', count(*) 
    from invoice_with_paid
    where amount_paid_total > 0 and amount_paid_total < amount
    union all
    select 'Overdue', count(*)
    from invoice_with_paid
    where amount_paid_total = 0 and due_date < current_date
  ),
  table_rows as (
    select 
      ri.property_name,
      ri.unit_number,
      (coalesce(ri.first_name, '') || ' ' || coalesce(ri.last_name, ''))::text as tenant_name,
      ri.amount::numeric as amount_due,
      coalesce(pbi.amount_paid, 0)::numeric as amount_paid,
      case 
        when coalesce(pbi.amount_paid, 0) >= ri.amount then 'Paid'
        when coalesce(pbi.amount_paid, 0) > 0 then 'Partial'
        when ri.due_date < current_date then 'Overdue'
        else coalesce(ri.status, 'pending')
      end as status
    from relevant_invoices ri
    left join payments_by_invoice pbi on pbi.invoice_id = ri.id
  )
  select jsonb_build_object(
    'kpis', jsonb_build_object(
      'total_collected', (select total_collected from kpis),
      'collection_rate', (select collection_rate from kpis),
      'outstanding_amount', (select outstanding_amount from kpis),
      'late_payments', (select late_payments from kpis)
    ),
    'charts', jsonb_build_object(
      'collection_trend', (
        select coalesce(jsonb_agg(jsonb_build_object(
          'month', month,
          'collected', collected,
          'expected', expected
        )), '[]'::jsonb)
        from collection_trend
      ),
      'payment_status', (
        select coalesce(jsonb_agg(jsonb_build_object(
          'name', name,
          'value', value
        )), '[]'::jsonb)
        from payment_status
      )
    ),
    'table', (
      select coalesce(jsonb_agg(jsonb_build_object(
        'property_name', property_name,
        'unit_number', unit_number,
        'tenant_name', tenant_name,
        'amount_due', amount_due,
        'amount_paid', amount_paid,
        'status', status
      ) order by property_name, unit_number), '[]'::jsonb)
      from table_rows
    )
  ) into v_result;

  return v_result;
end;
$$;



-- Migration: 20250821111756_ebd93cdb-2173-4aac-8b25-5d83c7f55d4e.sql


-- 1) Occupancy Report
CREATE OR REPLACE FUNCTION public.get_occupancy_report(p_start_date date DEFAULT NULL::date, p_end_date date DEFAULT NULL::date)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $$
DECLARE
  v_start date := COALESCE(p_start_date, date_trunc('month', now())::date);
  v_end   date := COALESCE(p_end_date, now()::date);
  v_total_units integer := 0;
  v_result jsonb;
BEGIN
  -- Total units in portfolio
  SELECT COALESCE(COUNT(u.id), 0)
  INTO v_total_units
  FROM public.units u
  JOIN public.properties p ON p.id = u.property_id
  WHERE (p.owner_id = auth.uid() OR p.manager_id = auth.uid());

  WITH occupied_units AS (
    SELECT DISTINCT u.id, u.property_id
    FROM public.units u
    JOIN public.properties p ON p.id = u.property_id
    JOIN public.leases l ON l.unit_id = u.id
    WHERE (p.owner_id = auth.uid() OR p.manager_id = auth.uid())
      AND l.lease_start_date <= v_end
      AND l.lease_end_date >= v_start
      AND COALESCE(l.status, 'active') <> 'terminated'
  ),
  occupied_count AS (
    SELECT COUNT(*)::int AS occupied_units
    FROM occupied_units
  ),
  property_stats AS (
    SELECT 
      pr.id AS property_id,
      pr.name AS property_name,
      COUNT(u.id)::int AS total_units,
      COALESCE(SUM(CASE WHEN ou.id IS NOT NULL THEN 1 ELSE 0 END), 0)::int AS occupied_units
    FROM public.properties pr
    JOIN public.units u ON u.property_id = pr.id
    LEFT JOIN occupied_units ou ON ou.id = u.id
    WHERE (pr.owner_id = auth.uid() OR pr.manager_id = auth.uid())
    GROUP BY pr.id, pr.name
  ),
  occupancy_trend AS (
    SELECT 
      to_char(date_trunc('month', d), 'Mon') AS month,
      CASE 
        WHEN v_total_units > 0 THEN
          ROUND(
            (
              SELECT COUNT(DISTINCT u2.id)::numeric
              FROM public.units u2
              JOIN public.properties p2 ON p2.id = u2.property_id
              JOIN public.leases l2 ON l2.unit_id = u2.id
              WHERE (p2.owner_id = auth.uid() OR p2.manager_id = auth.uid())
                AND l2.lease_start_date <= (date_trunc('month', d) + interval '1 month' - interval '1 day')
                AND l2.lease_end_date >= date_trunc('month', d)
                AND COALESCE(l2.status, 'active') <> 'terminated'
            ) / v_total_units::numeric * 100, 1
          )
        ELSE 0
      END AS occupancy_rate
    FROM generate_series(date_trunc('month', v_start), date_trunc('month', v_end), interval '1 month') d
  ),
  per_property AS (
    SELECT
      property_name AS property,
      occupied_units AS occupied,
      (total_units - occupied_units) AS vacant
    FROM property_stats
  ),
  table_rows AS (
    SELECT 
      property_name,
      total_units,
      occupied_units,
      CASE WHEN total_units > 0 THEN ROUND((occupied_units::numeric / total_units::numeric) * 100, 1) ELSE 0 END AS occupancy_rate
    FROM property_stats
  )
  SELECT jsonb_build_object(
    'kpis', jsonb_build_object(
      'occupancy_rate', CASE WHEN v_total_units > 0 THEN ROUND(((SELECT occupied_units FROM occupied_count)::numeric / v_total_units::numeric) * 100, 1) ELSE 0 END,
      'total_units', v_total_units,
      'occupied_units', COALESCE((SELECT occupied_units FROM occupied_count), 0),
      'vacant_units', GREATEST(v_total_units - COALESCE((SELECT occupied_units FROM occupied_count), 0), 0)
    ),
    'charts', jsonb_build_object(
      'occupancy_trend', COALESCE((
        SELECT jsonb_agg(jsonb_build_object(
          'month', month,
          'occupancy_rate', occupancy_rate
        ))
        FROM occupancy_trend
      ), '[]'::jsonb),
      'property_occupancy', COALESCE((
        SELECT jsonb_agg(jsonb_build_object(
          'property', property,
          'occupied', occupied,
          'vacant', vacant
        ))
        FROM per_property
      ), '[]'::jsonb)
    ),
    'table', COALESCE((
      SELECT jsonb_agg(jsonb_build_object(
        'property_name', property_name,
        'total_units', total_units,
        'occupied_units', occupied_units,
        'occupancy_rate', occupancy_rate
      ) ORDER BY property_name)
      FROM table_rows
    ), '[]'::jsonb)
  ) INTO v_result;

  RETURN v_result;
END;
$$;

-- 2) Maintenance Report
CREATE OR REPLACE FUNCTION public.get_maintenance_report(p_start_date date DEFAULT NULL::date, p_end_date date DEFAULT NULL::date)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $$
DECLARE
  v_start date := COALESCE(p_start_date, (now() - interval '6 months')::date);
  v_end   date := COALESCE(p_end_date, now()::date);
  v_result jsonb;
BEGIN
  WITH relevant AS (
    SELECT 
      mr.*,
      pr.name AS property_name
    FROM public.maintenance_requests mr
    JOIN public.properties pr ON pr.id = mr.property_id
    WHERE (pr.owner_id = auth.uid() OR pr.manager_id = auth.uid())
      AND mr.submitted_date::date >= v_start
      AND mr.submitted_date::date <= v_end
  ),
  kpis AS (
    SELECT
      COUNT(*)::int AS total_requests,
      SUM(CASE WHEN LOWER(status) = 'completed' THEN 1 ELSE 0 END)::int AS completed_requests,
      ROUND(AVG(
        CASE 
          WHEN completed_date IS NOT NULL THEN EXTRACT(EPOCH FROM (completed_date - submitted_date)) / 86400
          ELSE NULL
        END
      )::numeric, 1) AS avg_resolution_days,
      COALESCE(SUM(cost), 0)::numeric AS total_cost
    FROM relevant
  ),
  requests_by_status AS (
    SELECT COALESCE(NULLIF(status,''), 'unknown')::text AS name, COUNT(*)::int AS value
    FROM relevant
    GROUP BY 1
  ),
  monthly_requests AS (
    SELECT 
      to_char(date_trunc('month', d), 'Mon') AS month,
      COALESCE((
        SELECT COUNT(*) FROM relevant r
        WHERE r.submitted_date >= date_trunc('month', d)
          AND r.submitted_date < (date_trunc('month', d) + interval '1 month')
      ), 0)::int AS requests
    FROM generate_series(date_trunc('month', v_start), date_trunc('month', v_end), interval '1 month') d
  ),
  table_rows AS (
    SELECT 
      property_name,
      category,
      status,
      submitted_date::date AS created_date,
      COALESCE(cost, 0)::numeric AS cost
    FROM relevant
    ORDER BY submitted_date DESC
  )
  SELECT jsonb_build_object(
