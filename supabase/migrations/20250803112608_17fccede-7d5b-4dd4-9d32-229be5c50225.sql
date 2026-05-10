-- Update existing tenants with sample data and create demo credentials
-- Note: Since we can't create actual auth users, we'll just update tenant data for demo purposes

-- Create some sample invoices for existing tenants with leases
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
WHERE l.id IS NOT NULL;

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
WHERE l.id IS NOT NULL;

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
        WHEN RANDOM() < 0.25 THEN 'Plumbing Issue'
        WHEN RANDOM() < 0.5 THEN 'Electrical Problem'
        WHEN RANDOM() < 0.75 THEN 'AC Unit Not Working'
        ELSE 'General Maintenance'
    END,
    CASE 
        WHEN RANDOM() < 0.25 THEN 'Kitchen sink is leaking and needs urgent repair'
        WHEN RANDOM() < 0.5 THEN 'Living room lights not working properly'
        WHEN RANDOM() < 0.75 THEN 'Air conditioning unit making loud noise'
        ELSE 'Door handle is loose and needs tightening'
    END,
    CASE 
        WHEN RANDOM() < 0.25 THEN 'Plumbing'
        WHEN RANDOM() < 0.5 THEN 'Electrical'
        WHEN RANDOM() < 0.75 THEN 'HVAC'
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
WHERE l.id IS NOT NULL
AND RANDOM() < 0.4; -- Only create for about 40% of tenants

-- Create notifications table for tenant updates and announcements
CREATE TABLE IF NOT EXISTS tenant_announcements (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    property_id uuid REFERENCES properties(id),
    title text NOT NULL,
    message text NOT NULL,
    announcement_type text NOT NULL DEFAULT 'general',
    created_at timestamptz NOT NULL DEFAULT now(),
    expires_at timestamptz,
    is_urgent boolean DEFAULT false,
    created_by uuid
);

-- Enable RLS on announcements
ALTER TABLE tenant_announcements ENABLE ROW LEVEL SECURITY;

-- Create policy for tenants to view announcements for their property
CREATE POLICY "Tenants can view announcements for their property" 
ON tenant_announcements 
FOR SELECT 
USING (
    EXISTS (
        SELECT 1 FROM leases l
        JOIN units u ON l.unit_id = u.id
        JOIN tenants t ON l.tenant_id = t.id
        WHERE u.property_id = tenant_announcements.property_id
        AND t.user_id = auth.uid()
    )
);

-- Property managers can manage announcements
CREATE POLICY "Property stakeholders can manage announcements" 
ON tenant_announcements 
FOR ALL 
USING (
    EXISTS (
        SELECT 1 FROM properties p
        WHERE p.id = tenant_announcements.property_id
        AND (p.owner_id = auth.uid() OR p.manager_id = auth.uid())
    ) OR has_role(auth.uid(), 'Admin'::app_role) OR has_role(auth.uid(), 'Landlord'::app_role)
);

-- Insert some sample announcements
INSERT INTO tenant_announcements (property_id, title, message, announcement_type, is_urgent)
SELECT 
    p.id,
    CASE 
        WHEN RANDOM() < 0.3 THEN 'Scheduled Maintenance - Water Interruption'
        WHEN RANDOM() < 0.6 THEN 'Community Meeting Next Week'
        ELSE 'New Security Protocols'
    END,
    CASE 
        WHEN RANDOM() < 0.3 THEN 'Water will be temporarily shut off for pipe maintenance on Saturday from 8 AM to 2 PM. Please store water accordingly.'
        WHEN RANDOM() < 0.6 THEN 'Join us for the monthly community meeting next Tuesday at 7 PM in the community hall. We will discuss upcoming improvements and address resident concerns.'
        ELSE 'For enhanced security, we are implementing new access card protocols. Please collect your new access cards from the management office by month end.'
    END,
    CASE 
        WHEN RANDOM() < 0.3 THEN 'maintenance'
        WHEN RANDOM() < 0.6 THEN 'community'
        ELSE 'security'
    END,
    CASE 
        WHEN RANDOM() < 0.2 THEN true
        ELSE false
    END
FROM properties p
WHERE EXISTS (SELECT 1 FROM units u WHERE u.property_id = p.id)
AND RANDOM() < 0.6; -- About 60% of properties get announcements