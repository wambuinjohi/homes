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
    new_user_id uuid;
    unit_record RECORD;
BEGIN
    -- Iterate through tenants without user_id
    FOR tenant_record IN 
        SELECT * FROM tenants WHERE tenants.user_id IS NULL
    LOOP
        -- Generate a new UUID for the user
        new_user_id := gen_random_uuid();
        
        -- Create profile record (simulating the auth.users creation)
        INSERT INTO profiles (id, first_name, last_name, email, phone)
        VALUES (
            new_user_id,
            tenant_record.first_name,
            tenant_record.last_name,
            tenant_record.email,
            tenant_record.phone
        );
        
        -- Update tenant record with user_id
        UPDATE tenants 
        SET user_id = new_user_id
        WHERE id = tenant_record.id;
        
        -- Assign Tenant role
        INSERT INTO user_roles (user_id, role)
        VALUES (new_user_id, 'Tenant'::app_role);
        
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
INSERT INTO invoices (tenant_id, lease_id, invoice_number, invoice_date, due_date, amount, status, description)
SELECT 
    l.tenant_id,
    l.id,
    'INV-' || EXTRACT(YEAR FROM CURRENT_DATE) || '-' || LPAD(ROW_NUMBER() OVER (ORDER BY l.created_at)::text, 4, '0'),
    CURRENT_DATE - INTERVAL '1 month',
    CURRENT_DATE - INTERVAL '1 month' + INTERVAL '10 days',
    l.monthly_rent,
    CASE 
        WHEN RANDOM() < 0.7 THEN 'paid'
        WHEN RANDOM() < 0.9 THEN 'pending'
        ELSE 'overdue'
    END,
    'Monthly Rent - ' || TO_CHAR(CURRENT_DATE - INTERVAL '1 month', 'Mon YYYY')
FROM leases l
WHERE EXISTS (SELECT 1 FROM tenants t WHERE t.id = l.tenant_id AND t.user_id IS NOT NULL);

-- Create current month invoices
INSERT INTO invoices (tenant_id, lease_id, invoice_number, invoice_date, due_date, amount, status, description)
SELECT 
    l.tenant_id,
    l.id,
    'INV-' || EXTRACT(YEAR FROM CURRENT_DATE) || '-' || LPAD((ROW_NUMBER() OVER (ORDER BY l.created_at) + 1000)::text, 4, '0'),
    CURRENT_DATE,
    CURRENT_DATE + INTERVAL '10 days',
    l.monthly_rent,
    CASE 
        WHEN RANDOM() < 0.3 THEN 'paid'
        WHEN RANDOM() < 0.8 THEN 'pending'
        ELSE 'overdue'
    END,
    'Monthly Rent - ' || TO_CHAR(CURRENT_DATE, 'Mon YYYY')
FROM leases l
WHERE EXISTS (SELECT 1 FROM tenants t WHERE t.id = l.tenant_id AND t.user_id IS NOT NULL);

-- Create some payment records for paid invoices
INSERT INTO payments (tenant_id, lease_id, amount, payment_date, payment_method, payment_type, status, invoice_number)
SELECT 
    i.tenant_id,
    i.lease_id,
    i.amount,
    i.due_date - INTERVAL '2 days',
    CASE 
        WHEN RANDOM() < 0.5 THEN 'M-Pesa'
        WHEN RANDOM() < 0.8 THEN 'Bank Transfer'
        ELSE 'Cash'
    END,
    'Rent Payment',
    'completed',
    i.invoice_number
FROM invoices i
WHERE i.status = 'paid';

-- Create some maintenance requests from tenants
INSERT INTO maintenance_requests (
    tenant_id, 
    property_id, 
    unit_id, 
    title, 
    description, 
    category, 
    priority, 
    status
)
SELECT 
    l.tenant_id,
    u.property_id,
    l.unit_id,
    CASE 
        WHEN RANDOM() < 0.3 THEN 'Plumbing Issue'
        WHEN RANDOM() < 0.5 THEN 'Electrical Problem'
        WHEN RANDOM() < 0.7 THEN 'AC Unit Not Working'
        ELSE 'General Maintenance'
    END,
    CASE 
        WHEN RANDOM() < 0.3 THEN 'Kitchen sink is leaking and needs urgent repair'
        WHEN RANDOM() < 0.5 THEN 'Living room lights not working properly'
        WHEN RANDOM() < 0.7 THEN 'Air conditioning unit making loud noise'
        ELSE 'Door handle is loose and needs tightening'
    END,
    CASE 
        WHEN RANDOM() < 0.3 THEN 'Plumbing'
        WHEN RANDOM() < 0.5 THEN 'Electrical'
        WHEN RANDOM() < 0.7 THEN 'HVAC'
        ELSE 'General'
    END,
    CASE 
        WHEN RANDOM() < 0.2 THEN 'high'
        WHEN RANDOM() < 0.7 THEN 'medium'
        ELSE 'low'
    END,
    CASE 
        WHEN RANDOM() < 0.3 THEN 'pending'
        WHEN RANDOM() < 0.6 THEN 'in_progress'
        WHEN RANDOM() < 0.8 THEN 'completed'
        ELSE 'cancelled'
    END
FROM leases l
JOIN units u ON l.unit_id = u.id
WHERE EXISTS (SELECT 1 FROM tenants t WHERE t.id = l.tenant_id AND t.user_id IS NOT NULL)
AND RANDOM() < 0.4; -- Only create for about 40% of tenants