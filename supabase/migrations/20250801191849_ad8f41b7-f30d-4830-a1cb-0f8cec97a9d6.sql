-- Add profession field to tenants table
ALTER TABLE public.tenants ADD COLUMN profession text;

-- Add national_id field to tenants table  
ALTER TABLE public.tenants ADD COLUMN national_id text;

-- Update existing tenant records with sample data
UPDATE public.tenants SET 
  profession = CASE 
    WHEN id = '550e8400-e29b-41d4-a716-446655440001' THEN 'Software Engineer'
    WHEN id = '550e8400-e29b-41d4-a716-446655440002' THEN 'Doctor'
    WHEN id = '550e8400-e29b-41d4-a716-446655440003' THEN 'Teacher'
    WHEN id = '550e8400-e29b-41d4-a716-446655440004' THEN 'Accountant'
    WHEN id = '550e8400-e29b-41d4-a716-446655440005' THEN 'Nurse'
    ELSE 'Business Owner'
  END,
  national_id = CASE 
    WHEN id = '550e8400-e29b-41d4-a716-446655440001' THEN '12345678'
    WHEN id = '550e8400-e29b-41d4-a716-446655440002' THEN '23456789'
    WHEN id = '550e8400-e29b-41d4-a716-446655440003' THEN '34567890'
    WHEN id = '550e8400-e29b-41d4-a716-446655440004' THEN '45678901'
    WHEN id = '550e8400-e29b-41d4-a716-446655440005' THEN '56789012'
    ELSE LPAD((RANDOM() * 99999999)::INT::TEXT, 8, '0')
  END;