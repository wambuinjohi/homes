-- Seed default SMS templates for landlords
-- These templates will be available to all landlords as default templates

INSERT INTO public.sms_templates (
  landlord_id,
  name,
  content,
  category,
  enabled,
  variables,
  is_default,
  created_at,
  updated_at
) VALUES
  -- Payment Category
  (
    NULL,
    'Rent Payment Reminder',
    'Hi {tenant_name}, this is a friendly reminder that your rent of {amount} for {property_name} - {unit_number} is due on {due_date}. Please make payment to avoid late fees. Thank you!',
    'payment',
    true,
    ARRAY['tenant_name', 'amount', 'property_name', 'unit_number', 'due_date'],
    true,
    now(),
    now()
  ),
  (
    NULL,
    'Payment Received Confirmation',
    'Dear {tenant_name}, we have received your payment of {amount} for {property_name} - {unit_number}. Receipt: {receipt_number}. Thank you for your prompt payment!',
    'payment',
    true,
    ARRAY['tenant_name', 'amount', 'property_name', 'unit_number', 'receipt_number'],
    true,
    now(),
    now()
  ),
  (
    NULL,
    'Overdue Payment Notice',
    'URGENT: {tenant_name}, your rent payment of {amount} for {property_name} - {unit_number} is now {days_overdue} days overdue. Please contact us immediately to arrange payment.',
    'payment',
    true,
    ARRAY['tenant_name', 'amount', 'property_name', 'unit_number', 'days_overdue'],
    true,
    now(),
    now()
  ),
  
  -- Maintenance Category
  (
    NULL,
    'Maintenance Request Received',
    'Hello {tenant_name}, we have received your maintenance request for {property_name} - {unit_number}. Reference: {request_id}. We will attend to it shortly. Thank you for reporting!',
    'maintenance',
    true,
    ARRAY['tenant_name', 'property_name', 'unit_number', 'request_id'],
    true,
    now(),
    now()
  ),
  (
    NULL,
    'Maintenance Status Update',
    'Hi {tenant_name}, update on your maintenance request ({request_id}): Status changed to {status}. {additional_info}',
    'maintenance',
    true,
    ARRAY['tenant_name', 'request_id', 'status', 'additional_info'],
    true,
    now(),
    now()
  ),
  (
    NULL,
    'Maintenance Completed',
    'Dear {tenant_name}, your maintenance request ({request_id}) for {property_name} - {unit_number} has been completed. Please let us know if you need anything else. Thank you!',
    'maintenance',
    true,
    ARRAY['tenant_name', 'request_id', 'property_name', 'unit_number'],
    true,
    now(),
    now()
  ),
  
  -- Lease Category
  (
    NULL,
    'Lease Expiry Notice',
    'Hello {tenant_name}, your lease for {property_name} - {unit_number} will expire on {expiry_date}. Please contact us to discuss renewal options. Thank you!',
    'lease',
    true,
    ARRAY['tenant_name', 'property_name', 'unit_number', 'expiry_date'],
    true,
    now(),
    now()
  ),
  (
    NULL,
    'Lease Renewal Reminder',
    'Hi {tenant_name}, your lease expires in {days_remaining} days. We would love to have you continue as our tenant. Please contact us to renew your lease for {property_name} - {unit_number}.',
    'lease',
    true,
    ARRAY['tenant_name', 'days_remaining', 'property_name', 'unit_number'],
    true,
    now(),
    now()
  ),
  (
    NULL,
    'Welcome New Tenant',
    'Welcome {tenant_name}! We are delighted to have you at {property_name} - {unit_number}. Your lease starts on {lease_start_date}. If you need anything, please don''t hesitate to contact us!',
    'lease',
    true,
    ARRAY['tenant_name', 'property_name', 'unit_number', 'lease_start_date'],
    true,
    now(),
    now()
  ),
  
  -- General Category
  (
    NULL,
    'General Announcement',
    'Dear {tenant_name}, {announcement_message} - Management, {property_name}',
    'general',
    true,
    ARRAY['tenant_name', 'announcement_message', 'property_name'],
    true,
    now(),
    now()
  ),
  (
    NULL,
    'Emergency Alert',
    'IMPORTANT: {tenant_name}, emergency notice for {property_name}: {emergency_details}. Please follow instructions and contact us if needed.',
    'general',
    true,
    ARRAY['tenant_name', 'property_name', 'emergency_details'],
    true,
    now(),
    now()
  )
ON CONFLICT DO NOTHING;