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