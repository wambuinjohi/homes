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