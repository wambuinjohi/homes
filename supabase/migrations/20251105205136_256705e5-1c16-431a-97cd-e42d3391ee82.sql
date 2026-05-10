-- Clean up duplicate SMS templates and add landlord personalization

-- First, identify and delete duplicate default templates (keeping one of each)
WITH ranked_templates AS (
  SELECT 
    id,
    name,
    ROW_NUMBER() OVER (PARTITION BY name, landlord_id ORDER BY created_at) as rn
  FROM sms_templates
  WHERE landlord_id IS NULL
)
DELETE FROM sms_templates
WHERE id IN (
  SELECT id FROM ranked_templates WHERE rn > 1
);

-- Update default templates to include landlord personalization
-- Payment reminder template
UPDATE sms_templates
SET 
  content = 'Dear {tenant_name}, this is a friendly reminder that your rent payment of {amount} for {property_name}, Unit {unit_number} is due on {due_date}. Please make payment at your earliest convenience. Thank you! - {landlord_name}',
  variables = ARRAY['tenant_name', 'amount', 'property_name', 'unit_number', 'due_date', 'landlord_name']
WHERE landlord_id IS NULL 
  AND name = 'Payment Reminder'
  AND category = 'payment_reminders';

-- Overdue payment template
UPDATE sms_templates
SET 
  content = 'Dear {tenant_name}, your rent payment of {amount} for {property_name}, Unit {unit_number} was due on {due_date} and is now overdue. Please settle this as soon as possible to avoid late fees. Contact me if you need assistance. - {landlord_name}',
  variables = ARRAY['tenant_name', 'amount', 'property_name', 'unit_number', 'due_date', 'landlord_name']
WHERE landlord_id IS NULL 
  AND name = 'Overdue Payment'
  AND category = 'payment_reminders';

-- Maintenance update template
UPDATE sms_templates
SET 
  content = 'Dear {tenant_name}, your maintenance request for {property_name}, Unit {unit_number} has been updated. Status: {status}. {message}. Thank you for your patience. - {landlord_name}',
  variables = ARRAY['tenant_name', 'property_name', 'unit_number', 'status', 'message', 'landlord_name']
WHERE landlord_id IS NULL 
  AND name = 'Maintenance Update'
  AND category = 'maintenance';

-- Emergency alert template
UPDATE sms_templates
SET 
  content = 'URGENT: {tenant_name}, there is an emergency at {property_name}. {emergency_message}. Please take immediate action. Contact me at {contact_number} for more information. - {landlord_name}',
  variables = ARRAY['tenant_name', 'property_name', 'emergency_message', 'contact_number', 'landlord_name']
WHERE landlord_id IS NULL 
  AND name = 'Emergency Alert'
  AND category = 'general';

-- Lease expiry reminder template
UPDATE sms_templates
SET 
  content = 'Dear {tenant_name}, your lease for {property_name}, Unit {unit_number} will expire on {expiry_date}. Please contact me to discuss renewal options. - {landlord_name}',
  variables = ARRAY['tenant_name', 'property_name', 'unit_number', 'expiry_date', 'landlord_name']
WHERE landlord_id IS NULL 
  AND name = 'Lease Expiry Reminder'
  AND category = 'lease_management';

-- General announcement template
UPDATE sms_templates
SET 
  content = 'Dear {tenant_name}, {announcement_message}. If you have any questions, please feel free to reach out. Best regards, {landlord_name} ({property_name})',
  variables = ARRAY['tenant_name', 'announcement_message', 'property_name', 'landlord_name']
WHERE landlord_id IS NULL 
  AND name = 'General Announcement'
  AND category = 'general';